import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useAuth } from '../../../auth';
import { analyzeInventoryFile, categorizeSingleProduct, generateInventoryTemplate, scanOnboardingReceipt, scanShelfInventory } from '../../ai';
import { addMultipleProducts, addProduct, deleteProduct, emptyWarehouse, getProducts, updateProductDetails, updateProductSupplier, getSuppliers, updateSupplier } from '../../db';

const ICON_MAP: Record<string, any> = {
  'baby-care': require('../../../assets/icons/baby-care.png'),
  'bakery-shop': require('../../../assets/icons/bakery-shop.png'),
  'bread': require('../../../assets/icons/bread.png'),
  'canned-food': require('../../../assets/icons/canned-food.png'),
  'catering': require('../../../assets/icons/catering.png'),
  'cigarette': require('../../../assets/icons/cigarette.png'),
  'cleaning-products': require('../../../assets/icons/cleaning-products.png'),
  'coffee': require('../../../assets/icons/coffee.png'),
  'dairy-products': require('../../../assets/icons/dairy-products.png'),
  'fast-food': require('../../../assets/icons/fast-food.png'),
  'groceries': require('../../../assets/icons/groceries.png'),
  'liquor': require('../../../assets/icons/liquor.png'),
  'meat': require('../../../assets/icons/meat.png'),
  'medicine': require('../../../assets/icons/medicine.png'),
  'pantry': require('../../../assets/icons/pantry.png'),
  'personal-care': require('../../../assets/icons/personal-care.png'),
  'pet-food': require('../../../assets/icons/pet-food.png'),
  'seafood': require('../../../assets/icons/seafood.png'),
  'soft-drink': require('../../../assets/icons/soft-drink.png'),
  'sweet': require('../../../assets/icons/sweet.png'),
  'takeaway': require('../../../assets/icons/takeaway.png'),
};

const getProductStatus = (item: any) => {
  if (item.current_stock === 0) return 'Non disp.';
  if (item.current_stock <= item.min_threshold) return 'Critico';
  if (item.current_stock <= item.min_threshold * 1.5) return 'In esaurim.';
  return 'Sicuro';
};

const getStatusWeight = (status: string) => {
  if (status === 'Non disp.') return 0;
  if (status === 'Critico') return 1;
  if (status === 'In esaurim.') return 2;
  return 3;
};

export default function WarehouseScreen() {
  const { user, logout } = useAuth();
  const isManager = user?.role === 'MANAGER' || user?.role === 'PROPRIETARIO';

  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdatingCategories, setIsUpdatingCategories] = useState(false);

  // Stati Onboarding & Faldoni
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
  const [customIndustry, setCustomIndustry] = useState('');
  const [isOnboardingScanVisible, setIsOnboardingScanVisible] = useState(false);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [onboardingScannedItems, setOnboardingScannedItems] = useState<any[]>([]);

  // Stati UI standard
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'products' | 'suppliers'>('products');
  const [isEditMode, setIsEditMode] = useState(false);

  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string | null>(null);

  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isSupplierModalVisible, setIsSupplierModalVisible] = useState(false);
  const [isEditProductModalVisible, setIsEditProductModalVisible] = useState(false);

  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierChannel, setNewSupplierChannel] = useState('WhatsApp');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');

  const [newProd, setNewProd] = useState({ name: '', min: '', max: '', unit: 'pz.', supplier: '', isNewSupplier: false, commChannel: 'WhatsApp', phone: '', email: '' });
  const [editProdData, setEditProdData] = useState({ id: '', name: '', min: '', max: '', unit: '' });

  // Stato per canali di trasmissione
  const [supplierChannels, setSupplierChannels] = useState<Record<string, string>>({});
  const [supplierPhones, setSupplierPhones] = useState<Record<string, string>>({});
  const [supplierEmails, setSupplierEmails] = useState<Record<string, string>>({});
  const [isChannelModalVisible, setIsChannelModalVisible] = useState(false);
  const [activeSupplierForChannel, setActiveSupplierForChannel] = useState('');
  const [modalChannel, setModalChannel] = useState('');
  const [modalPhone, setModalPhone] = useState('');
  const [modalEmail, setModalEmail] = useState('');
  const AVAILABLE_CHANNELS = ['WhatsApp', 'Email', 'Telefono', 'App B2B', 'Rappresentante', 'Altro'];

  const mergeAndDeduplicateItems = (existingItems: any[], newItems: any[]) => {
    const existingNames = new Set(existingItems.map(i => i.name.toLowerCase().trim()));
    const itemsToAdd = newItems.filter((item: any) => !existingNames.has(item.name.toLowerCase().trim()));
    return [...existingItems, ...itemsToAdd];
  };

  useFocusEffect(
    React.useCallback(() => { loadData(); }, [])
  );

  const loadData = async () => {
    const data = await getProducts();
    setProducts(data);

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
    }
  };

  const openChannelModal = (supplierName: string) => {
    setActiveSupplierForChannel(supplierName);
    setModalChannel(supplierChannels[supplierName] || 'WhatsApp');
    setModalPhone(supplierPhones[supplierName] || '');
    setModalEmail(supplierEmails[supplierName] || '');
    setIsChannelModalVisible(true);
  };

  const handleSaveChannel = async () => {
    const finalPhone = (modalChannel === 'WhatsApp' || modalChannel === 'Telefono') ? modalPhone : '';
    const finalEmail = (modalChannel === 'Email') ? modalEmail : '';
    await updateSupplier(activeSupplierForChannel, modalChannel, finalPhone, finalEmail);
    await loadData();
    setIsChannelModalVisible(false);
  };

  // --- LOGICA SVUOTA FALDONI (SCAN MULTIPLO) ---
  const handleScanFaldone = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permesso negato", "La fotocamera è necessaria per scansionare le fatture.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 });

    if (!result.canceled && result.assets[0].base64) {
      setIsGeneratingTemplate(true);
      const availableIconNames = Object.keys(ICON_MAP);

      const aiResult = await scanOnboardingReceipt(
        result.assets[0].base64,
        result.assets[0].mimeType || 'image/jpeg',
        uniqueCategories,
        availableIconNames
      );

      if (aiResult && aiResult.items) {
        const newItems = aiResult.items.map((item: any) => ({
          name: item.name,
          unit: item.unit,
          min_threshold: item.min_threshold,
          max_threshold: item.max_threshold,
          category: item.category,
          icon: item.icon,
          supplier_id: aiResult.supplierName || 'Fornitore Generico',
          current_stock: Number(item.quantity) || 0,
        }));

        setOnboardingScannedItems(prev => mergeAndDeduplicateItems(prev, newItems));
        setIsOnboardingScanVisible(true);
      } else {
        Alert.alert("Errore IA", "Non sono riuscito a leggere bene la ricevuta, riprova scattando con più luce.");
      }
      setIsGeneratingTemplate(false);
    }
  };

  const removeScannedItem = (index: number) => {
    const updated = [...onboardingScannedItems];
    updated.splice(index, 1);
    setOnboardingScannedItems(updated);
  };

  const updateScannedItemQty = (index: number, newQty: string) => {
    const updated = [...onboardingScannedItems];
    updated[index].current_stock = parseFloat(newQty.replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
    setOnboardingScannedItems(updated);
  };

  const updateScannedItemValue = (index: number, field: string, newValue: string) => {
    const updated = [...onboardingScannedItems];
    updated[index][field] = parseFloat(newValue.replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
    setOnboardingScannedItems(updated);
  };

  const confirmFaldoni = async () => {
    if (onboardingScannedItems.length === 0) {
      setIsOnboardingScanVisible(false);
      return;
    }

    setIsUpdatingCategories(true);
    await addMultipleProducts(onboardingScannedItems);
    setOnboardingScannedItems([]);
    setIsOnboardingScanVisible(false);
    await loadData();
    setIsUpdatingCategories(false);
    Alert.alert("Magazzino Inizializzato! 🚀", "I prodotti sono stati aggiunti con successo al tuo magazzino.");
  };

  // --- LOGICA CARICAMENTO FILE (PDF/CSV/TXT) ---
  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        // Accettiamo PDF, CSV, TXT e formati Excel (sebbene per Excel sia sempre meglio consigliare il PDF)
        type: ['application/pdf', 'text/csv', 'text/plain', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets[0]) {
        setIsGeneratingTemplate(true); // Usiamo lo stesso overlay di caricamento

        const fileUri = result.assets[0].uri;
        let mimeType = result.assets[0].mimeType || 'text/plain';

        // Leggiamo il file convertendolo in stringa Base64
        const base64File = await FileSystem.readAsStringAsync(fileUri, { encoding: 'base64' });

        const availableIconNames = Object.keys(ICON_MAP);
        const aiProducts = await analyzeInventoryFile(base64File, mimeType, customIndustry || "Generico", availableIconNames);

        if (aiProducts && aiProducts.length > 0) {
          setOnboardingScannedItems(prev => mergeAndDeduplicateItems(prev, aiProducts));
          setIsOnboardingScanVisible(true);
        } else {
          Alert.alert("Errore di Lettura", "Non sono riuscito a estrarre prodotti dal file. Assicurati che sia un PDF, CSV o TXT leggibile.");
        }
        setIsGeneratingTemplate(false);
      }
    } catch (err) {
      console.error(err);
      setIsGeneratingTemplate(false);
    }
  };

  // --- LOGICA SCANSIONE SCAFFALI REALI ---
  const handleScanShelf = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) return Alert.alert("Permesso negato", "La fotocamera è necessaria.");

    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 });

    if (!result.canceled && result.assets[0].base64) {
      setIsGeneratingTemplate(true); // Mostriamo il caricamento a tutto schermo
      const availableIconNames = Object.keys(ICON_MAP);

      const aiResult = await scanShelfInventory(
        result.assets[0].base64,
        result.assets[0].mimeType || 'image/jpeg',
        uniqueCategories,
        availableIconNames
      );

      if (aiResult && aiResult.items && aiResult.items.length > 0) {
        const newItems = aiResult.items.map((item: any) => ({
          name: item.name,
          min_threshold: item.min_threshold || 5,
          max_threshold: item.max_threshold || 20,
          unit: item.unit || 'pz.',
          category: item.category || 'Generico',
          icon: item.icon,
          supplier_id: 'Fornitore Generico', // Campo default da modificare dopo
          current_stock: Number(item.quantity) || 0,
        }));

        // Aggiungiamo i prodotti alla lista temporanea e apriamo il modale di revisione!
        setOnboardingScannedItems(prev => mergeAndDeduplicateItems(prev, newItems));
        setIsOnboardingScanVisible(true);
      } else {
        Alert.alert("Errore IA o indisponibilità", "Non sono riuscito a riconoscere i prodotti in questa foto, o il server è momentaneamente sovraccarico. Riprova fra poco.");
      }
      setIsGeneratingTemplate(false);
    }
  };

  // --- LOGICA TEMPLATE STANDARD ---
  const handleGenerateTemplate = async (industryType: string) => {
    Keyboard.dismiss();
    if (!industryType.trim()) {
      Alert.alert("Errore", "Inserisci una descrizione valida.");
      return;
    }

    setIsGeneratingTemplate(true);
    const aiProducts = await generateInventoryTemplate(industryType, Object.keys(ICON_MAP));

    if (aiProducts && aiProducts.length > 0) {
      const fixedProducts = aiProducts.map((p: any) => ({ ...p, quantity: 0, current_stock: 0 }));
      setOnboardingScannedItems(prev => mergeAndDeduplicateItems(prev, fixedProducts));
      setCustomIndustry('');
      setIsOnboardingScanVisible(true);
    } else {
      Alert.alert("Errore", "I server sono momentaneamente sovraccarichi.");
    }
    setIsGeneratingTemplate(false);
  };

  // --- DATI DERIVATI ---
  const uniqueSuppliers = useMemo(() => {
    const obj: Record<string, number> = {};
    products.forEach(p => { obj[p.supplier_id] = (obj[p.supplier_id] || 0) + 1; });
    return Object.keys(obj).map(key => ({ name: key, count: obj[key] }));
  }, [products]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(c => c));
    return Array.from(cats) as string[];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      const status = getProductStatus(p);
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.supplier_id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSupplier = selectedSupplierFilter ? p.supplier_id === selectedSupplierFilter : true;
      const matchesCategory = selectedCategoryFilter ? p.category === selectedCategoryFilter : true;
      const matchesStatus = selectedStatusFilter ? status === selectedStatusFilter : true;
      return matchesSearch && matchesSupplier && matchesCategory && matchesStatus;
    });

    result.sort((a, b) => {
      const weightA = getStatusWeight(getProductStatus(a));
      const weightB = getStatusWeight(getProductStatus(b));
      if (weightA !== weightB) return weightA - weightB;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [products, searchQuery, selectedSupplierFilter, selectedCategoryFilter, selectedStatusFilter]);

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
    Alert.alert("Elimina", `Vuoi davvero eliminare ${item.name}?`, [
      { text: "Annulla", style: "cancel" },
      {
        text: "Conferma", style: "destructive", onPress: async () => {
          await deleteProduct(item.id);
          await loadData();
        }
      }
    ]);
  };

  // --- FUNZIONE TEMPORANEA DI TEST PER RESETTARE IL DB ---
  const handleClearWarehouse = () => {
    Alert.alert(
      "⚠️ RESET COMPLETO (TEST)",
      "Vuoi davvero eliminare TUTTI i prodotti presenti nel magazzino per ricominciare il test da zero?",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Svuota Tutto",
          style: "destructive",
          onPress: async () => {
            setIsGeneratingTemplate(true); // Attiva la rotellina di caricamento
            await emptyWarehouse();
            await loadData(); // Ricarica il magazzino (ora vuoto)
            setIsGeneratingTemplate(false);
          }
        }
      ]
    );
  };

  const handleSaveNewProduct = async () => {
    Keyboard.dismiss();
    if (!newProd.name || !newProd.min || !newProd.max || !newProd.supplier) {
      Alert.alert("Errore", "Compila tutti i campi obbligatori.");
      return;
    }

    if (newProd.isNewSupplier && newProd.supplier) {
      const finalPhone = (newProd.commChannel === 'WhatsApp' || newProd.commChannel === 'Telefono') ? newProd.phone : '';
      const finalEmail = (newProd.commChannel === 'Email') ? newProd.email : '';
      await updateSupplier(newProd.supplier, newProd.commChannel, finalPhone, finalEmail);
      setNewProd({ name: '', min: '', max: '', unit: 'pz.', supplier: '', isNewSupplier: false, commChannel: 'WhatsApp', phone: '', email: '' });
    }

    setIsUpdatingCategories(true);
    const aiClassification = await categorizeSingleProduct(newProd.name, uniqueCategories, Object.keys(ICON_MAP));

    await addProduct({
      name: newProd.name,
      min_threshold: parseFloat(newProd.min.replace(',', '.')),
      max_threshold: parseFloat(newProd.max.replace(',', '.')),
      unit: newProd.unit,
      supplier_id: newProd.supplier,
      category: aiClassification?.category || undefined,
      icon: aiClassification?.icon || undefined
    });

    setIsAddModalVisible(false);
    setNewProd({ name: '', min: '', max: '', unit: 'pz.', supplier: '', isNewSupplier: false, commChannel: 'WhatsApp', phone: '', email: '' });
    await loadData();
    setIsUpdatingCategories(false);
  };

  const handleUpdateSupplier = async () => {
    Keyboard.dismiss();
    if (activeProductId && newSupplierName) {
      await updateProductSupplier(activeProductId, newSupplierName);
      const finalPhone = (newSupplierChannel === 'WhatsApp' || newSupplierChannel === 'Telefono') ? newSupplierPhone : '';
      const finalEmail = (newSupplierChannel === 'Email') ? newSupplierEmail : '';
      await updateSupplier(newSupplierName, newSupplierChannel, finalPhone, finalEmail);
      await loadData();

      setIsSupplierModalVisible(false);
    }
  };

  const openEditProduct = (item: any) => {
    setEditProdData({
      id: item.id,
      name: item.name,
      min: String(item.min_threshold),
      max: String(item.max_threshold),
      unit: item.unit
    });
    setIsEditProductModalVisible(true);
  };

  const handleSaveProductEdit = async () => {
    Keyboard.dismiss();
    if (!editProdData.name || !editProdData.min || !editProdData.max || !editProdData.unit) {
      Alert.alert("Errore", "Compila tutti i campi.");
      return;
    }

    await updateProductDetails(editProdData.id, {
      name: editProdData.name,
      min_threshold: parseFloat(editProdData.min.replace(',', '.')),
      max_threshold: parseFloat(editProdData.max.replace(',', '.')),
      unit: editProdData.unit
    });

    setIsEditProductModalVisible(false);
    loadData();
  };

  const renderProductItem = ({ item }: { item: any }) => {
    let statusConfig = { bg: '#E6F4EA', text: '#1E8E3E', label: 'Sicuro', icon: 'shield-checkmark-outline' };
    if (item.current_stock === 0) statusConfig = { bg: '#F1F3F4', text: '#5F6368', label: 'Non disp.', icon: 'ban-outline' };
    else if (item.current_stock <= item.min_threshold) statusConfig = { bg: '#FCE8E6', text: '#D93025', label: 'Critico', icon: 'warning-outline' };
    else if (item.current_stock <= item.min_threshold * 1.5) statusConfig = { bg: '#E8F0FE', text: '#1A73E8', label: 'In esaurim.', icon: 'calendar-outline' };

    return (
      <View style={styles.card}>
        <View style={styles.imagePlaceholder}>
          {item.icon && ICON_MAP[item.icon] ? (
            <Image source={ICON_MAP[item.icon]} style={{ width: 32, height: 32 }} resizeMode="contain" />
          ) : (
            <Ionicons name="image-outline" size={24} color="#B0B0B0" />
          )}
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.productName} numberOfLines={5}>{item.name}</Text>
          <Text style={styles.supplierText} numberOfLines={5}>{item.supplier_id} {item.category ? ` • ${item.category}` : ''}</Text>
        </View>
        {isEditMode ? (
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.actionBtnEdit} onPress={() => openEditProduct(item)}>
              <Ionicons name="pencil-outline" size={20} color="#333" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnTruck} onPress={() => { setActiveProductId(item.id); setNewSupplierName(item.supplier_id); setNewSupplierChannel(supplierChannels[item.supplier_id] || 'WhatsApp'); setNewSupplierPhone(supplierPhones[item.supplier_id] || ''); setIsSupplierModalVisible(true); }}>
              <Ionicons name="bus-outline" size={20} color="#DB7F18" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnTrash} onPress={() => confirmDelete(item)}>
              <Ionicons name="trash-outline" size={20} color="#D93025" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.badge, { backgroundColor: statusConfig.bg }]}>
            <View style={styles.badgeHeader}>
              <Ionicons name={statusConfig.icon as any} size={12} color={statusConfig.text} style={{ marginRight: 4 }} />
              <Text style={[styles.badgeLabel, { color: statusConfig.text }]}>{statusConfig.label}</Text>
            </View>
            <Text style={[styles.badgeQuantity, { color: statusConfig.text }]}>{parseFloat(Number(item.current_stock).toFixed(2))} {item.unit}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderSupplierItem = ({ item }: { item: any }) => {
    const channel = supplierChannels[item.name] || 'WhatsApp';
    return (
      <TouchableOpacity style={styles.card} onPress={() => { setSelectedSupplierFilter(item.name); setViewMode('products'); }}>
        <View style={[styles.imagePlaceholder, { backgroundColor: '#E8F0FE' }]}>
          <Ionicons name="business-outline" size={24} color="#1A73E8" />
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.supplierText}>{item.count} prodotti associati</Text>
        </View>
        <TouchableOpacity
          style={{ padding: 8, backgroundColor: '#FFF4EB', borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}
          onPress={(e) => { e.stopPropagation(); openChannelModal(item.name); }}
        >
          <Ionicons name={channel === 'WhatsApp' ? "logo-whatsapp" : channel === 'Email' ? "mail-outline" : channel === 'Telefono' ? "call-outline" : "chatbubbles-outline"} size={16} color="#DB7F18" style={{ marginRight: 4 }} />
          <Text style={{ color: '#DB7F18', fontSize: 12, fontWeight: 'bold' }}>{channel}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={{ zIndex: 10 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => isManager && setIsMenuOpen(!isMenuOpen)} disabled={!isManager}>
            <Ionicons name="menu-outline" size={28} color={isManager ? "#000" : "#CCC"} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>{viewMode === 'suppliers' ? 'Fornitori' : 'Magazzino'}</Text>

          {/* Sostituito il logout con un placeholder invisibile per tenere il titolo centrato */}
          <View style={{ width: 28 }} />
        </View>

        {isMenuOpen && isManager && (
          <View style={styles.dropdownMenu}>
            <TouchableOpacity style={styles.dropdownItem} onPress={() => handleMenuAction(isEditMode ? 'products' : 'edit')}>
              <Ionicons name={isEditMode ? "checkmark-circle-outline" : "create-outline"} size={20} color="#000" style={{ marginRight: 8 }} />
              <Text style={styles.dropdownText}>{isEditMode ? "Fine Modifica" : "Modifica Magazzino"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem} onPress={() => handleMenuAction('suppliers')}>
              <Ionicons name="business-outline" size={20} color="#000" style={{ marginRight: 8 }} />
              <Text style={styles.dropdownText}>Visualizza Fornitori</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dropdownItem, { borderBottomWidth: 0 }]} onPress={() => handleMenuAction('products')}>
              <Ionicons name="cube-outline" size={20} color="#000" style={{ marginRight: 8 }} />
              <Text style={styles.dropdownText}>Tutti i Prodotti</Text>
            </TouchableOpacity>
            {/* --- INIZIO OPZIONE TEMPORANEA DI TEST --- */}
            <TouchableOpacity
              style={[styles.dropdownItem, { borderBottomWidth: 0, borderTopWidth: 1, borderColor: '#FCE8E6' }]}
              onPress={() => { setIsMenuOpen(false); handleClearWarehouse(); }}
            >
              <Ionicons name="trash-bin-outline" size={20} color="#D93025" style={{ marginRight: 8 }} />
              <Text style={[styles.dropdownText, { color: '#D93025', fontWeight: 'bold' }]}>DANGER: Svuota Magazzino</Text>
            </TouchableOpacity>
            {/* --- FINE OPZIONE TEMPORANEA DI TEST --- */}
          </View>
        )}
      </View>

      {(isGeneratingTemplate || isUpdatingCategories) && (
        <View style={styles.fullScreenLoader}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={{ color: '#FFF', marginTop: 12, fontWeight: 'bold', fontSize: 16 }}>Elaborazione in corso...</Text>
        </View>
      )}

      {/* --- ONBOARDING MAGICO --- */}
      {products.length === 0 && viewMode === 'products' ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.emptyStateContainer} keyboardShouldPersistTaps="handled">
            <View style={styles.emptyIconBg}>
              <Ionicons name={isManager ? "sparkles" : "cube-outline"} size={48} color="#DB7F18" />
            </View>
            <Text style={styles.emptyTitle}>Il tuo Magazzino è vuoto!</Text>

            {isManager ? (
              <>
                {/* 1. CASELLA DI TESTO (Ora in alto) */}
                <Text style={styles.emptySubtitle}>
                  Inizializza il magazzino con l'IA. Inserisci una descrizione del tuo locale:
                </Text>

                <View style={styles.customInputContainer}>
                  <TextInput
                    style={styles.customInput}
                    placeholder="Es. Hamburgheria, Pub Irlandese..."
                    placeholderTextColor="#999"
                    value={customIndustry}
                    onChangeText={setCustomIndustry}
                  />
                  <TouchableOpacity style={styles.btnCustomGenerate} onPress={() => handleGenerateTemplate(customIndustry)}>
                    <Ionicons name="flash-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 15 }}>Genera Catalogo</Text>
                  </TouchableOpacity>
                </View>

                {/* DIVISORE (Aggiornato il testo) */}
                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} /><Text style={styles.dividerText}>OPPURE</Text><View style={styles.dividerLine} />
                </View>

                {/* BOTTONI FOTO E FILE (Riga superiore) */}
                <View style={{ flexDirection: 'row', gap: 12, width: '100%', marginBottom: 12 }}>
                  <TouchableOpacity style={[styles.btnFaldoni, { flex: 1, paddingHorizontal: 12 }]} onPress={handleScanFaldone}>
                    <Ionicons name="document-text-outline" size={20} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 13 }}>Fotografa fatture</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.btnFaldoni, { flex: 1, paddingHorizontal: 12, backgroundColor: '#DB7F18' }]} onPress={handlePickFile}>
                    <Ionicons name="document-attach-outline" size={20} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 13 }}>Carica (PDF/CSV)</Text>
                  </TouchableOpacity>
                </View>

                {/* NUOVO BOTTONE SCAFFALI (Centrato in basso) */}
                <TouchableOpacity style={[styles.btnFaldoni, { backgroundColor: '#8DA67F', width: '100%' }]} onPress={handleScanShelf}>
                  <Ionicons name="scan-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Scansiona scaffali</Text>
                </TouchableOpacity>

                {onboardingScannedItems.length > 0 && (
                  <TouchableOpacity style={{ marginTop: 24, width: '100%', backgroundColor: '#DB7F18', paddingVertical: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 }} onPress={() => setIsOnboardingScanVisible(true)}>
                    <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>
                      Visualizza {onboardingScannedItems.length} prodotti in attesa
                    </Text>
                  </TouchableOpacity>
                )}

                {/* TASTO MANUALE (Rimane in fondo) */}
                <TouchableOpacity style={{ marginTop: 32 }} onPress={() => setIsAddModalVisible(true)}>
                  <Text style={{ color: '#666', fontWeight: 'bold', fontSize: 15, textDecorationLine: 'underline' }}>Aggiungo manualmente</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={[styles.emptySubtitle, { fontWeight: '500', color: '#DB7F18', marginTop: 8 }]}>
                Chiedi al gestore di riempirlo o inizializzarlo per iniziare ad utilizzare Panino.
              </Text>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <>
          {viewMode === 'products' && (
            <>
              <View style={styles.searchContainer}>
                <Ionicons name="search-outline" size={20} color="#999" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cerca prodotto..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {selectedSupplierFilter && (
                  <TouchableOpacity onPress={() => setSelectedSupplierFilter(null)} style={styles.clearFilterBadge}>
                    <Text style={styles.clearFilterText}>X Filtro Fornitore</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.categoriesWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
                  <TouchableOpacity style={[styles.categoryChip, !selectedCategoryFilter && styles.categoryChipActive]} onPress={() => setSelectedCategoryFilter(null)}>
                    <Text style={{ color: !selectedCategoryFilter ? '#FFF' : '#333' }}>Tutte</Text>
                  </TouchableOpacity>
                  {uniqueCategories.map(cat => (
                    <TouchableOpacity key={cat} style={[styles.categoryChip, selectedCategoryFilter === cat && styles.categoryChipActive]} onPress={() => setSelectedCategoryFilter(cat)}>
                      <Text style={{ color: selectedCategoryFilter === cat ? '#FFF' : '#333' }}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={[styles.categoriesWrapper, { borderTopWidth: 0 }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
                  <TouchableOpacity style={[styles.categoryChip, !selectedStatusFilter && styles.categoryChipActive]} onPress={() => setSelectedStatusFilter(null)}>
                    <Text style={{ color: !selectedStatusFilter ? '#FFF' : '#333' }}>Tutti</Text>
                  </TouchableOpacity>
                  {['Esaurito', 'Critico', 'In esaurim.', 'Sicuro'].map(status => {
                    const statusLabel = status === 'Esaurito' ? 'Non disp.' : status;
                    return (
                      <TouchableOpacity key={status} style={[styles.categoryChip, selectedStatusFilter === statusLabel && styles.categoryChipActive]} onPress={() => setSelectedStatusFilter(statusLabel)}>
                        <Text style={{ color: selectedStatusFilter === statusLabel ? '#FFF' : '#333' }}>{status}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </>
          )}

          {isEditMode && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setIsAddModalVisible(true)}>
              <Ionicons name="add-circle-outline" size={24} color="#DB7F18" style={{ marginRight: 8 }} />
              <Text style={styles.addBtnText}>Aggiungi Nuovo Prodotto</Text>
            </TouchableOpacity>
          )}

          <FlatList
            data={viewMode === 'products' ? filteredProducts : uniqueSuppliers}
            keyExtractor={(item, index) => item.id || index.toString()}
            renderItem={viewMode === 'products' ? renderProductItem : renderSupplierItem}
            contentContainerStyle={styles.listContainer}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </>
      )}

      {/* --- MODALE SVUOTA FALDONI --- */}
      <Modal visible={isOnboardingScanVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsOnboardingScanVisible(false)}>
              <Ionicons name="close" size={28} color="#000" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Prodotti in Attesa</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {onboardingScannedItems.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Ionicons name="documents-outline" size={48} color="#CCC" />
                <Text style={{ color: '#666', marginTop: 12, textAlign: 'center' }}>Nessun prodotto in attesa.{'\n'}Usa uno dei metodi per iniziare!</Text>
              </View>
            ) : (
              onboardingScannedItems.map((item, idx) => (
                <View key={idx} style={styles.scannedItemBox}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{item.name}</Text>
                      <Text style={{ color: '#DB7F18', fontSize: 12, marginTop: 4 }}>{item.supplier_id} • {item.category}</Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TextInput
                        style={[styles.smallInput, { width: 50, textAlign: 'center', marginHorizontal: 4, paddingVertical: 6, fontWeight: 'bold' }]}
                        keyboardType="numeric"
                        value={String(item.current_stock)}
                        onChangeText={(t) => updateScannedItemQty(idx, t)}
                      />
                      <Text style={{ fontSize: 14, fontWeight: 'bold', marginRight: 12 }}>{item.unit}</Text>
                      <TouchableOpacity onPress={() => removeScannedItem(idx)}>
                        <Ionicons name="trash-outline" size={20} color="#D93025" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: '#666' }}>Min</Text>
                      <TextInput
                        style={styles.smallInput}
                        keyboardType="numeric"
                        value={String(item.min_threshold)}
                        onChangeText={(t) => updateScannedItemValue(idx, 'min_threshold', t)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: '#666' }}>Max</Text>
                      <TextInput
                        style={styles.smallInput}
                        keyboardType="numeric"
                        value={String(item.max_threshold)}
                        onChangeText={(t) => updateScannedItemValue(idx, 'max_threshold', t)}
                      />
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={{ padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: '#eee', gap: 12 }}>
            <TouchableOpacity style={[{ borderStyle: 'dashed', borderColor: '#DB7F18', flexDirection: 'row', justifyContent: 'center', padding: 14, borderRadius: 8, borderWidth: 1 }]} onPress={() => setIsOnboardingScanVisible(false)}>
                <>
                  <Ionicons name="add-circle-outline" size={20} color="#DB7F18" style={{ marginRight: 8 }} />
                  <Text style={{ color: '#DB7F18', fontWeight: 'bold' }}>+ Aggiungi con un altro metodo</Text>
                </>
            </TouchableOpacity>

            {onboardingScannedItems.length > 0 && (
              <TouchableOpacity style={[{ padding: 16, borderRadius: 8, alignItems: 'center', backgroundColor: '#8DA67F' }]} onPress={confirmFaldoni}>
                <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Salva in Magazzino ({onboardingScannedItems.length})</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* --- MODALE AGGIUNGI PRODOTTO --- */}
      <Modal visible={isAddModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setIsAddModalVisible(false)}><Ionicons name="close" size={28} color="#000" /></TouchableOpacity>
              <Text style={styles.headerTitle}>Nuovo Prodotto</Text>
              <View style={{ width: 28 }} />
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Nome Prodotto</Text>
              <TextInput style={styles.input} value={newProd.name} onChangeText={(t) => setNewProd({ ...newProd, name: t })} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Soglia Minima</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={newProd.min} onChangeText={(t) => setNewProd({ ...newProd, min: t })} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Soglia Massima</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={newProd.max} onChangeText={(t) => setNewProd({ ...newProd, max: t })} />
              </View>
            </View>

            <Text style={styles.label}>Unità di Misura</Text>
            <TextInput style={styles.input} value={newProd.unit} onChangeText={(t) => setNewProd({ ...newProd, unit: t })} placeholder="Es. pz, kg, litri" />

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
              <Text style={[styles.label, { marginTop: 0, flex: 1 }]}>Fornitore</Text>
              <TouchableOpacity onPress={() => setNewProd({ ...newProd, isNewSupplier: !newProd.isNewSupplier })}>
                <Text style={{ color: '#8DA67F', fontWeight: 'bold' }}>{newProd.isNewSupplier ? "Scegli Esistente" : "Nuovo Fornitore"}</Text>
              </TouchableOpacity>
            </View>

            {newProd.isNewSupplier ? (
              <>
                <TextInput style={styles.input} placeholder="Nome Nuovo Fornitore" value={newProd.supplier} onChangeText={(t) => setNewProd({ ...newProd, supplier: t })} />

                <Text style={styles.label}>Canale di Trasmissione</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {AVAILABLE_CHANNELS.map(ch => (
                    <TouchableOpacity key={ch} style={[styles.supplierChip, newProd.commChannel === ch && styles.supplierChipActive]} onPress={() => setNewProd({ ...newProd, commChannel: ch })}>
                      <Text style={{ color: newProd.commChannel === ch ? '#8DA67F' : '#666' }}>{ch}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {newProd.commChannel === 'Telefono' && (
                  <View style={{marginBottom: 16}}>
                    <Text style={[styles.label, {marginTop: 0}]}>Numero di Telefono</Text>
                    <TextInput style={styles.input} placeholder="+39 333 1234567" keyboardType="phone-pad" value={newProd.phone} onChangeText={(t) => setNewProd({...newProd, phone: t})} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} />
                  </View>
                )}
                {newProd.commChannel === 'WhatsApp' && (
                  <View style={{marginBottom: 16}}>
                    <Text style={[styles.label, {marginTop: 0}]}>Numero WhatsApp</Text>
                    <TextInput style={styles.input} placeholder="+39 333 1234567" keyboardType="phone-pad" value={newProd.phone} onChangeText={(t) => setNewProd({...newProd, phone: t})} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} />
                  </View>
                )}
                {newProd.commChannel === 'Email' && (
                  <View style={{marginBottom: 16}}>
                    <Text style={[styles.label, {marginTop: 0}]}>Indirizzo Email</Text>
                    <TextInput style={styles.input} placeholder="fornitore@mail.com" keyboardType="email-address" autoCapitalize="none" value={newProd.email} onChangeText={(t) => setNewProd({...newProd, email: t})} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} />
                  </View>
                )}
              </>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {uniqueSuppliers.map(s => (
                  <TouchableOpacity key={s.name} style={[styles.supplierChip, newProd.supplier === s.name && styles.supplierChipActive]} onPress={() => setNewProd({ ...newProd, supplier: s.name })}>
                    <Text style={{ color: newProd.supplier === s.name ? '#8DA67F' : '#666' }}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.btnPrimaryFull} onPress={handleSaveNewProduct} disabled={isUpdatingCategories}>
              {isUpdatingCategories ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Salva e Analizza (AI)</Text>}
            </TouchableOpacity>
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* --- MODALE MODIFICA DETTAGLI --- */}
      <Modal visible={isEditProductModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setIsEditProductModalVisible(false)}><Ionicons name="close" size={28} color="#000" /></TouchableOpacity>
              <Text style={styles.headerTitle}>Modifica Dettagli</Text>
              <View style={{ width: 28 }} />
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Nome Prodotto</Text>
            <TextInput style={styles.input} value={editProdData.name} onChangeText={(t) => setEditProdData({ ...editProdData, name: t })} />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Soglia Minima</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={editProdData.min} onChangeText={(t) => setEditProdData({ ...editProdData, min: t })} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Soglia Massima</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={editProdData.max} onChangeText={(t) => setEditProdData({ ...editProdData, max: t })} />
              </View>
            </View>

            <Text style={styles.label}>Unità di Misura</Text>
            <TextInput style={styles.input} value={editProdData.unit} onChangeText={(t) => setEditProdData({ ...editProdData, unit: t })} />

            <TouchableOpacity style={styles.btnPrimaryFull} onPress={handleSaveProductEdit}>
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Salva Modifiche</Text>
            </TouchableOpacity>
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* --- MODALE CAMBIA FORNITORE --- */}
      <Modal visible={isSupplierModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <TouchableOpacity activeOpacity={1} style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }} onPress={() => Keyboard.dismiss()}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSmallBox}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Modifica Fornitore</Text>

            <Text style={[styles.label, { alignSelf: 'flex-start', marginTop: 0 }]}>Scegli esistente:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%', maxHeight: 45, marginBottom: 16 }}>
              {uniqueSuppliers.map(s => (
                <TouchableOpacity key={s.name} style={[styles.supplierChip, newSupplierName === s.name && styles.supplierChipActive]} onPress={() => { setNewSupplierName(s.name); setNewSupplierChannel(supplierChannels[s.name] || 'WhatsApp'); setNewSupplierPhone(supplierPhones[s.name] || ''); setNewSupplierEmail(supplierEmails[s.name] || ''); }}>
                  <Text style={{ color: newSupplierName === s.name ? '#8DA67F' : '#666' }}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.label, { alignSelf: 'flex-start' }]}>Oppure scrivi un nome:</Text>
            <TextInput style={[styles.input, { width: '100%' }]} value={newSupplierName} onChangeText={setNewSupplierName} placeholder="Nome fornitore" returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} />

            <Text style={[styles.label, { alignSelf: 'flex-start', marginTop: 8 }]}>Canale di trasmissione:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%', maxHeight: 45, marginBottom: 16 }}>
              {AVAILABLE_CHANNELS.map(ch => (
                <TouchableOpacity key={ch} style={[styles.supplierChip, newSupplierChannel === ch && styles.supplierChipActive]} onPress={() => setNewSupplierChannel(ch)}>
                  <Text style={{ color: newSupplierChannel === ch ? '#8DA67F' : '#666' }}>{ch}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {(newSupplierChannel === 'Telefono' || newSupplierChannel === 'WhatsApp') && (
               <View style={{width: '100%'}}>
                 <Text style={[styles.label, { alignSelf: 'flex-start', marginTop: 0 }]}>Numero {newSupplierChannel}:</Text>
                 <TextInput style={[styles.input, {width: '100%'}]} placeholder="+39 333 1234567" keyboardType="phone-pad" value={newSupplierPhone} onChangeText={setNewSupplierPhone} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} />
               </View>
            )}

            {newSupplierChannel === 'Email' && (
               <View style={{width: '100%'}}>
                 <Text style={[styles.label, { alignSelf: 'flex-start', marginTop: 0 }]}>Indirizzo Email:</Text>
                 <TextInput style={[styles.input, {width: '100%'}]} placeholder="fornitore@mail.com" keyboardType="email-address" autoCapitalize="none" value={newSupplierEmail} onChangeText={setNewSupplierEmail} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} />
               </View>
            )}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity style={[styles.btnOutline, { flex: 1 }]} onPress={() => setIsSupplierModalVisible(false)}><Text>Annulla</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimaryFull, { flex: 1, marginTop: 0 }]} onPress={handleUpdateSupplier}><Text style={{ color: '#FFF' }}>Salva</Text></TouchableOpacity>
            </View>
          </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- MODALE CAMBIA CANALE TRASMISSIONE --- */}
      <Modal visible={isChannelModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <TouchableOpacity activeOpacity={1} style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }} onPress={() => Keyboard.dismiss()}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSmallBox}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>
                  Mezzo di trasmissione
                </Text>
              <Text style={{ fontSize: 14, color: '#666', marginBottom: 16, textAlign: 'center' }}>
                Seleziona il canale predefinito per comunicare con: {activeSupplierForChannel}
              </Text>

              <ScrollView style={{ width: '100%', maxHeight: 300, marginBottom: 16 }}>
                {AVAILABLE_CHANNELS.map(ch => {
                  const isSelected = modalChannel === ch;
                  return (
                    <View key={ch}>
                      <TouchableOpacity
                        style={{
                          padding: 16,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isSelected ? '#8DA67F' : '#EAEAEA',
                          backgroundColor: isSelected ? '#F4F7F2' : '#FFF',
                          marginBottom: isSelected && ch === 'Telefono' ? 0 : 8,
                          borderBottomLeftRadius: isSelected && ch === 'Telefono' ? 0 : 8,
                          borderBottomRightRadius: isSelected && ch === 'Telefono' ? 0 : 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                        onPress={() => setModalChannel(ch)}
                      >
                        <Text style={{ color: isSelected ? '#8DA67F' : '#333', fontWeight: isSelected ? 'bold' : 'normal' }}>{ch}</Text>
                        {isSelected && <Ionicons name="checkmark-circle" size={20} color="#8DA67F" />}
                      </TouchableOpacity>
                      {isSelected && (ch === 'Telefono' || ch === 'WhatsApp') && (
                        <View style={{ backgroundColor: '#F4F7F2', padding: 16, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, marginBottom: 8, borderWidth: 1, borderTopWidth: 0, borderColor: '#8DA67F' }}>
                          <Text style={[styles.label, {marginTop: 0}]}>Numero di {ch}:</Text>
                          <TextInput 
                            style={styles.input} 
                            placeholder="+39 333 1234567" 
                            keyboardType="phone-pad"
                            value={modalPhone}
                            onChangeText={setModalPhone}
                          />
                        </View>
                      )}
                      {isSelected && ch === 'Email' && (
                        <View style={{ backgroundColor: '#F4F7F2', padding: 16, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, marginBottom: 8, borderWidth: 1, borderTopWidth: 0, borderColor: '#8DA67F' }}>
                          <Text style={[styles.label, {marginTop: 0}]}>Indirizzo Email:</Text>
                          <TextInput 
                            style={styles.input} 
                            placeholder="fornitore@mail.com" 
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={modalEmail}
                            onChangeText={setModalEmail}
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              <TouchableOpacity style={[styles.btnPrimaryFull, { width: '100%', marginTop: 0, marginBottom: 12 }]} onPress={handleSaveChannel}>
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Salva Preferenza</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnOutline, { width: '100%' }]} onPress={() => setIsChannelModalVisible(false)}>
                <Text>Annulla</Text>
              </TouchableOpacity>
            </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#F0F0F0' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  fullScreenLoader: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },

  emptyStateContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F8F5E6' },
  emptyIconBg: { backgroundColor: '#E8F0FE', padding: 24, borderRadius: 100, marginBottom: 24 },
  emptyTitle: { fontSize: 24, fontWeight: 'bold', color: '#111', marginBottom: 12, textAlign: 'center' },
  emptySubtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 22, paddingHorizontal: 12 },

  btnFaldoni: { flexDirection: 'row', backgroundColor: '#DB7F18', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 32 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  dividerText: { marginHorizontal: 12, color: '#888', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },

  customInputContainer: { width: '100%', gap: 10 },
  customInput: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EAEAEA', borderRadius: 8, padding: 14, fontSize: 15, width: '100%', color: '#333' },
  btnCustomGenerate: { flexDirection: 'row', backgroundColor: '#DB7F18', padding: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  alternativeActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, width: '100%' },
  btnAlt: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DB7F18', borderRadius: 8, paddingVertical: 14, paddingHorizontal: 12, backgroundColor: '#FFFFFF' },
  btnAltText: { color: '#DB7F18', fontWeight: '600', marginLeft: 8 },

  dropdownMenu: { position: 'absolute', top: 60, left: 16, backgroundColor: '#FFF', borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, zIndex: 100, minWidth: 200 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  dropdownText: { fontSize: 15, color: '#333', fontWeight: '500' },

  searchContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: '#FFF' },
  searchIcon: { position: 'absolute', left: 28, zIndex: 1, top: 22 },
  searchInput: { flex: 1, backgroundColor: '#F8F5E6', paddingVertical: 10, paddingLeft: 40, paddingRight: 16, borderRadius: 8, borderWidth: 1, borderColor: '#EAEAEA' },
  clearFilterBadge: { backgroundColor: '#DB7F18', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginLeft: 8 },
  clearFilterText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },

  categoriesWrapper: { backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#F0F0F0' },
  categoriesScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F8F5E6', borderWidth: 1, borderColor: '#EAEAEA', marginRight: 8 },
  categoryChipActive: { backgroundColor: '#8DA67F', borderColor: '#8DA67F' },

  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: 16, padding: 16, backgroundColor: '#FFF4EB', borderRadius: 8, borderStyle: 'dashed', borderWidth: 1, borderColor: '#DB7F18' },
  addBtnText: { color: '#DB7F18', fontWeight: 'bold', fontSize: 16 },
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
  actionBtnEdit: { padding: 10, backgroundColor: '#F5F5F5', borderRadius: 8 },
  actionBtnTrash: { padding: 10, backgroundColor: '#FCE8E6', borderRadius: 8 },
  actionBtnTruck: { padding: 10, backgroundColor: '#E8F0FE', borderRadius: 8 },

  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  modalBody: { padding: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: '#F8F5E6', borderWidth: 1, borderColor: '#EAEAEA', borderRadius: 8, padding: 14, fontSize: 15, marginBottom: 12 },
  smallInput: { backgroundColor: '#F8F5E6', borderWidth: 1, borderColor: '#CCC', borderRadius: 8, fontSize: 14 },
  scannedItemBox: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#EAEAEA', marginBottom: 12 },

  supplierChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F8F5E6', borderWidth: 1, borderColor: '#EAEAEA', marginRight: 8 },
  supplierChipActive: { backgroundColor: '#F4F7F2', borderColor: '#8DA67F' },

  btnPrimaryFull: { backgroundColor: '#DB7F18', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  btnOutline: { padding: 16, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#CCC' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalSmallBox: { width: '85%', backgroundColor: '#FFF', padding: 24, borderRadius: 16, alignItems: 'center' }
});