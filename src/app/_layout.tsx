import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../../auth'; 
import { initDB } from '../db';

// Componente per proteggere le rotte
function RootLayoutNav() {
  const { user, isLoading } = useAuth();
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