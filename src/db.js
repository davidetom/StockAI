import AsyncStorage from '@react-native-async-storage/async-storage';

const DB_KEY = '@stockai_products_v5';

// Abbiamo aggiunto 'unit' e 'max_threshold'
const INITIAL_DATA = [
  { id: '1', name: 'Gin Mare', supplier_id: 'Forniture Rossi SpA', current_stock: 12, min_threshold: 5, max_threshold: 24, unit: 'bottiglie' },
  { id: '2', name: 'Vodka Belvedere', supplier_id: 'Forniture Rossi SpA', current_stock: 3, min_threshold: 6, max_threshold: 18, unit: 'bottiglie' },
  { id: '3', name: 'Tonica Fever Tree', supplier_id: 'Bevande Locali Srl', current_stock: 20, min_threshold: 24, max_threshold: 100, unit: 'bottiglie' },
  { id: '4', name: 'Pomodori San Marzano', supplier_id: 'Ortofrutta Locale', current_stock: 5, min_threshold: 15, max_threshold: 30, unit: 'kg' },
  { id: '5', name: 'Basilico Fresco', supplier_id: 'Ortofrutta Locale', current_stock: 1, min_threshold: 3, max_threshold: 5, unit: 'kg' },
];

export const initDB = async () => {
  try {
    const existingData = await AsyncStorage.getItem(DB_KEY);
    if (!existingData) {
      await AsyncStorage.setItem(DB_KEY, JSON.stringify(INITIAL_DATA));
    }
  } catch (e) {
    console.error('Errore inizializzazione DB', e);
  }
};

export const getProducts = async () => {
  try {
    const data = await AsyncStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Errore lettura DB', e);
    return [];
  }
};

export const updateProductStock = async (productId, quantityChange) => {
  try {
    const products = await getProducts();
    const updatedProducts = products.map(p => {
      if (p.id === productId) {
        return { ...p, current_stock: Math.max(0, p.current_stock + quantityChange) };
      }
      return p;
    });
    await AsyncStorage.setItem(DB_KEY, JSON.stringify(updatedProducts));
    return updatedProducts;
  } catch (e) {
    console.error('Errore aggiornamento DB', e);
  }
};

// NUOVA LOGICA: Genera gli ordini in base a chi è "in esaurimento" (<= 1.5 * min_threshold)
export const getDraftOrders = async () => {
  const products = await getProducts();
  const ordersBySupplier = {};

  products.forEach(p => {
    // Se il prodotto è sotto la soglia di allerta (giallo o peggio)
    if (p.current_stock <= p.min_threshold * 1.5) {
      if (!ordersBySupplier[p.supplier_id]) {
        ordersBySupplier[p.supplier_id] = {
          id: `ORD-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
          supplierName: p.supplier_id,
          date: new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }),
          status: 'Bozza',
          items: []
        };
      }
      // Calcola quanto ordinare per arrivare al max_threshold
      const orderQty = Math.max(0, p.max_threshold - p.current_stock);
      if (orderQty > 0) {
        ordersBySupplier[p.supplier_id].items.push({
          ...p,
          orderQuantity: orderQty
        });
      }
    }
  });

  return Object.values(ordersBySupplier);
};