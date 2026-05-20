import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../../auth';
import { addProduct, deleteProduct, getProducts, updateProductSupplier } from '../../db';

export default function WarehouseScreen() {
  const { user, logout } = useAuth();
  const isManager = user?.role === 'MANAGER';

  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Stati UI
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'products' | 'suppliers'>('products');
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string | null>(null);

  // Stati Modali
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isSupplierModalVisible, setIsSupplierModalVisible] = useState(false);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);

  // Stato Form Nuovo Prodotto
  const [newProd, setNewProd] = useState({ name: '', min: '', max: '', unit: 'pz.', supplier: '', isNewSupplier: false, commChannel: 'WhatsApp' });
  const [newSupplierName, setNewSupplierName] = useState(''); // Per il cambio fornitore rapido

  useFocusEffect(
    React.useCallback(() => { loadData(); }, [])
  );

  const loadData = async () => {
    const data = await getProducts();
    setProducts(data);
  };

  // --- LOGICA DATI E FILTRI ---
  const uniqueSuppliers = useMemo(() => {
    const suppliersObj: Record<string, number> = {};
    products.forEach(p => {
      suppliersObj[p.supplier_id] = (suppliersObj[p.supplier_id] || 0) + 1;
    });
    return Object.keys(suppliersObj).map(key => ({ name: key, count: suppliersObj[key] }));
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.supplier_id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSupplier = selectedSupplierFilter ? p.supplier_id === selectedSupplierFilter : true;
      return matchesSearch && matchesSupplier;
    });
  }, [products, searchQuery, selectedSupplierFilter]);

  // --- AZIONI MANAGER ---
  const handleMenuAction = (action: 'edit' | 'suppliers' | 'products') => {
    setIsMenuOpen(false);
    if (action === 'edit') {
      setIsEditMode(!isEditMode);
      setViewMode('products');
      setSelectedSupplierFilter(null);
    } else if (action === 'suppliers') {
      setIsEditMode(false);
      setViewMode('suppliers');
      setSelectedSupplierFilter(null);
    } else {
      setIsEditMode(false);
      setViewMode('products');
      setSelectedSupplierFilter(null);
    }
  };

  const confirmDelete = (item: any) => {
    Alert.alert(
      "Elimina Prodotto",
      `Vuoi davvero eliminare ${item.name} dal magazzino?`,
      [
        { text: "Annulla", style: "cancel" },
        { text: "Conferma", style: "destructive", onPress: async () => {
            await deleteProduct(item.id);
            loadData();
          }
        }
      ]
    );
  };

  const handleSaveNewProduct = async () => {
    if (!newProd.name || !newProd.min || !newProd.max || !newProd.supplier) {
      Alert.alert("Errore", "Compila tutti i campi obbligatori.");
      return;
    }
    await addProduct({
      name: newProd.name,
      min_threshold: parseInt(newProd.min),
      max_threshold: parseInt(newProd.max),
      unit: newProd.unit,
      supplier_id: newProd.supplier
    });
    setIsAddModalVisible(false);
    loadData();
    setNewProd({ name: '', min: '', max: '', unit: 'pz.', supplier: '', isNewSupplier: false, commChannel: 'WhatsApp' });
  };

  const handleUpdateSupplier = async () => {
    if (activeProductId && newSupplierName) {
      await updateProductSupplier(activeProductId, newSupplierName);
      setIsSupplierModalVisible(false);
      loadData();
    } else {
      Alert.alert("Errore", "Inserisci o seleziona un nome per il fornitore.");
    }
  };

  // --- RENDER COMPONENTI ---
  const renderProductItem = ({ item }: { item: any }) => {
    let statusConfig = { bg: '#E6F4EA', text: '#1E8E3E', label: 'Sicuro', icon: 'shield-checkmark-outline' };
    if (item.current_stock === 0) statusConfig = { bg: '#F1F3F4', text: '#5F6368', label: 'Non disp.', icon: 'ban-outline' };
    else if (item.current_stock <= item.min_threshold) statusConfig = { bg: '#FCE8E6', text: '#D93025', label: 'Critico', icon: 'warning-outline' };
    else if (item.current_stock <= item.min_threshold * 1.5) statusConfig = { bg: '#E8F0FE', text: '#1A73E8', label: 'In esaurim.', icon: 'calendar-outline' };

    return (
      <View style={styles.card}>
        <View style={styles.imagePlaceholder}><Ionicons name="image-outline" size={24} color="#B0B0B0" /></View>
        <View style={styles.infoContainer}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.supplierText} numberOfLines={1}>{item.supplier_id}</Text>
        </View>

        {/* LOGICA MODIFICA VS VISUALIZZAZIONE */}
        {isEditMode ? (
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.actionBtnTruck} onPress={() => { setActiveProductId(item.id); setNewSupplierName(item.supplier_id); setIsSupplierModalVisible(true); }}>
              <Ionicons name="bus-outline" size={20} color="#0052FF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnTrash} onPress={() => confirmDelete(item)}>
              <Ionicons name="trash-outline" size={20} color="#D93025" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.badge, { backgroundColor: statusConfig.bg }]}>
            <View style={styles.badgeHeader}>
              <Ionicons name={statusConfig.icon as any} size={12} color={statusConfig.text} style={{marginRight: 4}} />
              <Text style={[styles.badgeLabel, { color: statusConfig.text }]}>{statusConfig.label}</Text>
            </View>
            <Text style={[styles.badgeQuantity, { color: statusConfig.text }]}>{item.current_stock} {item.unit}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderSupplierItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => { setSelectedSupplierFilter(item.name); setViewMode('products'); }}>
      <View style={[styles.imagePlaceholder, { backgroundColor: '#E8F0FE' }]}><Ionicons name="business-outline" size={24} color="#1A73E8" /></View>
      <View style={styles.infoContainer}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.supplierText}>{item.count} prodotti associati</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#CCC" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* HEADER & MENU */}
      <View style={{ zIndex: 10 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => isManager && setIsMenuOpen(!isMenuOpen)} disabled={!isManager}>
            <Ionicons name="menu-outline" size={28} color={isManager ? "#000" : "#CCC"} />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>{viewMode === 'suppliers' ? 'Fornitori' : 'Magazzino'}</Text>
          
          <View style={styles.headerIcons}>
            <TouchableOpacity onPress={logout}><Ionicons name="log-out-outline" size={26} color="#D93025" /></TouchableOpacity>
          </View>
        </View>

        {isMenuOpen && isManager && (
          <View style={styles.dropdownMenu}>
            <TouchableOpacity style={styles.dropdownItem} onPress={() => handleMenuAction(isEditMode ? 'products' : 'edit')}>
              <Ionicons name={isEditMode ? "checkmark-circle-outline" : "create-outline"} size={20} color="#000" style={{marginRight: 8}} />
              <Text style={styles.dropdownText}>{isEditMode ? "Fine Modifica" : "Modifica Magazzino"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem} onPress={() => handleMenuAction('suppliers')}>
              <Ionicons name="business-outline" size={20} color="#000" style={{marginRight: 8}} />
              <Text style={styles.dropdownText}>Visualizza Fornitori</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dropdownItem, { borderBottomWidth: 0 }]} onPress={() => handleMenuAction('products')}>
              <Ionicons name="cube-outline" size={20} color="#000" style={{marginRight: 8}} />
              <Text style={styles.dropdownText}>Tutti i Prodotti</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* BARRA DI RICERCA */}
      {viewMode === 'products' && (
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cerca prodotto o fornitore..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {selectedSupplierFilter && (
            <TouchableOpacity onPress={() => setSelectedSupplierFilter(null)} style={styles.clearFilterBadge}>
              <Text style={styles.clearFilterText}>X Filtro Fornitore</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* TASTO AGGIUNGI PRODOTTO */}
      {isEditMode && (
        <TouchableOpacity style={styles.addBtn} onPress={() => setIsAddModalVisible(true)}>
          <Ionicons name="add-circle-outline" size={24} color="#0052FF" style={{marginRight: 8}} />
          <Text style={styles.addBtnText}>Aggiungi Nuovo Prodotto</Text>
        </TouchableOpacity>
      )}

      {/* LISTA PRINCIPALE */}
      <FlatList
        data={viewMode === 'products' ? filteredProducts : uniqueSuppliers}
        keyExtractor={(item, index) => item.id || index.toString()}
        renderItem={viewMode === 'products' ? renderProductItem : renderSupplierItem}
        contentContainerStyle={styles.listContainer}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* MODALE: AGGIUNGI PRODOTTO */}
      <Modal visible={isAddModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsAddModalVisible(false)}><Ionicons name="close" size={28} color="#000" /></TouchableOpacity>
            <Text style={styles.headerTitle}>Nuovo Prodotto</Text>
            <View style={{width: 28}}/>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={styles.label}>Nome Prodotto</Text>
            <TextInput style={styles.input} value={newProd.name} onChangeText={(t) => setNewProd({...newProd, name: t})} />

            <View style={{flexDirection: 'row', gap: 12}}>
              <View style={{flex: 1}}>
                <Text style={styles.label}>Soglia Minima</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={newProd.min} onChangeText={(t) => setNewProd({...newProd, min: t})} />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.label}>Soglia Massima</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={newProd.max} onChangeText={(t) => setNewProd({...newProd, max: t})} />
              </View>
            </View>

            <Text style={styles.label}>Unità di Misura</Text>
            <TextInput style={styles.input} value={newProd.unit} onChangeText={(t) => setNewProd({...newProd, unit: t})} placeholder="Es. pz, kg, litri" />

            <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8}}>
              <Text style={[styles.label, {marginTop: 0, flex: 1}]}>Fornitore</Text>
              <TouchableOpacity onPress={() => setNewProd({...newProd, isNewSupplier: !newProd.isNewSupplier})}>
                <Text style={{color: '#0052FF', fontWeight: 'bold'}}>{newProd.isNewSupplier ? "Scegli Esistente" : "Nuovo Fornitore"}</Text>
              </TouchableOpacity>
            </View>

            {newProd.isNewSupplier ? (
              <>
                <TextInput style={styles.input} placeholder="Nome Nuovo Fornitore" value={newProd.supplier} onChangeText={(t) => setNewProd({...newProd, supplier: t})} />
                <Text style={styles.label}>Canale Preferito</Text>
                <View style={{flexDirection: 'row', gap: 8, marginBottom: 16}}>
                  {['WhatsApp', 'Email', 'Telefono'].map(ch => (
                    <TouchableOpacity key={ch} style={[styles.channelChip, newProd.commChannel === ch && styles.channelChipActive]} onPress={() => setNewProd({...newProd, commChannel: ch})}>
                      <Text style={{color: newProd.commChannel === ch ? '#FFF' : '#333'}}>{ch}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 16}}>
                {uniqueSuppliers.map(s => (
                  <TouchableOpacity key={s.name} style={[styles.supplierChip, newProd.supplier === s.name && styles.supplierChipActive]} onPress={() => setNewProd({...newProd, supplier: s.name})}>
                    <Text style={{color: newProd.supplier === s.name ? '#0052FF' : '#666'}}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.btnPrimaryFull} onPress={handleSaveNewProduct}>
              <Text style={{color: '#FFF', fontWeight: 'bold', fontSize: 16}}>Salva Prodotto</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODALE: CAMBIA FORNITORE */}
      <Modal visible={isSupplierModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSmallBox}>
            <Text style={{fontSize: 18, fontWeight: 'bold', marginBottom: 16}}>Modifica Fornitore</Text>
            
            <Text style={[styles.label, { alignSelf: 'flex-start', marginTop: 0 }]}>Scegli esistente:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%', maxHeight: 45, marginBottom: 16 }}>
              {uniqueSuppliers.map(s => (
                <TouchableOpacity 
                  key={s.name} 
                  style={[styles.supplierChip, newSupplierName === s.name && styles.supplierChipActive]} 
                  onPress={() => setNewSupplierName(s.name)}>
                  <Text style={{color: newSupplierName === s.name ? '#0052FF' : '#666'}}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.label, { alignSelf: 'flex-start' }]}>Oppure scrivi un nome:</Text>
            <TextInput 
              style={[styles.input, {width: '100%'}]} 
              value={newSupplierName} 
              onChangeText={setNewSupplierName} 
              placeholder="Nome fornitore" 
            />

            <View style={{flexDirection: 'row', gap: 12, marginTop: 16}}>
              <TouchableOpacity style={[styles.btnOutline, {flex: 1}]} onPress={() => setIsSupplierModalVisible(false)}>
                <Text>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimaryFull, {flex: 1, marginTop: 0}]} onPress={handleUpdateSupplier}>
                <Text style={{color:'#FFF'}}>Salva</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#F0F0F0' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  
  dropdownMenu: { position: 'absolute', top: 60, left: 16, backgroundColor: '#FFF', borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, zIndex: 100, minWidth: 200 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  dropdownText: { fontSize: 15, color: '#333', fontWeight: '500' },

  searchContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F8F9FA' },
  searchIcon: { position: 'absolute', left: 28, zIndex: 1 },
  searchInput: { flex: 1, backgroundColor: '#FFF', paddingVertical: 10, paddingLeft: 40, paddingRight: 16, borderRadius: 8, borderWidth: 1, borderColor: '#EAEAEA' },
  clearFilterBadge: { backgroundColor: '#0052FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginLeft: 8 },
  clearFilterText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },

  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: 16, padding: 16, backgroundColor: '#F0F4FF', borderRadius: 8, borderStyle: 'dashed', borderWidth: 1, borderColor: '#0052FF' },
  addBtnText: { color: '#0052FF', fontWeight: 'bold', fontSize: 16 },

  listContainer: { paddingBottom: 20 },
  separator: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 16 },
  
  card: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFFFFF' },
  imagePlaceholder: { width: 50, height: 50, borderRadius: 10, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#EAEAEA' },
  infoContainer: { flex: 1, marginLeft: 16, marginRight: 12 },
  productName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  supplierText: { fontSize: 13, color: '#757575' },
  
  badge: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, minWidth: 90, alignItems: 'center' },
  badgeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  badgeLabel: { fontSize: 11, fontWeight: '600' },
  badgeQuantity: { fontSize: 14, fontWeight: '700' },

  editActions: { flexDirection: 'row', gap: 12 },
  actionBtnTrash: { padding: 10, backgroundColor: '#FCE8E6', borderRadius: 8 },
  actionBtnTruck: { padding: 10, backgroundColor: '#E8F0FE', borderRadius: 8 },

  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  modalBody: { padding: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#EAEAEA', borderRadius: 8, padding: 14, fontSize: 15 },
  
  supplierChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#EAEAEA', marginRight: 8 },
  supplierChipActive: { backgroundColor: '#E8F0FE', borderColor: '#0052FF' },
  channelChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#EAEAEA' },
  channelChipActive: { backgroundColor: '#0B132B', borderColor: '#0B132B' },

  btnPrimaryFull: { backgroundColor: '#0052FF', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 32 },
  btnOutline: { padding: 16, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#CCC' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalSmallBox: { width: '85%', backgroundColor: '#FFF', padding: 24, borderRadius: 16, alignItems: 'center' }
});