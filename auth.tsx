import React, { createContext, useState, useContext, useEffect } from 'react';
import { getAuthUser, loginUser, logoutUser } from './src/db';

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Controlla se c'è una sessione salvata all'avvio
    getAuthUser().then((session) => {
      setUser(session);
      setIsLoading(false);
    });
  }, []);

  const login = async (role: 'MANAGER' | 'STAFF') => {
    const session = await loginUser(role);
    setUser(session);
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);