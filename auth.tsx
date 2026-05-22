import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './src/supabase'; // Assicurati che il path sia corretto

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Helper per estrarre ruolo e nome dai metadati di Supabase e 
  // mantenere la compatibilità con il resto della tua app (user.role)
  const formatUser = (supabaseUser: any) => {
    if (!supabaseUser) return null;
    return {
      ...supabaseUser,
      role: supabaseUser.user_metadata?.role || 'STAFF', // Default fallback
      name: supabaseUser.user_metadata?.name || 'Utente',
    };
  };

  useEffect(() => {
    // 1. Controlla la sessione attiva all'avvio dell'app
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(formatUser(session?.user));
      setIsLoading(false);
    });

    // 2. Ascolta i cambiamenti di stato (Login, Logout, Token Refresh)
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(formatUser(session?.user));
      setIsLoading(false);
    });

    // Cleanup del listener quando il component viene smontato
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Il login ora accetta email e password al posto del semplice "role"
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      setIsLoading(false);
      throw error; // Questo errore potrà essere mostrato come Alert in login.tsx
    }
    // Non serve fare setUser qui, ci pensa onAuthStateChange!
  };

  // Funzione di logout reale
  const logout = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setIsLoading(false);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);