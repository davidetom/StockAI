import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../../auth'; 
import { initDB } from '../db';
import { SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Componente per proteggere le rotte
function RootLayoutNav() {
  const { user, isLoading, logout } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initDB();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    // Verifichiamo se l'utente si trova fisicamente sulla pagina di login
    const isLoginScreen = segments[0] === 'login';

    if (!user && !isLoginScreen) {
      // Se NON c'è un utente, e NON siamo sul login -> forza il login
      router.replace('/login' as any);
    } else if (user && isLoginScreen) {
      // Se c'è un utente, ma è incastrato sulla pagina di login -> forza la Home
      router.replace('/' as any);
    }
  }, [user, isLoading, segments]);

  if (user && user.status === 'pending') {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F5E6' }}>
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Ionicons name="time-outline" size={80} color="#DB7F18" />
          <Text style={{ fontSize: 24, fontWeight: 'bold', marginTop: 16, textAlign: 'center', color: '#111' }}>In Attesa di Approvazione</Text>
          <Text style={{ textAlign: 'center', color: '#666', marginTop: 12, fontSize: 16 }}>
            Il proprietario del locale deve approvare la tua richiesta prima che tu possa accedere al magazzino.
          </Text>
          <TouchableOpacity onPress={logout} style={{ marginTop: 32, paddingVertical: 14, paddingHorizontal: 32, backgroundColor: '#D93025', borderRadius: 8 }}>
            <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Disconnetti</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
    </Stack>
  );
}

// Avvolgiamo tutto nel provider
export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}