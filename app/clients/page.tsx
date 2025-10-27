// Linha 1: Adiciona a diretiva "use client"
"use client";

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { supabase } from '@/lib/supabaseClient';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge'; // Para exibir o tipo de cliente

const ITEMS_PER_PAGE = 15;

// Interface para os dados que esperamos da tabela (ajuste conforme necessário)
interface ClientHistoryData {
  id: string | number;
  client_name: string | null;
  client_phone: number | null;
  client_type: string | null;
  campaign_name: string | null;
  // Campos placeholder - precisarão ser buscados de outra fonte ou adicionados
  compras: number | null; // Exemplo
  receita: number | null; // Exemplo
  created_at: string; // Para ordenação ou informação adicional
}

export default function ClientsPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [clientData, setClientData] = useState<ClientHistoryData[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (isAuthLoading) return;

    const userPhoneString = user?.user_metadata?.phone as string | undefined;

    if (!user || !userPhoneString) {
      console.warn('Usuário não autenticado ou sem telefone para buscar clientes.');
      setClientData([]);
      setIsLoadingData(false);
      return;
    }

    const userPhoneNumeric = parseInt(userPhoneString.replace(/\D/g, ''), 10);
    if (isNaN(userPhoneNumeric)) {
      console.error('Número de telefone nos metadados do usuário inválido:', userPhoneString);
      setClientData([]);
      setIsLoadingData(false);
      return;
    }

    async function loadClientData() {
      setIsLoadingData(true);
      console.log(`Buscando dados de clientes para o usuário com telefone (metadata): ${userPhoneNumeric}...`);

      // Busca da tabela de histórico, selecionando campos relevantes
      // Idealmente, seria uma tabela 'clientes' separada ou um join
      const { data, error } = await supabase
        .from('historico_disparos') // Usando histórico por enquanto
        .select('id, client_name, client_phone, client_type, campaign_name, compras, receita, created_at')
        .eq('user_phone', userPhoneNumeric)
        .order('client_name', { ascending: true }) // Ordenar por nome de cliente
        .order('created_at', { ascending: false }); // Desempate por data

      if (error) {
        console.error('Erro ao buscar dados do Supabase:', error.message);
        setClientData([]);
      } else if (data) {
        console.log('Dados recebidos:', data);
        // Poderia haver um processamento aqui para agrupar por cliente,
        // mas por simplicidade, vamos exibir cada entrada do histórico.
        setClientData(data as ClientHistoryData[]);
      } else {
        setClientData([]);
      }

      setIsLoadingData(false);
    }

    loadClientData();
  }, [user, isAuthLoading]);

  const totalPages = Math.ceil(clientData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentData = clientData.slice(startIndex, endIndex);

  const showLoadingState = isLoadingData || isAuthLoading;

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Clientes</h1>

          <Card>
            <CardHeader>
              <CardTitle>Lista de Clientes</CardTitle>
              {/* Adicionar filtros aqui futuramente, se necessário */}
            </CardHeader>
            <CardContent>
              {showLoadingState ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : clientData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado.</div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Última Campanha</TableHead>
                        <TableHead>Compras</TableHead>
                        <TableHead>Receita</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentData.map((client) => (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium">{client.client_name || '-'}</TableCell>
                          <TableCell>{client.client_phone || '-'}</TableCell>
                          <TableCell>
                            {client.client_type ? <Badge variant="secondary">{client.client_type}</Badge> : '-'}
                          </TableCell>
                          <TableCell>{client.campaign_name || '-'}</TableCell>
                          {/* Ajuste a exibição conforme necessário */}
                          <TableCell>{client.compras ?? '-'}</TableCell>
                          <TableCell>{client.receita !== null ? client.receita.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Paginação */}
                  {totalPages > 1 && (
                    <div className="mt-4">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              href="#"
                              onClick={(e) => { e.preventDefault(); if (currentPage > 1) setCurrentPage(currentPage - 1); }}
                              aria-disabled={currentPage <= 1}
                              tabIndex={currentPage <= 1 ? -1 : undefined}
                              className={currentPage <= 1 ? "pointer-events-none opacity-50" : undefined}
                            />
                          </PaginationItem>
                          {/* Lógica simplificada de exibição de páginas */}
                           <PaginationItem>
                            <PaginationLink isActive>
                              {currentPage}
                            </PaginationLink>
                          </PaginationItem>
                           <PaginationItem>
                            <span className="px-2 text-sm text-muted-foreground">de {totalPages}</span>
                          </PaginationItem>
                          {/* Adicionar lógica de "..." se houver muitas páginas */}
                          <PaginationItem>
                            <PaginationNext
                              href="#"
                              onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) setCurrentPage(currentPage + 1); }}
                              aria-disabled={currentPage >= totalPages}
                              tabIndex={currentPage >= totalPages ? -1 : undefined}
                              className={currentPage >= totalPages ? "pointer-events-none opacity-50" : undefined}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}