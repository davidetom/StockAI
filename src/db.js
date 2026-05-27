import AsyncStorage from '@react-native-async-storage/async-storage';

const DB_KEY = '@stockai_products_v2';
const TRANSIT_ORDERS_KEY = '@stockai_transit_orders';

const INITIAL_DATA = [
  { id: '1', name: 'Gin Mare', supplier_id: 'Forniture Rossi SpA', current_stock: 12, min_threshold: 5, max_threshold: 24, unit: 'bottiglie' },
  { id: '2', name: 'Vodka Belvedere', supplier_id: 'Forniture Rossi SpA', current_stock: 3, min_threshold: 6, max_threshold: 18, unit: 'bottiglie' },
  { id: '3', name: 'Tonica Fever Tree', supplier_id: 'Bevande Locali Srl', current_stock: 20, min_threshold: 24, max_threshold: 100, unit: 'u.' },
  { id: '4', name: 'Pomodori San Marzano', supplier_id: 'Ortofrutta Locale', current_stock: 5, min_threshold: 15, max_threshold: 30, unit: 'kg' },
  { id: '5', name: 'Basilico Fresco', supplier_id: 'Ortofrutta Locale', current_stock: 1, min_threshold: 3, max_threshold: 5, unit: 'kg' },
];

export const emptyWarehouse = async () => {
  try {
    await AsyncStorage.setItem(DB_KEY, JSON.stringify([]));
    await AsyncStorage.setItem(TRANSIT_ORDERS_KEY, JSON.stringify([]));
  } catch (e) {
    console.error('Errore durante lo svuotamento del magazzino', e);
  }
};

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
  } catch (e) {}
};

// --- LOGICA ORDINI IN TRANSITO ---

export const getTransitOrders = async () => {
  try {
    const data = await AsyncStorage.getItem(TRANSIT_ORDERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const addTransitOrder = async (order) => {
  try {
    const orders = await getTransitOrders();
    const newOrder = { ...order, status: 'In Transito' };
    orders.push(newOrder);
    await AsyncStorage.setItem(TRANSIT_ORDERS_KEY, JSON.stringify(orders));
  } catch (e) {}
};

export const completeTransitOrder = async (orderId, items) => {
  try {
    // 1. Rimuovi l'ordine dalla lista dei transiti
    const orders = await getTransitOrders();
    const updatedOrders = orders.filter(o => o.id !== orderId);
    await AsyncStorage.setItem(TRANSIT_ORDERS_KEY, JSON.stringify(updatedOrders));

    // 2. Aggiungi fisicamente le quantità al magazzino
    const products = await getProducts();
    let updatedProducts = [...products];
    for (const item of items) {
      updatedProducts = updatedProducts.map(p => {
        if (p.id === item.id) {
          return { ...p, current_stock: p.current_stock + item.orderQuantity };
        }
        return p;
      });
    }
    await AsyncStorage.setItem(DB_KEY, JSON.stringify(updatedProducts));
  } catch (e) {}
};

// --- LOGICA BOZZE ---

export const getDraftOrders = async () => {
  const products = await getProducts();
  const transitOrders = await getTransitOrders();
  
  // Trova i prodotti che stiamo GIÀ aspettando per non riordinarli
  const productsInTransit = new Set();
  transitOrders.forEach(order => {
    order.items.forEach(item => productsInTransit.add(item.id));
  });

  const ordersBySupplier = {};

  products.forEach(p => {
    // Se è in transito, lo ignoriamo nella creazione della bozza
    if (productsInTransit.has(p.id)) return;

    if (p.current_stock <= p.min_threshold * 1.5) {
      if (!ordersBySupplier[p.supplier_id]) {
        // Creiamo un numero stabile (da 0 a 999) basato sul nome del fornitore
        const stableNum = p.supplier_id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 1000;
        
        // Calcoliamo la data odierna nel formato GG-MM-AAAA
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0'); // I mesi partono da 0 in JS
        const year = today.getFullYear();
        
        ordersBySupplier[p.supplier_id] = {
          id: `ORD-${day}-${month}-${year}-${stableNum}`, // Es. ORD-22-05-2026-123
          supplierName: p.supplier_id,
          date: today.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }),
          status: 'Bozza',
          items: []
        };
      }
      const orderQty = Math.max(0, p.max_threshold - p.current_stock);
      if (orderQty > 0) {
        ordersBySupplier[p.supplier_id].items.push({ ...p, orderQuantity: orderQty });
      }
    }
  });

  return Object.values(ordersBySupplier);
};

// --- LOGICA AUTENTICAZIONE ---
const AUTH_KEY = '@stockai_auth_user';

export const loginUser = async (role) => {
  try {
    // Creiamo un utente fittizio basato sul pulsante premuto
    const user = {
      id: role === 'MANAGER' ? 'manager_1' : 'staff_1',
      role: role, // 'MANAGER' o 'STAFF'
      name: role === 'MANAGER' ? 'Gestore' : 'Cameriere',
    };
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(user));
    return user;
  } catch (e) {
    console.error('Errore durante il login', e);
  }
};

export const getAuthUser = async () => {
  try {
    const data = await AsyncStorage.getItem(AUTH_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
};

export const logoutUser = async () => {
  try {
    await AsyncStorage.removeItem(AUTH_KEY);
  } catch (e) {
    console.error('Errore durante il logout', e);
  }
};

// --- LOGICA GESTIONE MAGAZZINO (ADMIN) ---

export const addProduct = async (productData) => {
  try {
    const products = await getProducts();
    // Il productData ora includerà { ...dati_base, category: '...', icon: '...' }
    const newProduct = { 
      ...productData, 
      id: `PROD-${Date.now()}`, 
      current_stock: 0 
    };
    products.push(newProduct);
    await AsyncStorage.setItem(DB_KEY, JSON.stringify(products));
    return products;
  } catch (e) {
    console.error('Errore aggiunta prodotto', e);
  }
};

export const deleteProduct = async (productId) => {
  try {
    const products = await getProducts();
    const updatedProducts = products.filter(p => p.id !== productId);
    await AsyncStorage.setItem(DB_KEY, JSON.stringify(updatedProducts));
    return updatedProducts;
  } catch (e) {
    console.error('Errore eliminazione prodotto', e);
  }
};

export const updateProductDetails = async (productId, updatedData) => {
  try {
    const products = await getProducts();
    const newProducts = products.map(p => 
      p.id === productId ? { ...p, ...updatedData } : p
    );
    await AsyncStorage.setItem(DB_KEY, JSON.stringify(newProducts));
    return newProducts;
  } catch (e) {
    console.error('Errore aggiornamento dettagli prodotto', e);
  }
};

export const updateProductSupplier = async (productId, newSupplier) => {
  try {
    const products = await getProducts();
    const updatedProducts = products.map(p => 
      p.id === productId ? { ...p, supplier_id: newSupplier } : p
    );
    await AsyncStorage.setItem(DB_KEY, JSON.stringify(updatedProducts));
    return updatedProducts;
  } catch (e) {
    console.error('Errore aggiornamento fornitore', e);
  }
};

// --- LOGICA CHIAVE API GEMINI ---
const API_KEY_STORAGE = '@stockai_custom_api_key';

export const getCustomApiKey = async () => {
  try {
    return await AsyncStorage.getItem(API_KEY_STORAGE);
  } catch (e) {
    return null;
  }
};

export const saveCustomApiKey = async (key) => {
  try {
    if (key && key.trim() !== '') {
      await AsyncStorage.setItem(API_KEY_STORAGE, key.trim());
    } else {
      await AsyncStorage.removeItem(API_KEY_STORAGE);
    }
  } catch (e) {
    console.error('Errore nel salvataggio dell\'API Key', e);
  }
};

// --- LOGICA CATEGORIE E ICONE IA ---
export const applyProductCategories = async (aiMapping) => {
  try {
    const products = await getProducts();
    const updatedProducts = products.map(p => {
      // Se Gemini ha restituito dati per questo prodotto
      if (aiMapping[p.id]) {
        return { 
          ...p, 
          category: aiMapping[p.id].category || p.category,
          icon: aiMapping[p.id].icon || p.icon // Salva il nome dell'icona, se presente
        };
      }
      return p;
    });
    await AsyncStorage.setItem(DB_KEY, JSON.stringify(updatedProducts));
    return updatedProducts;
  } catch (e) {
    console.error('Errore applicazione categorie e icone', e);
  }
};

export const completeTransitOrderWithScan = async (orderId, scannedItems, supplierName) => {
  try {
    // 1. Elimina l'ordine dalla lista dei transiti
    const orders = await getTransitOrders();
    const updatedOrders = orders.filter(o => o.id !== orderId);
    await AsyncStorage.setItem(TRANSIT_ORDERS_KEY, JSON.stringify(updatedOrders));

    // 2. Prepara l'aggiornamento prodotti
    const products = await getProducts();
    let newProductsToInsert = [];
    
    for (const item of scannedItems) {
      if (item.isNew) {
        // Se è nuovo, lo creiamo e assegnamo la giacenza iniziale pari a quanto consegnato
        const newProd = {
          id: `PROD-${Date.now()}-${Math.floor(Math.random()*10000)}`,
          name: item.name,
          supplier_id: supplierName,
          unit: item.unit,
          min_threshold: parseInt(item.minThreshold) || 5, // Dati scelti dall'utente
          max_threshold: parseInt(item.maxThreshold) || 20,
          current_stock: item.quantity,
          category: item.category,
          icon: item.icon
        };
        newProductsToInsert.push(newProd);
      } else {
        // Se esiste già, sommiamo la quantità
        const idx = products.findIndex(p => p.id === item.id);
        if (idx > -1) {
          products[idx].current_stock += item.quantity;
        }
      }
    }
    
    // 3. Salva tutto
    const finalProducts = [...products, ...newProductsToInsert];
    await AsyncStorage.setItem(DB_KEY, JSON.stringify(finalProducts));
    
  } catch(e) {
    console.error('Errore completamento ordine con scansione', e);
  }
};

// --- LOGICA ONBOARDING ---
export const addMultipleProducts = async (newProductsArray) => {
  try {
    const products = await getProducts();
    
    const formattedProducts = newProductsArray.map((p, index) => ({
      ...p,
      id: `PROD-${Date.now()}-${index}`,
      supplier_id: p.supplier_id || 'Fornitore Generico',
      // Logica di fallback sicura
      current_stock: Number(p.current_stock) || 0,
      min_threshold: Number(p.min_threshold) || 5,
      max_threshold: Number(p.max_threshold) || 20,
    }));
    
    const updatedProducts = [...products, ...formattedProducts];
    await AsyncStorage.setItem(DB_KEY, JSON.stringify(updatedProducts));
    return updatedProducts;
  } catch (e) {
    console.error('Errore salvataggio massivo:', e);
  }
};