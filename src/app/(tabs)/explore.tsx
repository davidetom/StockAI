import React, { useState } from 'react';
import { Text, FlatList, StyleSheet, SafeAreaView, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getProducts } from '../../db';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../../auth';

export default function WarehouseScreen() {
  const [products, setProducts] = useState([]);

  const { logout } = useAuth();

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    const data = await getProducts();
    setProducts(data);
  };

  const renderItem = ({ item }: { item: any }) => {
    // 1. Logica per lo stato e i colori basata sul tuo template
    let statusConfig = { bg: '#E6F4EA', text: '#1E8E3E', label: 'Sicuro', icon: 'shield-checkmark-outline' };

    if (item.current_stock === 0) {
      statusConfig = { bg: '#F1F3F4', text: '#5F6368', label: 'Non disp.', icon: 'ban-outline' };
    } else if (item.current_stock <= item.min_threshold) {
      statusConfig = { bg: '#FCE8E6', text: '#D93025', label: 'Critico', icon: 'warning-outline' };
    } else if (item.current_stock <= item.min_threshold * 1.5) {
      statusConfig = { bg: '#E8F0FE', text: '#1A73E8', label: 'In esaurim.', icon: 'calendar-outline' };
    }

    return (
      <View style={styles.card}>
        {/* Sinistra: Immagine Prodotto (Placeholder) */}
        <View style={styles.imagePlaceholder}>
          <Ionicons name="image-outline" size={24} color="#B0B0B0" />
        </View>

        {/* Centro: Info Prodotto */}
        <View style={styles.infoContainer}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.supplierText} numberOfLines={2}>{item.supplier_id}</Text>
        </View>

        {/* Destra: Badge Stato */}
        <View style={[styles.badge, { backgroundColor: statusConfig.bg }]}>
          <View style={styles.badgeHeader}>
            {/* @ts-ignore */}
            <Ionicons name={statusConfig.icon} size={12} color={statusConfig.text} style={{marginRight: 4}} />
            <Text style={[styles.badgeLabel, { color: statusConfig.text }]}>{statusConfig.label}</Text>
          </View>
          <Text style={[styles.badgeQuantity, { color: statusConfig.text }]}>
            {item.current_stock} {item.unit}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Ionicons name="menu-outline" size={28} color="#000" />
        <Text style={styles.headerTitle}>Magazzino</Text>
        <View style={styles.headerIcons}>
          <Ionicons name="search-outline" size={22} color="#000" style={styles.iconSpaced} />
          
          {/* Tasto Logout Nascosto/Integrato nell'header */}
          <TouchableOpacity onPress={logout}>
            <Ionicons name="log-out-outline" size={26} color="#D93025" />
          </TouchableOpacity>
        </View>
      </View>
      
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  iconSpaced: { marginRight: 16 },
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
  badgeQuantity: { fontSize: 14, fontWeight: '700' }
});