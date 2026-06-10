import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// Helper per ottenere il locale_id dell'utente corrente
export const getLocaleId = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) throw new Error("Utente non loggato");
  const { data, error } = await supabase
    .from('profiles')
    .select('locale_id')
    .eq('id', session.user.id)
    .single();
  if (error || !data) throw new Error("Impossibile recuperare il locale_id");
  return data.locale_id;
};

export const emptyWarehouse = async () => {
  try {
    const locale_id = await getLocaleId();
    await supabase.from('products').delete().eq('locale_id', locale_id);
    await supabase.from('transit_orders').delete().eq('locale_id', locale_id);
  } catch (e) {
    console.error('Errore durante lo svuotamento del magazzino', e);
  }
};

export const initDB = async () => {
  // Non fa nulla: gestito da Supabase
};

// --- LOGICA FORNITORI ---
export const getSuppliers = async () => {
  try {
    const { data, error } = await supabase.from('suppliers').select('*');
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Errore getSuppliers', e);
    return [];
  }
};

export const updateSupplier = async (name, channel, phone, email) => {
  try {
    const locale_id = await getLocaleId();
    const { error } = await supabase.from('suppliers').upsert(
      { locale_id, name, channel, phone, email },
      { onConflict: 'locale_id, name' }
    );
    if (error) throw error;
  } catch (e) {
    console.error('Errore updateSupplier', e);
  }
};

export const deleteSupplierIfEmpty = async (supplierName) => {
  try {
    if (!supplierName) return;
    const locale_id = await getLocaleId();

    // Check if there are any products left for this supplier in this locale
    const { data, error: selectError } = await supabase.from('products')
      .select('id')
      .eq('supplier_id', supplierName)
      .eq('locale_id', locale_id)
      .limit(1);

    if (selectError) {
      console.error('Errore lettura prodotti per deleteSupplierIfEmpty:', selectError);
    }

    // If no products found, delete the supplier
    if (!data || data.length === 0) {
      const { error: deleteError } = await supabase.from('suppliers')
        .delete()
        .eq('name', supplierName)
        .eq('locale_id', locale_id);

      if (deleteError) {
        console.error('Errore delete fornitore:', deleteError);
      }
    }
  } catch (e) {
    console.error('Errore deleteSupplierIfEmpty', e);
  }
};

export const transferProductsSupplier = async (oldSupplier, newSupplier) => {
  try {
    const locale_id = await getLocaleId();
    const { error } = await supabase.from('products')
      .update({ supplier_id: newSupplier })
      .eq('supplier_id', oldSupplier)
      .eq('locale_id', locale_id);
      
    if (error) throw error;
    
    // Clean up the old supplier if it has no more products
    await deleteSupplierIfEmpty(oldSupplier);
  } catch (e) {
    console.error('Errore transferProductsSupplier', e);
  }
};

// --- LOGICA PRODOTTI ---
export const getProducts = async () => {
  try {
    const { data, error } = await supabase.from('products').select('*');
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Errore getProducts', e);
    return [];
  }
};

export const addProduct = async (productData) => {
  try {
    const locale_id = await getLocaleId();
    const newProduct = {
      ...productData,
      locale_id,
      current_stock: productData.current_stock || 0
    };
    const { error } = await supabase.from('products').insert(newProduct);
    if (error) throw error;
  } catch (e) {
    console.error('Errore addProduct', e);
  }
};

export const updateProductStock = async (productId, quantityChange) => {
  try {
    const { data: product } = await supabase.from('products').select('current_stock').eq('id', productId).single();
    if (product) {
      const newStock = Math.max(0, Number(product.current_stock) + quantityChange);
      await supabase.from('products').update({ current_stock: newStock }).eq('id', productId);
    }
  } catch (e) {
    console.error('Errore updateProductStock', e);
  }
};

export const deleteProduct = async (productId) => {
  try {
    const { data: oldProd } = await supabase.from('products').select('supplier_id').eq('id', productId).single();
    const oldSupplier = oldProd?.supplier_id;

    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw error;

    if (oldSupplier) {
      await deleteSupplierIfEmpty(oldSupplier);
    }
  } catch (e) {
    console.error('Errore deleteProduct', e);
  }
};

export const updateProductDetails = async (productId, updatedData) => {
  try {
    const { error } = await supabase.from('products').update(updatedData).eq('id', productId);
    if (error) throw error;
  } catch (e) {
    console.error('Errore updateProductDetails', e);
  }
};

export const updateProductSupplier = async (productId, newSupplier) => {
  try {
    const { data: oldProd } = await supabase.from('products').select('supplier_id').eq('id', productId).single();
    const oldSupplier = oldProd?.supplier_id;

    const { error } = await supabase.from('products').update({ supplier_id: newSupplier }).eq('id', productId);
    if (error) throw error;

    if (oldSupplier && oldSupplier !== newSupplier) {
      await deleteSupplierIfEmpty(oldSupplier);
    }
  } catch (e) {
    console.error('Errore updateProductSupplier', e);
  }
};

export const applyProductCategories = async (aiMapping) => {
  try {
    const products = await getProducts();
    for (const p of products) {
      if (aiMapping[p.id]) {
        await supabase.from('products').update({
          category: aiMapping[p.id].category || p.category,
          icon: aiMapping[p.id].icon || p.icon
        }).eq('id', p.id);
      }
    }
  } catch (e) {
    console.error('Errore applyProductCategories', e);
  }
};

export const addMultipleProducts = async (newProductsArray) => {
  try {
    const locale_id = await getLocaleId();
    const toInsert = newProductsArray.map(p => ({
      locale_id,
      name: p.name,
      supplier_id: p.supplier_id || 'Fornitore Generico',
      current_stock: Number(p.current_stock) || 0,
      min_threshold: Number(p.min_threshold) || 5,
      max_threshold: Number(p.max_threshold) || 20,
      unit: p.unit || 'pz.',
      category: p.category,
      icon: p.icon
    }));
    const { error } = await supabase.from('products').insert(toInsert);
    if (error) throw error;
  } catch (e) {
    console.error('Errore salvataggio massivo:', e);
  }
};

// --- LOGICA ORDINI IN TRANSITO ---
export const getTransitOrders = async () => {
  try {
    const { data, error } = await supabase.from('transit_orders').select('*');
    if (error) throw error;
    // La colonna supplier_name sul DB sostituisce 'supplier' del vecchio mock. 
    // Mapperemo supplier_name -> supplier per non rompere il frontend.
    return (data || []).map(o => ({
      ...o,
      supplierName: o.supplier_name,
      supplier: o.supplier_name
    }));
  } catch (e) {
    console.error('Errore getTransitOrders', e);
    return [];
  }
};

export const addTransitOrder = async (order) => {
  try {
    const locale_id = await getLocaleId();
    const newOrder = {
      locale_id,
      supplier_name: order.supplierName || order.supplier,
      status: 'In Transito',
      date: order.date,
      items: order.items,
      display_id: order.id
    };
    const { error } = await supabase.from('transit_orders').insert(newOrder);
    if (error) throw error;
  } catch (e) {
    console.error('Errore addTransitOrder', e);
  }
};

export const completeTransitOrder = async (orderId, items) => {
  try {
    await supabase.from('transit_orders').delete().eq('id', orderId);

    for (const item of items) {
      const { data: product } = await supabase.from('products').select('current_stock').eq('id', item.id).single();
      if (product) {
        await supabase.from('products').update({
          current_stock: Number(product.current_stock) + Number(item.orderQuantity)
        }).eq('id', item.id);
      }
    }
  } catch (e) {
    console.error('Errore completeTransitOrder', e);
  }
};

export const completeTransitOrderWithScan = async (orderId, scannedItems, supplierName) => {
  try {
    const locale_id = await getLocaleId();
    await supabase.from('transit_orders').delete().eq('id', orderId);

    for (const item of scannedItems) {
      if (item.isNew) {
        const newProd = {
          locale_id,
          name: item.name,
          supplier_id: supplierName,
          unit: item.unit,
          min_threshold: parseInt(item.minThreshold) || 5,
          max_threshold: parseInt(item.maxThreshold) || 20,
          current_stock: Number(item.quantity) || 0,
          category: item.category,
          icon: item.icon
        };
        await supabase.from('products').insert(newProd);
      } else {
        const { data: product } = await supabase.from('products').select('current_stock').eq('id', item.id).single();
        if (product) {
          await supabase.from('products').update({
            current_stock: Number(product.current_stock) + Number(item.quantity)
          }).eq('id', item.id);
        }
      }
    }
  } catch (e) {
    console.error('Errore completeTransitOrderWithScan', e);
  }
};

// --- LOGICA BOZZE ---
export const getDraftOrders = async () => {
  try {
    const products = await getProducts();
    const transitOrders = await getTransitOrders();

    const productsInTransit = new Set();
    transitOrders.forEach(order => {
      (order.items || []).forEach(item => productsInTransit.add(item.id));
    });

    const ordersBySupplier = {};

    products.forEach(p => {
      if (productsInTransit.has(p.id)) return;

      if (p.current_stock <= p.min_threshold * 1.5) {
        if (!ordersBySupplier[p.supplier_id]) {
          const stableNum = (p.supplier_id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 1000;
          const today = new Date();
          const day = String(today.getDate()).padStart(2, '0');
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const year = today.getFullYear();

          ordersBySupplier[p.supplier_id] = {
            id: `ORD-${day}-${month}-${year}-${stableNum}`,
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
  } catch (e) {
    console.error('Errore getDraftOrders', e);
    return [];
  }
};

// --- LOGICA CHIAVE API GEMINI (rimane in locale) ---
const API_KEY_STORAGE = '@panino_custom_api_key';
const API_MODEL_STORAGE = '@panino_custom_api_model';

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
    console.error('Errore salvataggio API Key', e);
  }
};

export const getCustomModel = async () => {
  try {
    return await AsyncStorage.getItem(API_MODEL_STORAGE);
  } catch (e) {
    return null;
  }
};

export const saveCustomModel = async (model) => {
  try {
    if (model && model.trim() !== '') {
      await AsyncStorage.setItem(API_MODEL_STORAGE, model.trim());
    } else {
      await AsyncStorage.removeItem(API_MODEL_STORAGE);
    }
  } catch (e) {
    console.error('Errore salvataggio Modello', e);
  }
};