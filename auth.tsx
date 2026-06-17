import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './src/supabase'; // Assicurati che il path sia corretto

const AuthContext = createContext<any>(null);

let isRegistering = false;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Helper per estrarre ruolo, status e locale_id dalla tabella profiles
  const fetchProfile = async (supabaseUser: any) => {
    if (!supabaseUser) return null;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();
        
      if (data) {
        return {
          ...supabaseUser,
          role: data.role,
          status: data.status,
          locale_id: data.locale_id,
          username: data.username,
          name: supabaseUser.user_metadata?.name || 'Utente',
        };
      }
    } catch (e) {
      console.error("Errore nel recupero del profilo:", e);
    }
    
    // Fallback se il profilo non esiste o errore
    return {
      ...supabaseUser,
      role: 'STAFF', 
      status: 'pending',
      name: supabaseUser.user_metadata?.name || 'Utente',
    };
  };

  useEffect(() => {
    // 1. Controlla la sessione attiva all'avvio dell'app
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(await fetchProfile(session?.user));
      setIsLoading(false);
    });

    // 2. Ascolta i cambiamenti di stato (Login, Logout, Token Refresh)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (isRegistering) return; // Ignora gli aggiornamenti di stato durante la registrazione
      setSession(session);
      setUser(await fetchProfile(session?.user));
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
      throw error;
    }
  };

  const register = async (email: string, password: string, username: string, localeName: string, isNewLocale: boolean, existingLocaleId?: string) => {
    setIsLoading(true);
    isRegistering = true;
    
    try {
      // 0. Controlla prima se il locale esiste già (per evitare di creare l'utente e poi fallire)
      if (isNewLocale) {
        const { data: existingLocale } = await supabase.from('locali').select('id').eq('name', localeName).maybeSingle();
        if (existingLocale) {
           throw new Error("Esiste già un locale con questo nome. Scegline un altro o unisciti a quello esistente.");
        }
      }

      // 1. Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("Errore durante la registrazione.");
      }

      let localeId = existingLocaleId;
      let role = 'STAFF';
      let status = 'pending';

      // 2. Se è un nuovo locale, crealo
      if (isNewLocale) {
        const { data: localeData, error: localeError } = await supabase
          .from('locali')
          .insert({ name: localeName })
          .select('id')
          .single();
          
        if (localeError) throw localeError;
        
        localeId = localeData.id;
        role = 'PROPRIETARIO';
        status = 'approved';
      }

      // 3. Crea il profilo
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          locale_id: localeId,
          role,
          status,
          email,
          username
        });
        
      if (profileError) throw profileError;
      
      // 4. Aggiorna forzatamente lo stato utente per bypassare il fallback di onAuthStateChange
      setUser({
        ...authData.user,
        role,
        status,
        locale_id: localeId,
        username,
        name: authData.user.user_metadata?.name || 'Utente'
      });

    } catch (e: any) {
      setIsLoading(false);
      throw e;
    } finally {
      isRegistering = false;
      setIsLoading(false);
    }
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
    <AuthContext.Provider value={{ user, session, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);