import React, { useState } from 'react';
import { Text, FlatList, StyleSheet, SafeAreaView, View } from 'react-native';
import { getProducts } from '../db';
import { useFocusEffect } from '@react-navigation/native';

export default function WarehouseScreen() {
  const [products, setProducts] = useState([]);

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
    // Logica per il colore dello stato
    let statusColor = '#4CAF50'; // Verde
    if (item.current_stock <= item.min_threshold) {
      statusColor = '#F44336'; // Rosso (Sotto scorta)
    } else if (item.current_stock <= item.min_threshold * 1.5) {
      statusColor = '#FFC107'; // Giallo (In esaurimento)
    }

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.title}>{item.name}</Text>
          <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.stockInfo}>
            <Text style={styles.label}>Giacenza</Text>
            <Text style={styles.stockValue}>{item.current_stock}</Text>
          </View>
          <View style={styles.stockInfo}>
            <Text style={styles.label}>Soglia Minima</Text>
            <Text style={styles.stockMin}>{item.min_threshold}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventario</Text>
      </View>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 20, backgroundColor: '#0B132B', borderBottomWidth: 1, borderColor: '#eee' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' },
  listContainer: { padding: 16 },
  card: { backgroundColor: '#FFFFFF', padding: 16, marginBottom: 12, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 3, borderWidth: 1, borderColor: '#F0F0F0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '600', color: '#1C2541' },
  statusIndicator: { width: 12, height: 12, borderRadius: 6 },
  cardBody: { flexDirection: 'row', justifyContent: 'flex-start', gap: 24 },
  stockInfo: { alignItems: 'flex-start' },
  label: { fontSize: 12, color: '#6C757D', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  stockValue: { fontSize: 20, fontWeight: 'bold', color: '#0B132B' },
  stockMin: { fontSize: 16, fontWeight: '500', color: '#6C757D' }
});