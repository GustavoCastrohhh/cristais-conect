"use client";

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { supabase } from '@/lib/supabaseClient';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';

const ITEMS_PER_PAGE = 10;

interface HistoricoDisparo {
  id: string | number;
  criado_em: string;
  nome_cliente: string | null;
  phone_cliente: number | null;
  mensagem: string | null;
  status: boolean | null;
  nome_usuario: string | null;
  phone_usuario: number | null;
}

export default function ReportsPage() {
  // Use user?.user_metadata?.phone para acessar o telefone
  const { user, isLoading: isAuthLoading } = useAuth(); // Renomeie isLoading do useAuth para evitar conflito
  const [data, setData] = useState<HistoricoDisparo[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingData, setIsLoadingData] = useState(true); // Estado de loading específico para os dados
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0 });

  useEffect(() => {
    // Não faça nada se a autenticação ainda estiver carregando
    if (isAuthLoading) {
        return;
    }

    // Verifica se o usuário está autenticado e tem o telefone nos metadados
    const userPhoneString = user?.user_metadata?.phone as string | undefined;

    if (!user || !userPhoneString) {
      console.warn('Usuário não autenticado ou sem telefone nos metadados para buscar histórico.');
      setData([]);
      setStats({ total: 0, success: 0, failed: 0 });
      setIsLoadingData(false); // Garante que o loading de dados termine
      return; // Sai do useEffect
    }

    // Convertendo o telefone do usuário para número para a comparação
    const userPhoneNumeric = parseInt(userPhoneString.replace(/\D/g, ''), 10);
    if (isNaN(userPhoneNumeric)) {
      console.error('Número de telefone nos metadados do usuário inválido:', userPhoneString);
      setData([]);
      setStats({ total: 0, success: 0, failed: 0 });
      setIsLoadingData(false); // Garante que o loading de dados termine
      return;
    }

    async function loadData() {
      setIsLoadingData(true); // Inicia o loading *dos dados*
      console.log(`Buscando dados do Supabase para o usuário com telefone (metadata): ${userPhoneNumeric}...`);

      const { data: historicoData, error } = await supabase
        .from('historico_disparos')
        .select('*')
        .eq('phone_usuario', userPhoneNumeric)
        .order('criado_em', { ascending: false });

      if (error) {
        console.error('Erro ao buscar dados do Supabase:', error.message);
        setData([]);
      } else if (historicoData) {
        console.log('Dados recebidos:', historicoData);
        setData(historicoData);

        const total = historicoData.length;
        const success = historicoData.filter(item => item.status === true).length;
        const failed = historicoData.filter(item => item.status === false).length;
        setStats({ total, success, failed });
      } else {
        setData([]);
      }

      setIsLoadingData(false); // Finaliza o loading *dos dados*
    }

    loadData();
    // A dependência agora é apenas 'user' e 'isAuthLoading'.
    // A busca será reativada se o usuário mudar ou quando a autenticação terminar de carregar.
  }, [user, isAuthLoading]);

  const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentData = data.slice(startIndex, endIndex);

  // Função getStatusBadge (sem alterações)
  const getStatusBadge = (status: boolean | null) => {
    if (status === true) {
      return <Badge className="bg-green-600 hover:bg-green-700">Enviado</Badge>;
    } else if (status === false) {
      return <Badge variant="destructive">Falha</Badge>;
    } else {
      return <Badge variant="outline">Pendente/Desconhecido</Badge>;
    }
  };

  // Função formatarData (sem alterações)
  const formatarData = (dataIso: string | null) => {
    if (!dataIso) return '-';
    try {
      const dataObj = parseISO(dataIso);
      return format(dataObj, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch (e) {
      console.error('Erro ao formatar data:', dataIso, e);
      return 'Data inválida';
    }
  };

  // Usa isLoadingData para os Skeletons e a mensagem de carregando
  const showLoadingState = isLoadingData || isAuthLoading;


  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Relatório de Envios</h1>

          {/* Cards de Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ... Cards ... Usam showLoadingState */}
             <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Registros
                </CardTitle>
              </CardHeader>
              <CardContent>
                {showLoadingState ? <Skeleton className="h-8 w-1/2" /> : <div className="text-3xl font-bold">{stats.total}</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Sucessos
                </CardTitle>
              </CardHeader>
              <CardContent>
               {showLoadingState ? <Skeleton className="h-8 w-1/2" /> : <div className="text-3xl font-bold text-green-600">{stats.success}</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Falhas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {showLoadingState ? <Skeleton className="h-8 w-1/2" /> : <div className="text-3xl font-bold text-red-600">{stats.failed}</div>}
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Histórico */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Envios</CardTitle>
            </CardHeader>
            <CardContent>
              {showLoadingState ? ( // Usa showLoadingState
                <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                // Verifica se terminou de carregar e não tem dados nem usuário/telefone válidos
              ) : data.length === 0 && (!user || !user.user_metadata?.phone || isNaN(parseInt(String(user.user_metadata.phone).replace(/\D/g,'')))) ? (
                <div className="text-center py-8 text-muted-foreground">Nenhum registro encontrado ou usuário sem telefone válido configurado.</div>
              ) : data.length === 0 ? ( // Terminou de carregar, tem usuário/telefone, mas não achou dados
                <div className="text-center py-8 text-muted-foreground">Nenhum registro encontrado para este usuário.</div>
              ) : ( // Terminou de carregar e tem dados
                <>
                  <Table>
                    {/* ... TableHeader e TableBody como antes ... */}
                      <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Telefone Cliente</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data Envio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentData.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.nome_cliente || '-'}</TableCell>
                          <TableCell>{row.phone_cliente || '-'}</TableCell>
                          <TableCell>{getStatusBadge(row.status)}</TableCell>
                          <TableCell>{formatarData(row.criado_em)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Paginação */}
                  {totalPages > 1 && (
                     <div className="mt-4">
                      {/* ... Paginação como antes ... */}
                       <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                if (currentPage > 1) setCurrentPage(currentPage - 1);
                              }}
                              aria-disabled={currentPage <= 1}
                              tabIndex={currentPage <= 1 ? -1 : undefined}
                              className={currentPage <= 1 ? "pointer-events-none opacity-50" : undefined}
                            />
                          </PaginationItem>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <PaginationItem key={page}>
                              <PaginationLink
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setCurrentPage(page);
                                }}
                                isActive={currentPage === page}
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          ))}
                          <PaginationItem>
                            <PaginationNext
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                              }}
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
