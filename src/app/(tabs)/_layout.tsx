import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { initDB } from '../../db';

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
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: '#0190A0',
        tabBarInactiveTintColor: '#8E8E93',
        headerShown: false,
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

      {/* Schermata 3: Ordini */}
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Ordini',
          tabBarIcon: ({ color }) => <Ionicons name="receipt-outline" size={24} color={color} />,
        }}
      />

      {/* Schermata 4: Impostazioni */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Impostazioni',
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}