import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { initDB } from '../db';

export default function TabLayout() {
  // Inizializziamo il DB quando si avvia l'app
  useEffect(() => {
    initDB();
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F0F0F0',
          height: 85, // Altezza comoda per includere il testo
          paddingBottom: 25, // Spazio per la "home bar" di iPhone
          paddingTop: 10,
          elevation: 0, // Rimuove l'ombra su Android
          shadowOpacity: 0, // Rimuove l'ombra su iOS
        },
        tabBarActiveTintColor: '#0052FF', // Blu acceso del template
        tabBarInactiveTintColor: '#8E8E93', // Grigio spento
        headerShown: false, // Nascondiamo l'header di default perché usiamo i nostri
      }}>
      
      {/* Schermata 1: Chat */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chat IA',
          tabBarIcon: ({ color }) => <Ionicons name="chatbox-ellipses-outline" size={24} color={color} />,
        }}
      />
      
      {/* Schermata 2: Magazzino */}
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Magazzino',
          tabBarIcon: ({ color }) => <Ionicons name="cube-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}