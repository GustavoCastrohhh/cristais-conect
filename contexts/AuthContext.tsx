"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient'; // Importe o cliente
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<{ error: Error | null }>; // Modificado para email
  logout: () => Promise<void>;
  isLoading: boolean; // Adicionado estado de carregamento
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Estado inicial de carregamento

  useEffect(() => {
    setIsLoading(true);
    // Tenta pegar a sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Ouve mudanças no estado de autenticação
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false); // Para de carregar quando o estado muda
      }
    );

    // Limpa o listener ao desmontar
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true); // Começa a carregar no login
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setIsLoading(false); // Para de carregar após a tentativa
    // O estado (user/session) será atualizado pelo onAuthStateChange
    return { error };
  };

  const logout = async () => {
    setIsLoading(true); // Começa a carregar no logout
    await supabase.auth.signOut();
    // O estado (user/session) será atualizado pelo onAuthStateChange
    // setIsLoading(false) será chamado no listener
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, session, login, logout, isLoading }}>
      {/* Só renderiza children quando não estiver carregando a sessão inicial */}
      {!isLoading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
