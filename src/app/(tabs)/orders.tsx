import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, Modal, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { getDraftOrders, getTransitOrders, getProducts, addTransitOrder, completeTransitOrder } from '../../db';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../../auth';

export default function OrdersScreen() {
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';

  const [activeTab, setActiveTab] = useState<'drafts' | 'transit'>('drafts');
  
  const [draftOrders, setDraftOrders] = useState<any[]>([]);
  const [transitOrders, setTransitOrders] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [isPreviewModalVisible, setPreviewModalVisible] = useState(false);
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  useFocusEffect(
    React.useCallback(() => { loadData(); }, [])
  );

  const loadData = async () => {
    const drafts = await getDraftOrders();
    const transit = await getTransitOrders();
    const products = await getProducts();
    setDraftOrders(drafts);
    setTransitOrders(transit);
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

  // L'ordine passa in transito!
  const handleSendWhatsApp = async (order: any) => {
    const text = encodeURIComponent(generateOrderText(order));
    Linking.openURL(`whatsapp://send?text=${text}`).catch(() => {
      showToast("❌ WhatsApp non installato.");
    });
    
    await addTransitOrder(order);
    await loadData();
    
    setPreviewModalVisible(false);
    setActiveTab('transit'); // Spostiamo l'utente nella tab dei transiti per fargli vedere dove è finito
    showToast("🚀 Ordine in transito!");
  };

  // La merce è arrivata!
  const handleOrderDelivered = async (order: any) => {
    await completeTransitOrder(order.id, order.items);
    await loadData();
    showToast("📦 Merce caricata in magazzino!");
  };

  const openEdit = (order: any) => {
    setActiveOrder(JSON.parse(JSON.stringify(order))); 
    setIsAddingProduct(false);
    setEditModalVisible(true);
  };

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
    const newOrders = draftOrders.map(o => o.id === activeOrder.id ? activeOrder : o);
    setDraftOrders(newOrders);
    setEditModalVisible(false);
    showToast("💾 Modifiche salvate");
  };

  const deleteOrder = () => {
    const newOrders = draftOrders.filter(o => o.id !== activeOrder?.id);
    setDraftOrders(newOrders);
    setEditModalVisible(false);
    showToast("🗑️ Ordine eliminato");
  };

  const availableToAdd = activeOrder ? allProducts.filter(p => 
    p.supplier_id === activeOrder.supplierName && 
    !activeOrder.items.some((item: any) => item.id === p.id)
  ) : [];

  const currentList = activeTab === 'drafts' ? draftOrders : transitOrders;

  const renderOrderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderId}>{item.id}</Text>
          <Text style={styles.orderDate}>Creato il {item.date}</Text>
        </View>
        <View style={[styles.badge, activeTab === 'transit' ? styles.badgeTransit : styles.badgeDraft]}>
          <Text style={[styles.badgeText, activeTab === 'transit' && {color: '#B95000'}]}>{item.status}</Text>
        </View>
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
      
      {/* BOTTONI DIVERSI IN BASE ALLA TAB */}
      {activeTab === 'drafts' ? (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.btnOutline} onPress={() => handleCopy(item)}>
            <Ionicons name="copy-outline" size={16} color="#000" style={{marginRight: 6}} />
            <Text style={styles.btnOutlineText}>Copia</Text>
          </TouchableOpacity>
          
          {/* Mostriamo questi bottoni SOLO se è MANAGER */}
          {isManager && (
            <>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => openEdit(item)}>
                <Ionicons name="pencil" size={16} color="#FFF" style={{marginRight: 6}} />
                <Text style={styles.btnPrimaryText}>Modifica</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnDark} onPress={() => { setActiveOrder(item); setPreviewModalVisible(true); }}>
                <Ionicons name="paper-plane-outline" size={16} color="#FFF" style={{marginRight: 6}} />
                <Text style={styles.btnDarkText}>Vedi</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <View style={styles.actionsRow}>
          {/* Lo Staff può solo visualizzare cosa è in transito */}
          <TouchableOpacity style={styles.btnOutline} onPress={() => { setActiveOrder(item); setPreviewModalVisible(true); }}>
            <Ionicons name="eye-outline" size={16} color="#000" style={{marginRight: 6}} />
            <Text style={styles.btnOutlineText}>Vedi Ordine</Text>
          </TouchableOpacity>
          
          {/* Solo il MANAGER può confermare l'arrivo della merce */}
          {isManager && (
            <TouchableOpacity style={[styles.btnPrimary, {backgroundColor: '#1E8E3E'}]} onPress={() => handleOrderDelivered(item)}>
              <Ionicons name="checkmark-done" size={16} color="#FFF" style={{marginRight: 6}} />
              <Text style={styles.btnPrimaryText}>Segna Consegnato</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestione Ordini</Text>
      </View>

      {/* SELETTORE TAB */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity style={[styles.segmentBtn, activeTab === 'drafts' && styles.segmentActive]} onPress={() => setActiveTab('drafts')}>
          <Text style={[styles.segmentText, activeTab === 'drafts' && styles.segmentTextActive]}>Da Effettuare ({draftOrders.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.segmentBtn, activeTab === 'transit' && styles.segmentActive]} onPress={() => setActiveTab('transit')}>
          <Text style={[styles.segmentText, activeTab === 'transit' && styles.segmentTextActive]}>In Transito ({transitOrders.length})</Text>
        </TouchableOpacity>
      </View>
      
      {currentList.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{color: '#666'}}>Nessun ordine in questa sezione.</Text>
        </View>
      ) : (
        <FlatList data={currentList} keyExtractor={item => item.id} renderItem={renderOrderItem} contentContainerStyle={styles.listContainer} />
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

            {!isAddingProduct ? (
              <TouchableOpacity style={styles.btnAddProduct} onPress={() => setIsAddingProduct(true)}>
                <Ionicons name="add-outline" size={20} color="#0052FF" />
                <Text style={styles.btnAddProductText}>Aggiungi prodotto</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.addProductsList}>
                <Text style={styles.addProductsTitle}>Seleziona prodotto:</Text>
                
                {availableToAdd.length > 0 ? (
                  availableToAdd.map((p, idx) => (
                    <TouchableOpacity key={idx} style={styles.addProductItem} onPress={() => addEditItem(p)}>
                      <Text>{p.name}</Text>
                      <Ionicons name="add-circle-outline" size={24} color="#0052FF" />
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={{color: '#666', fontStyle: 'italic', paddingVertical: 8, textAlign: 'center'}}>
                    Tutti i prodotti del fornitore sono già nell'ordine.
                  </Text>
                )}
                
                <TouchableOpacity style={{marginTop: 12, alignItems: 'center'}} onPress={() => setIsAddingProduct(false)}>
                  <Text style={{color: '#666', fontWeight: 'bold'}}>Chiudi</Text>
                </TouchableOpacity>
              </View>
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
            <Text style={styles.modalTitle}>{activeTab === 'drafts' ? 'Invia ordine' : 'Dettaglio ordine'}</Text>
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

            <Text style={styles.sectionLabel}>MESSAGGIO</Text>
            <View style={styles.previewTextBox}>
              <Text style={{fontSize: 15, lineHeight: 22}}>{activeOrder && generateOrderText(activeOrder)}</Text>
            </View>
          </ScrollView>

          {activeTab === 'drafts' && (
            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.btnDark, { flex: 0, width: '100%', paddingVertical: 16, justifyContent: 'center', flexDirection: 'row'}]} onPress={() => handleSendWhatsApp(activeOrder)}>
                  <Ionicons name="logo-whatsapp" size={20} color="#FFF" style={{marginRight: 8}} />
                  <Text style={[styles.btnDarkText, {fontSize: 16}]}>Invia su WhatsApp</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#eee' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  
  segmentContainer: { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#eee' },
  segmentBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderColor: 'transparent' },
  segmentActive: { borderColor: '#0052FF' },
  segmentText: { fontWeight: '600', color: '#8E8E93' },
  segmentTextActive: { color: '#0052FF' },

  listContainer: { padding: 16 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  card: { backgroundColor: '#FFFFFF', padding: 16, marginBottom: 16, borderRadius: 12, borderWidth: 1, borderColor: '#EAEAEA' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  orderId: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  orderDate: { fontSize: 12, color: '#666', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, height: 24, justifyContent: 'center' },
  badgeDraft: { backgroundColor: '#E8F0FE' },
  badgeTransit: { backgroundColor: '#FEF0DB' },
  badgeText: { color: '#1A73E8', fontSize: 11, fontWeight: 'bold' },
  
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

  toastContainer: { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: '#333', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, elevation: 5 },
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
  editUnit: { marginLeft: 8, color: '#666', width: 45 },
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