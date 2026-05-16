import AsyncStorage from '@react-native-async-storage/async-storage';

const DB_KEY = '@stockai_products';

// Dati iniziali di test (simulazione del tuo CSV)
const INITIAL_DATA = [
  { id: '1', name: 'Gin Mare', supplier_id: 'sup-1', current_stock: 12, min_threshold: 5, max_threshold: 24, manual_status_override: null },
  { id: '2', name: 'Vodka Belvedere', supplier_id: 'sup-1', current_stock: 3, min_threshold: 6, max_threshold: 18, manual_status_override: 'YELLOW' },
  { id: '3', name: 'Tonica Fever Tree', supplier_id: 'sup-2', current_stock: 48, min_threshold: 24, max_threshold: 100, manual_status_override: 'GREEN' },
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