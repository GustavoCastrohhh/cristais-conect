"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient'; // Importe o cliente
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isAdmin: boolean; // NOVO: Adicionar flag isAdmin
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Estado inicial de carregamento
  const isAdmin = !!user?.user_metadata?.role && user.user_metadata.role === 'admin'; // NOVO: Calcular isAdmin
  
  useEffect(() => {
    setIsLoading(true);
    // Tenta pegar a sessão inicial
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
         console.error('Erro ao buscar sessão inicial:', error.message); // Log de erro na busca inicial
      }
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Ouve mudanças no estado de autenticação
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Evento AuthStateChange:', event); // Log para acompanhar eventos
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

    if (error) {
      console.error('Erro no login:', error.message); // Adiciona log de erro
    }
    // O estado (user/session) será atualizado pelo onAuthStateChange
    return { error };
  };

  const logout = async () => {
    setIsLoading(true); // Começa a carregar no logout
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Erro no logout:', error.message); // Adiciona log de erro
    }
    // O estado (user/session) será atualizado pelo onAuthStateChange
    // setIsLoading(false) será chamado no listener
  };

  const isAuthenticated = !!user;

  return (
  <AuthContext.Provider value={{ isAuthenticated, user, session, login, logout, isLoading, isAdmin }}> // NOVO: Passar isAdmin no value
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