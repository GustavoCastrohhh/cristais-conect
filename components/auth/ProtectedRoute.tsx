"use client"; // Necessário pois usa hooks (useAuth, useRouter, useEffect)

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton'; // Opcional: para mostrar um loading

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Se não está carregando e não está autenticado, redireciona para login
    if (!isLoading && !isAuthenticated) {
      console.log('ProtectedRoute: Usuário não autenticado, redirecionando para /login');
      router.replace('/login'); // Use replace para não adicionar a página protegida ao histórico
    }
  }, [isLoading, isAuthenticated, router]);

  // Se estiver carregando a verificação inicial, mostre um loader ou nada
  if (isLoading) {
    // Você pode retornar um componente de Skeleton/Loading mais elaborado
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="space-y-2">
                <Skeleton className="h-8 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-4 w-[200px]" />
            </div>
      </div>
    ); // Ou simplesmente 'return null;' se preferir não mostrar nada
  }

  // Se estiver autenticado, renderiza o conteúdo da página
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Se não estiver carregando e não estiver autenticado (já sendo redirecionado pelo useEffect),
  // retorna null para evitar piscar o conteúdo antes do redirecionamento
  return null;
}
