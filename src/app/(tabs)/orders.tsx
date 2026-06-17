import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../../auth';
import { scanDeliveryNote } from '../../ai';
import { addTransitOrder, completeTransitOrder, completeTransitOrderWithScan, getDraftOrders, getProducts, getSuppliers, getTransitOrders } from '../../db';
import { supabase } from '../../supabase';

const ICON_NAMES = [
  'baby-care', 'bakery-shop', 'bread', 'canned-food', 'catering', 'cigarette', 'cleaning-products', 'coffee', 'dairy-products', 'fast-food', 'groceries', 'liquor', 'meat', 'medicine', 'pantry', 'personal-care', 'pet-food', 'seafood', 'soft-drink', 'sweet', 'takeaway'
];

export default function OrdersScreen() {
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER' || user?.role === 'PROPRIETARIO';

  const [activeTab, setActiveTab] = useState<'drafts' | 'transit'>('drafts');

  const [draftOrders, setDraftOrders] = useState<any[]>([]);
  const [transitOrders, setTransitOrders] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [supplierChannels, setSupplierChannels] = useState<Record<string, string>>({});
  const [supplierPhones, setSupplierPhones] = useState<Record<string, string>>({});
  const [supplierEmails, setSupplierEmails] = useState<Record<string, string>>({});

  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [isPreviewModalVisible, setPreviewModalVisible] = useState(false);
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  // --- STATI PER LA SCANSIONE BOLLA ---
  const [isScanning, setIsScanning] = useState(false);
  const [isScanReviewModalVisible, setIsScanReviewModalVisible] = useState(false);
  const [scannedItems, setScannedItems] = useState<any[]>([]);

  const [localeName, setLocaleName] = useState('Panino');

  useFocusEffect(
    React.useCallback(() => {
      if (user?.locale_id) {
        loadData();
      }
    }, [user?.locale_id])
  );

  const loadData = async () => {
    const drafts = await getDraftOrders();
    const transit = await getTransitOrders();
    const products = await getProducts();
    setDraftOrders(drafts);
    setTransitOrders(transit);
    setAllProducts(products);

    if (user?.locale_id) {
      const { data } = await supabase.from('locali').select('name').eq('id', user.locale_id).single();
      if (data) setLocaleName(data.name);
    }

    try {
      const suppliers = await getSuppliers();
      const channels: Record<string, string> = {};
      const phones: Record<string, string> = {};
      const emails: Record<string, string> = {};

      suppliers.forEach((s: any) => {
        channels[s.name] = s.channel || 'WhatsApp';
        if (s.phone) phones[s.name] = s.phone;
        if (s.email) emails[s.name] = s.email;
      });

      setSupplierChannels(channels);
      setSupplierPhones(phones);
      setSupplierEmails(emails);
    } catch (e) {
      console.error('Errore nel caricamento canali', e);
    } finally {
      setIsInitialLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const generateOrderText = (order: any) => {
    let text = `Buongiorno, *${order.supplierName}*.\n\nDi seguito il nostro ordine ${order.id}:\n\n`;
    order.items.forEach((item: any) => {
      text += `- ${item.name} — *${parseFloat(Number(item.orderQuantity).toFixed(2))} ${item.unit}*\n`;
    });
    text += `\nGrazie,\nIl Gestore`;
    return text;
  };

  const handleCopy = async (order: any) => {
    const text = generateOrderText(order);
    await Clipboard.setStringAsync(text);
    showToast("✅ Copiato negli appunti");
  };

  const handleSendOrder = async (order: any) => {
    const channel = supplierChannels[order.supplierName] || 'WhatsApp';
    const text = encodeURIComponent(generateOrderText(order));
    const phone = supplierPhones[order.supplierName] || '';
    const email = supplierEmails[order.supplierName] || '';

    let url = '';
    if (channel === 'WhatsApp') {
      const cleanPhone = phone.replace(/[^0-9+]/g, '');
      url = cleanPhone ? `whatsapp://send?phone=${cleanPhone}&text=${text}` : `whatsapp://send?text=${text}`;
    } else if (channel === 'Email') {
      const subject = encodeURIComponent(`Ordine ${localeName}`);
      url = email ? `mailto:${email}?subject=${subject}&body=${text}` : `mailto:?subject=${subject}&body=${text}`;
    } else if (channel === 'Telefono') {
      await Clipboard.setStringAsync(generateOrderText(order));
      showToast("✅ Testo ordine copiato negli appunti!");
      url = `tel:${phone}`;
    } else {
      await Clipboard.setStringAsync(generateOrderText(order));
      showToast("✅ Testo ordine copiato negli appunti!");
    }

    if (url) {
      Linking.openURL(url).catch(() => {
        showToast(`❌ Impossibile aprire ${channel}.`);
      });
    }

    await addTransitOrder(order);
    await loadData();

    setPreviewModalVisible(false);
    setActiveTab('transit');
    showToast("🚀 Ordine in transito!");
  };

  // Conferma CIECA classica
  const handleOrderDelivered = async (order: any) => {
    await completeTransitOrder(order.id, order.items);
    await loadData();
    showToast("📦 Merce caricata in magazzino!");
  };

  // --- LOGICA FOTOCAMERA E INTELLIGENZA ARTIFICIALE ---
  const handleScanBolla = async (order: any) => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permesso negato", "L'accesso alla fotocamera è necessario per leggere i documenti.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.6, // Compresso per velocizzare l'upload all'IA
    });

    if (!result.canceled && result.assets[0].base64) {
      setActiveOrder(order);
      setIsScanning(true);

      const uniqueCategories = Array.from(new Set(allProducts.map(p => p.category).filter(c => c)));

      const aiResult = await scanDeliveryNote(
        result.assets[0].base64,
        result.assets[0].mimeType || 'image/jpeg',
        allProducts,
        order.supplierName,
        uniqueCategories,
        ICON_NAMES
      );

      if (aiResult && aiResult.items) {
        // Formattiamo per aggiungere i campi input locali per i NUOVI prodotti
        const formatted = aiResult.items.map((item: any) => ({
          ...item,
          minThreshold: item.isNew ? '5' : undefined,
          maxThreshold: item.isNew ? '20' : undefined
        }));
        setScannedItems(formatted);
        setIsScanReviewModalVisible(true);
      } else {
        Alert.alert("Errore", "L'IA è sovraccarica o non è riuscita a leggere la bolla. Riprova o usa la conferma manuale.");
      }
      setIsScanning(false);
    }
  };

  // Funzione generica per aggiornare qualsiasi campo della scansione
  const updateScannedItem = (index: number, field: string, value: any) => {
    const updated = [...scannedItems];
    updated[index][field] = value;
    setScannedItems(updated);
  };

  const confirmScannedDelivery = async () => {
    setIsScanning(true);

    // Assicuriamoci che la quantità sia sempre un numero valido (fallback a 0 se vuoto) prima di salvare
    const sanitizedItems = scannedItems.map(item => ({
      ...item,
      quantity: Number(item.quantity) || 0
    }));

    await completeTransitOrderWithScan(activeOrder.id, sanitizedItems, activeOrder.supplierName);
    setIsScanReviewModalVisible(false);
    setIsScanning(false);
    await loadData();
    showToast("📸 Merce scansionata caricata con successo!");
  };

  // --- LOGICA EDIT BOZZE ---
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
    if (activeOrder.items.length === 0) { deleteOrder(); return; }
    const newOrders = draftOrders.map(o => o.id === activeOrder.id ? activeOrder : o);
    setDraftOrders(newOrders);
    setEditModalVisible(false);
  };
  const deleteOrder = () => {
    const newOrders = draftOrders.filter(o => o.id !== activeOrder?.id);
    setDraftOrders(newOrders);
    setEditModalVisible(false);
  };

  const availableToAdd = activeOrder ? allProducts.filter(p => p.supplier_id === activeOrder.supplierName && !activeOrder.items.some((item: any) => item.id === p.id)) : [];
  const currentList = activeTab === 'drafts' ? draftOrders : transitOrders;

  const renderOrderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderId}>{item.display_id || item.id}</Text>
          <Text style={styles.orderDate}>Creato il {item.date}</Text>
        </View>
        <View style={[styles.badge, activeTab === 'transit' ? styles.badgeTransit : styles.badgeDraft]}>
          <Text style={[styles.badgeText, activeTab === 'transit' && { color: '#B95000' }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.supplierTitle}>{item.supplierName.toUpperCase()}</Text>
      <View style={styles.itemsPreview}>
        {item.items.slice(0, 3).map((prod: any, idx: number) => (
          <View key={idx} style={styles.previewRow}>
            <Text style={styles.previewName}>{prod.name}</Text>
            <Text style={styles.previewQty}>x{parseFloat(Number(prod.orderQuantity).toFixed(2))} {prod.unit}</Text>
          </View>
        ))}
        {item.items.length > 3 && (
          <Text style={styles.moreItemsText}>+{item.items.length - 3} altri articoli</Text>
        )}
      </View>

      {activeTab === 'drafts' ? (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.btnOutline} onPress={() => handleCopy(item)}>
            <Ionicons name="copy-outline" size={16} color="#000" style={{ marginRight: 4 }} />
            <Text style={styles.btnOutlineText}>Copia</Text>
          </TouchableOpacity>
          {isManager && (
            <>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => openEdit(item)}>
                <Ionicons name="pencil" size={16} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={styles.btnPrimaryText}>Modifica</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: '#8DA67F' }]} onPress={() => { setActiveOrder(item); setPreviewModalVisible(true); }}>
                <Ionicons name="paper-plane-outline" size={16} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={styles.btnPrimaryText}>Invia</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.btnOutline} onPress={() => { setActiveOrder(item); setPreviewModalVisible(true); }}>
            <Ionicons name="eye-outline" size={16} color="#000" style={{ marginRight: 4 }} />
            <Text style={styles.btnOutlineText}>Vedi</Text>
          </TouchableOpacity>

          {isManager && (
            <>
              <TouchableOpacity style={[styles.btnDark, { backgroundColor: '#DB7F18' }]} onPress={() => handleScanBolla(item)}>
                <Ionicons name="camera-outline" size={16} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={styles.btnDarkText}>Bolla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: '#8DA67F' }]} onPress={() => handleOrderDelivered(item)}>
                <Ionicons name="checkmark-done" size={16} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={styles.btnPrimaryText}>Conferma</Text>
              </TouchableOpacity>
            </>
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

      <View style={styles.segmentContainer}>
        <TouchableOpacity style={[styles.segmentBtn, activeTab === 'drafts' && styles.segmentActive]} onPress={() => setActiveTab('drafts')}>
          <Text style={[styles.segmentText, activeTab === 'drafts' && styles.segmentTextActive]}>Da Effettuare ({draftOrders.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.segmentBtn, activeTab === 'transit' && styles.segmentActive]} onPress={() => setActiveTab('transit')}>
          <Text style={[styles.segmentText, activeTab === 'transit' && styles.segmentTextActive]}>In Transito ({transitOrders.length})</Text>
        </TouchableOpacity>
      </View>

      {isInitialLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#DB7F18" />
        </View>
      ) : currentList.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ color: '#666' }}>Nessun ordine in questa sezione.</Text>
        </View>
      ) : (
        <FlatList data={currentList} keyExtractor={item => item.id} renderItem={renderOrderItem} contentContainerStyle={styles.listContainer} />
      )}

      {/* OVERLAY DI CARICAMENTO DURANTE LA SCANSIONE IA */}
      {isScanning && (
        <View style={styles.fullScreenLoader}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={{ color: '#FFF', marginTop: 12, fontWeight: 'bold' }}>Elaborazione in corso...</Text>
        </View>
      )}

      {toastMsg && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}

      {/* MODALE: REVISIONE BOLLA SCANSIONATA DALL'IA */}
      <Modal visible={isScanReviewModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsScanReviewModalVisible(false)}><Ionicons name="close" size={28} color="#000" /></TouchableOpacity>
            <Text style={styles.modalTitle}>Riepilogo Bolla IA</Text>
            <View style={{ width: 28 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={{ marginBottom: 16, color: '#666' }}>Controlla le quantità lette dall'IA. I prodotti nuovi richiedono le soglie Min e Max.</Text>

            {scannedItems.map((item, idx) => (
              <View key={idx} style={[styles.scannedItemBox, item.isNew && styles.scannedItemBoxNew]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#111' }}>{item.name}</Text>
                    {item.isNew && <Text style={{ color: '#DB7F18', fontSize: 12, fontWeight: '600', marginTop: 2 }}>✨ Nuovo • {item.category || 'Generico'}</Text>}
                  </View>

                  {/* EDIT QUANTITÀ DIRETTO */}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#8DA67F' }}>+</Text>
                    <TextInput
                      style={[styles.smallInput, { width: 50, textAlign: 'center', marginHorizontal: 4, paddingVertical: 6, fontSize: 16, fontWeight: 'bold', color: '#8DA67F' }]}
                      keyboardType="numeric"
                      value={String(parseFloat(Number(item.quantity).toFixed(2)))}
                      onChangeText={(t) => {
                        const numericVal = parseFloat(t.replace(',', '.').replace(/[^0-9.-]/g, ''));
                        updateScannedItem(idx, 'quantity', isNaN(numericVal) ? '' : numericVal);
                      }}
                    />
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#8DA67F' }}>{item.unit}</Text>
                  </View>
                </View>

                {item.isNew && (
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Soglia Min</Text>
                      <TextInput style={styles.smallInput} keyboardType="numeric" value={item.minThreshold} onChangeText={(t) => updateScannedItem(idx, 'minThreshold', t)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Soglia Max</Text>
                      <TextInput style={styles.smallInput} keyboardType="numeric" value={item.maxThreshold} onChangeText={(t) => updateScannedItem(idx, 'maxThreshold', t)} />
                    </View>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.btnPrimary, { flex: 0, width: '100%', paddingVertical: 16, justifyContent: 'center' }]} onPress={confirmScannedDelivery}>
              <Text style={[styles.btnPrimaryText, { fontSize: 16 }]}>Conferma Carico Merce</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* MODALE: MODIFICA BOZZA */}
      <Modal visible={isEditModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}><Ionicons name="chevron-back" size={28} color="#000" /></TouchableOpacity>
            <Text style={styles.modalTitle}>Modifica ordine</Text>
            <TouchableOpacity onPress={deleteOrder}><Ionicons name="trash-outline" size={24} color="#D93025" /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {activeOrder?.items.map((item: any, idx: number) => (
              <View key={idx} style={styles.editItemRow}>
                <Text style={styles.editItemName} numberOfLines={2}>{item.name}</Text>
                <View style={styles.editControls}>
                  <View style={styles.stepper}>
                    <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustEditQuantity(idx, -1)}><Text style={styles.stepperText}>-</Text></TouchableOpacity>
                    <Text style={styles.stepperValue}>{parseFloat(Number(item.orderQuantity).toFixed(2))}</Text>
                    <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustEditQuantity(idx, 1)}><Text style={styles.stepperText}>+</Text></TouchableOpacity>
                  </View>
                  <Text style={styles.editUnit}>{item.unit}</Text>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeEditItem(idx)}><Ionicons name="close-outline" size={20} color="#D93025" /></TouchableOpacity>
                </View>
              </View>
            ))}
            {!isAddingProduct ? (
              <TouchableOpacity style={styles.btnAddProduct} onPress={() => setIsAddingProduct(true)}>
                <Ionicons name="add-outline" size={20} color="#DB7F18" />
                <Text style={styles.btnAddProductText}>Aggiungi prodotto</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.addProductsList}>
                <Text style={styles.addProductsTitle}>Seleziona prodotto:</Text>
                {availableToAdd.length > 0 ? (
                  availableToAdd.map((p, idx) => (
                    <TouchableOpacity key={idx} style={styles.addProductItem} onPress={() => addEditItem(p)}>
                      <Text>{p.name}</Text>
                      <Ionicons name="add-circle-outline" size={24} color="#DB7F18" />
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={{ color: '#666', fontStyle: 'italic', paddingVertical: 8, textAlign: 'center' }}>Tutti i prodotti del fornitore sono già nell'ordine.</Text>
                )}
                <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setIsAddingProduct(false)}>
                  <Text style={{ color: '#666', fontWeight: 'bold' }}>Chiudi</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.btnPrimary, { flex: 0, width: '100%', paddingVertical: 16, justifyContent: 'center' }]} onPress={saveEdit}>
              <Text style={[styles.btnPrimaryText, { fontSize: 16 }]}>Salva modifiche</Text>
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
            <View style={{ width: 28 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.sectionLabel}>CANALE DI INVIO</Text>
            <View style={styles.channelBox}>
              {(() => {
                const ch = activeOrder ? (supplierChannels[activeOrder.supplierName] || 'WhatsApp') : 'WhatsApp';
                let iconName = 'logo-whatsapp';
                let iconColor = '#25D366';
                if (ch === 'Email') { iconName = 'mail'; iconColor = '#D93025'; }
                else if (ch === 'Telefono') { iconName = 'call'; iconColor = '#1A73E8'; }
                else if (ch !== 'WhatsApp') { iconName = 'chatbubbles'; iconColor = '#666'; }

                return (
                  <>
                    <Ionicons name={iconName as any} size={24} color={iconColor} />
                    <View style={{ marginLeft: 12 }}>
                      <Text style={{ fontWeight: 'bold' }}>{ch}</Text>
                      <Text style={{ fontSize: 12, color: '#666' }}>Fornitore: {activeOrder?.supplierName}</Text>
                    </View>
                  </>
                );
              })()}
            </View>
            <Text style={styles.sectionLabel}>MESSAGGIO</Text>
            <View style={styles.previewTextBox}>
              <Text style={{ fontSize: 15, lineHeight: 22 }}>{activeOrder && generateOrderText(activeOrder)}</Text>
            </View>
          </ScrollView>
          {activeTab === 'drafts' && (
            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.btnDark, { flex: 0, width: '100%', paddingVertical: 16, justifyContent: 'center', flexDirection: 'row' }]} onPress={() => handleSendOrder(activeOrder)}>
                {(() => {
                  const ch = activeOrder ? (supplierChannels[activeOrder.supplierName] || 'WhatsApp') : 'WhatsApp';
                  let iconName = 'logo-whatsapp';
                  if (ch === 'Email') iconName = 'mail';
                  else if (ch === 'Telefono') iconName = 'call';
                  else if (ch !== 'WhatsApp') iconName = 'paper-plane';
                  return <Ionicons name={iconName as any} size={20} color="#FFF" style={{ marginRight: 8 }} />;
                })()}
                <Text style={[styles.btnDarkText, { fontSize: 16 }]}>
                  {activeOrder ? `Invia tramite ${supplierChannels[activeOrder.supplierName] || 'WhatsApp'}` : 'Invia ordine'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F5E6' },
  header: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#eee' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#000' },

  segmentContainer: { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#eee' },
  segmentBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderColor: 'transparent' },
  segmentActive: { borderColor: '#DB7F18' },
  segmentText: { fontWeight: '600', color: '#8E8E93' },
  segmentTextActive: { color: '#DB7F18' },

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
  btnPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, backgroundColor: '#DB7F18' },
  btnPrimaryText: { fontWeight: '600', color: '#FFF' },
  btnDark: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, backgroundColor: '#DB7F18' },
  btnDarkText: { fontWeight: '600', color: '#FFF' },

  toastContainer: { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: '#333', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, elevation: 5 },
  toastText: { color: '#FFF', fontWeight: 'bold' },

  fullScreenLoader: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },

  modalContainer: { flex: 1, backgroundColor: '#F8F5E6' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalFooter: { padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: '#eee' },

  /* Stili Scansione Bolla */
  scannedItemBox: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#EAEAEA', marginBottom: 12 },
  scannedItemBoxNew: { borderColor: '#DB7F18', backgroundColor: '#FFF4EB' },
  smallInput: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CCC', padding: 10, borderRadius: 8, fontSize: 14 },

  editItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 16, marginBottom: 8, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  editItemName: { flex: 1, fontWeight: '500', marginRight: 8 },
  editControls: { flexDirection: 'row', alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F2F5', borderRadius: 8 },
  stepperBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  stepperText: { fontSize: 18, fontWeight: 'bold' },
  stepperValue: { fontWeight: 'bold', minWidth: 20, textAlign: 'center' },
  editUnit: { marginLeft: 8, color: '#666', width: 45 },
  removeBtn: { padding: 8, marginLeft: 4 },

  btnAddProduct: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, marginTop: 8, borderStyle: 'dashed', borderWidth: 1, borderColor: '#DB7F18', borderRadius: 8 },
  btnAddProductText: { color: '#DB7F18', fontWeight: '600', marginLeft: 8 },
  addProductsList: { backgroundColor: '#FFF', padding: 16, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: '#eee' },
  addProductsTitle: { fontWeight: 'bold', marginBottom: 12, color: '#333' },
  addProductItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },

  sectionLabel: { fontSize: 12, color: '#666', marginTop: 16, marginBottom: 8, marginLeft: 4, letterSpacing: 1 },
  channelBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  previewTextBox: { backgroundColor: '#FFF', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#eee', minHeight: 200 }
});