import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setAuthToken } from './api';

export type Role = 'customer' | 'provider' | 'admin';
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  is_verified: boolean;
  created_at: string;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signUp: (name: string, email: string, password: string, role: Role, phone?: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem('ts_token');
      if (t) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
        } catch {
          await setAuthToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    await setAuthToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const signUp = async (name: string, email: string, password: string, role: Role, phone?: string) => {
    const res = await api.post('/auth/register', { name, email, password, role, phone });
    await setAuthToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const signOut = async () => {
    await setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
