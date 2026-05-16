import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, Modal, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { getDraftOrders, getProducts } from '../db';
import { useFocusEffect } from '@react-navigation/native';

export default function OrdersScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  
  // Stati per i Modali
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [isPreviewModalVisible, setPreviewModalVisible] = useState(false);
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  useFocusEffect(
    React.useCallback(() => { loadData(); }, [])
  );

  const loadData = async () => {
    const draftOrders = await getDraftOrders();
    const products = await getProducts();
    setOrders(draftOrders);
    setAllProducts(products);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const generateOrderText = (order: any) => {
    let text = `Buongiorno, *${order.supplierName}*.\n\nDi seguito il nostro ordine ${order.id}:\n\n`;
    order.items.forEach((item: any) => {
      text += `- ${item.name} — *${item.orderQuantity} ${item.unit}*\n`;
    });
    text += `\nGrazie,\nIl Gestore`;
    return text;
  };

  const handleCopy = async (order: any) => {
    const text = generateOrderText(order);
    await Clipboard.setStringAsync(text);
    showToast("✅ Ordine copiato negli appunti");
  };

  const handleSendWhatsApp = (order: any) => {
    const text = encodeURIComponent(generateOrderText(order));
    Linking.openURL(`whatsapp://send?text=${text}`).catch(() => {
      showToast("❌ WhatsApp non installato.");
    });
    setPreviewModalVisible(false);
    showToast("🚀 Ordine inviato");
  };

  const openEdit = (order: any) => {
    setActiveOrder(JSON.parse(JSON.stringify(order))); 
    setIsAddingProduct(false);
    setEditModalVisible(true);
  };

  // Funzioni di Modifica Ordine
  const adjustEditQuantity = (idx: number, delta: number) => {
    const updated = { ...activeOrder };
    updated.items[idx].orderQuantity = Math.max(1, updated.items[idx].orderQuantity + delta);
    setActiveOrder(updated);
  };

  const removeEditItem = (idx: number) => {
    const updated = { ...activeOrder };
    updated.items.splice(idx, 1);
    setActiveOrder(updated);
  };

  const addEditItem = (product: any) => {
    const updated = { ...activeOrder };
    updated.items.push({ ...product, orderQuantity: 1 });
    setActiveOrder(updated);
    setIsAddingProduct(false);
  };

  const saveEdit = () => {
    if (activeOrder.items.length === 0) {
      deleteOrder();
      return;
    }
    const newOrders = orders.map(o => o.id === activeOrder.id ? activeOrder : o);
    setOrders(newOrders);
    setEditModalVisible(false);
    showToast("💾 Modifiche salvate");
  };

  const deleteOrder = () => {
    const newOrders = orders.filter(o => o.id !== activeOrder?.id);
    setOrders(newOrders);
    setEditModalVisible(false);
    showToast("🗑️ Ordine eliminato");
  };

  // Calcola i prodotti disponibili da aggiungere a questo ordine
  const availableToAdd = activeOrder ? allProducts.filter(p => 
    p.supplier_id === activeOrder.supplierName && 
    !activeOrder.items.some((item: any) => item.id === p.id)
  ) : [];

  const renderOrderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderId}>{item.id}</Text>
          <Text style={styles.orderDate}>Creato il {item.date}</Text>
        </View>
        <View style={styles.badgeBozza}><Text style={styles.badgeBozzaText}>{item.status}</Text></View>
      </View>
      <Text style={styles.supplierTitle}>{item.supplierName.toUpperCase()}</Text>
      <View style={styles.itemsPreview}>
        {item.items.slice(0, 3).map((prod: any, idx: number) => (
          <View key={idx} style={styles.previewRow}>
            <Text style={styles.previewName}>{prod.name}</Text>
            <Text style={styles.previewQty}>x{prod.orderQuantity} {prod.unit}</Text>
          </View>
        ))}
        {item.items.length > 3 && (
          <Text style={styles.moreItemsText}>+{item.items.length - 3} altri articoli</Text>
        )}
      </View>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.btnOutline} onPress={() => handleCopy(item)}>
          <Ionicons name="copy-outline" size={16} color="#000" style={{marginRight: 6}} />
          <Text style={styles.btnOutlineText}>Copia</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => openEdit(item)}>
          <Ionicons name="pencil" size={16} color="#FFF" style={{marginRight: 6}} />
          <Text style={styles.btnPrimaryText}>Modifica</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnDark} onPress={() => { setActiveOrder(item); setPreviewModalVisible(true); }}>
          <Ionicons name="paper-plane-outline" size={16} color="#FFF" style={{marginRight: 6}} />
          <Text style={styles.btnDarkText}>Vedi</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Liste Ordini ({orders.length})</Text>
      </View>
      
      {orders.length === 0 ? (
        <View style={styles.emptyState}><Text style={{color: '#666'}}>Nessun ordine in bozza.</Text></View>
      ) : (
        <FlatList data={orders} keyExtractor={item => item.id} renderItem={renderOrderItem} contentContainerStyle={styles.listContainer} />
      )}

      {toastMsg && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}

      {/* MODALE: MODIFICA */}
      <Modal visible={isEditModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}><Ionicons name="chevron-back" size={28} color="#000" /></TouchableOpacity>
            <Text style={styles.modalTitle}>Modifica ordine</Text>
            <TouchableOpacity onPress={deleteOrder}><Ionicons name="trash-outline" size={24} color="#D93025" /></TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={{padding: 16}}>
            {activeOrder?.items.map((item: any, idx: number) => (
              <View key={idx} style={styles.editItemRow}>
                <Text style={styles.editItemName} numberOfLines={2}>{item.name}</Text>
                
                <View style={styles.editControls}>
                  <View style={styles.stepper}>
                    <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustEditQuantity(idx, -1)}>
                      <Text style={styles.stepperText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{item.orderQuantity}</Text>
                    <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustEditQuantity(idx, 1)}>
                      <Text style={styles.stepperText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.editUnit}>{item.unit}</Text>
                  
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeEditItem(idx)}>
                    <Ionicons name="close-outline" size={20} color="#D93025" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* SEZIONE AGGIUNGI PRODOTTO */}
            {availableToAdd.length > 0 && (
              !isAddingProduct ? (
                <TouchableOpacity style={styles.btnAddProduct} onPress={() => setIsAddingProduct(true)}>
                  <Ionicons name="add-outline" size={20} color="#0052FF" />
                  <Text style={styles.btnAddProductText}>Aggiungi prodotto</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.addProductsList}>
                  <Text style={styles.addProductsTitle}>Seleziona prodotto:</Text>
                  {availableToAdd.map((p, idx) => (
                    <TouchableOpacity key={idx} style={styles.addProductItem} onPress={() => addEditItem(p)}>
                      <Text>{p.name}</Text>
                      <Ionicons name="add-circle-outline" size={24} color="#0052FF" />
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={{marginTop: 12, alignItems: 'center'}} onPress={() => setIsAddingProduct(false)}>
                    <Text style={{color: '#666'}}>Annulla</Text>
                  </TouchableOpacity>
                </View>
              )
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
             <TouchableOpacity style={[styles.btnPrimary, { flex: 0, width: '100%', paddingVertical: 16, justifyContent: 'center'}]} onPress={saveEdit}>
                <Text style={[styles.btnPrimaryText, {fontSize: 16}]}>Salva modifiche</Text>
             </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* MODALE: VEDI / INVIA */}
      <Modal visible={isPreviewModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPreviewModalVisible(false)}><Ionicons name="chevron-back" size={28} color="#000" /></TouchableOpacity>
            <Text style={styles.modalTitle}>Invia ordine</Text>
            <View style={{width: 28}} />
          </View>
          
          <ScrollView contentContainerStyle={{padding: 16}}>
            <Text style={styles.sectionLabel}>CANALE DI INVIO</Text>
            <View style={styles.channelBox}>
              <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
              <View style={{marginLeft: 12}}>
                <Text style={{fontWeight: 'bold'}}>WhatsApp</Text>
                <Text style={{fontSize: 12, color: '#666'}}>Fornitore: {activeOrder?.supplierName}</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>ANTEPRIMA MESSAGGIO</Text>
            <View style={styles.previewTextBox}>
              <Text style={{fontSize: 15, lineHeight: 22}}>{activeOrder && generateOrderText(activeOrder)}</Text>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
             <TouchableOpacity style={[styles.btnDark, { flex: 0, width: '100%', paddingVertical: 16, justifyContent: 'center', flexDirection: 'row'}]} onPress={() => handleSendWhatsApp(activeOrder)}>
                <Ionicons name="logo-whatsapp" size={20} color="#FFF" style={{marginRight: 8}} />
                <Text style={[styles.btnDarkText, {fontSize: 16}]}>Invia su WhatsApp</Text>
             </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#eee' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  listContainer: { padding: 16 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  card: { backgroundColor: '#FFFFFF', padding: 16, marginBottom: 16, borderRadius: 12, borderWidth: 1, borderColor: '#EAEAEA' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  orderId: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  orderDate: { fontSize: 12, color: '#666', marginTop: 2 },
  badgeBozza: { backgroundColor: '#E8F0FE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, height: 24, justifyContent: 'center' },
  badgeBozzaText: { color: '#1A73E8', fontSize: 11, fontWeight: 'bold' },
  
  supplierTitle: { fontSize: 12, color: '#666', letterSpacing: 1, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingBottom: 8 },
  itemsPreview: { marginBottom: 16 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  previewName: { color: '#333', flex: 1 },
  previewQty: { fontWeight: 'bold', color: '#111' },
  moreItemsText: { color: '#1A73E8', fontSize: 12, fontWeight: '600', marginTop: 4, textAlign: 'right' },
  
  actionsRow: { flexDirection: 'row', gap: 8 },
  btnOutline: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#CCC' },
  btnOutlineText: { fontWeight: '600', color: '#333' },
  btnPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, backgroundColor: '#0052FF' },
  btnPrimaryText: { fontWeight: '600', color: '#FFF' },
  btnDark: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, backgroundColor: '#0B132B' },
  btnDarkText: { fontWeight: '600', color: '#FFF' },

  toastContainer: { position: 'absolute', bottom: 100, alignSelf: 'center', backgroundColor: '#333', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, elevation: 5 },
  toastText: { color: '#FFF', fontWeight: 'bold' },

  modalContainer: { flex: 1, backgroundColor: '#F8F9FA' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalFooter: { padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: '#eee' },
  
  editItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 16, marginBottom: 8, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  editItemName: { flex: 1, fontWeight: '500', marginRight: 8 },
  editControls: { flexDirection: 'row', alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F2F5', borderRadius: 8 },
  stepperBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  stepperText: { fontSize: 18, fontWeight: 'bold' },
  stepperValue: { fontWeight: 'bold', minWidth: 20, textAlign: 'center' },
  editUnit: { marginLeft: 8, color: '#666', width: 30 },
  removeBtn: { padding: 8, marginLeft: 4 },

  btnAddProduct: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, marginTop: 8, borderStyle: 'dashed', borderWidth: 1, borderColor: '#0052FF', borderRadius: 8 },
  btnAddProductText: { color: '#0052FF', fontWeight: '600', marginLeft: 8 },
  addProductsList: { backgroundColor: '#FFF', padding: 16, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: '#eee' },
  addProductsTitle: { fontWeight: 'bold', marginBottom: 12, color: '#333' },
  addProductItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },

  sectionLabel: { fontSize: 12, color: '#666', marginTop: 16, marginBottom: 8, marginLeft: 4, letterSpacing: 1 },
  channelBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  previewTextBox: { backgroundColor: '#FFF', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#eee', minHeight: 200 }
});