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

const ITEMS_PER_PAGE = 10;

// Interface atualizada para corresponder à tabela "historico_disparos"
interface HistoricoDisparo {
  id: string | number; // Supabase gera ID, pode ser número ou string dependendo da configuração
  criado_em: string; // Timestamp string ISO 8601
  nome_cliente: string | null;
  phone_cliente: number | null; // Alterado para number (numeric)
  mensagem: string | null;
  status: boolean | null; // Alterado para boolean
  nome_usuario: string | null;
  phone_usuario: number | null; // Alterado para number (numeric)
}

export default function ReportsPage() {
  const [data, setData] = useState<HistoricoDisparo[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0 });

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      console.log('Buscando dados do Supabase (historico_disparos)...');

      // Buscar dados da tabela 'historico_disparos' ordenados por 'criado_em'
      const { data: historicoData, error } = await supabase
        .from('historico_disparos')
        .select('*')
        .order('criado_em', { ascending: false }); // Ordenar pela data de criação

      if (error) {
        console.error('Erro ao buscar dados do Supabase:', error.message);
        setData([]);
      } else if (historicoData) {
        console.log('Dados recebidos:', historicoData);
        setData(historicoData);

        // Calcular estatísticas com base no status boolean
        const total = historicoData.length;
        const success = historicoData.filter(item => item.status === true).length;
        // Considera falha se status for false (ignora null ou outros casos por enquanto)
        const failed = historicoData.filter(item => item.status === false).length;
        setStats({ total, success, failed });
      } else {
        setData([]);
      }

      setIsLoading(false);
    }
    loadData();
  }, []);

  const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentData = data.slice(startIndex, endIndex);

  // Ajuste a função getStatusBadge para lidar com o status boolean
  const getStatusBadge = (status: boolean | null) => {
    if (status === true) {
      return <Badge className="bg-green-600 hover:bg-green-700">Enviado</Badge>;
    } else if (status === false) {
      return <Badge variant="destructive">Falha</Badge>;
    } else {
      // Caso seja null ou outro valor inesperado
      return <Badge variant="outline">Pendente/Desconhecido</Badge>;
    }
  };

  // Função para formatar a data 'criado_em'
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

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Relatório de Envios</h1>

          {/* Cards de Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Registros
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-3xl font-bold">{stats.total}</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Sucessos
                </CardTitle>
              </CardHeader>
              <CardContent>
               {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-3xl font-bold text-green-600">{stats.success}</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Falhas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-3xl font-bold text-red-600">{stats.failed}</div>}
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Histórico */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Envios</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
              ) : data.length === 0 ? (
                 <div className="text-center py-8 text-muted-foreground">Nenhum registro encontrado.</div>
              ) :(
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {/* Cabeçalhos atualizados */}
                        <TableHead>Cliente</TableHead>
                        <TableHead>Telefone Cliente</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data Envio</TableHead>
                        <TableHead>Usuário</TableHead>
                         {/* <TableHead>Mensagem</TableHead> Opcional */}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentData.map((row) => (
                        <TableRow key={row.id}>
                          {/* Campos atualizados */}
                          <TableCell className="font-medium">{row.nome_cliente || '-'}</TableCell>
                          <TableCell>{row.phone_cliente || '-'}</TableCell>
                          <TableCell>{getStatusBadge(row.status)}</TableCell>
                          <TableCell>{formatarData(row.criado_em)}</TableCell>
                          <TableCell>{row.nome_usuario || '-'}</TableCell>
                          {/* <TableCell className="max-w-xs truncate">{row.mensagem || '-'}</TableCell> Opcional */}
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
                              onClick={(e) => {
                                e.preventDefault();
                                if (currentPage > 1) setCurrentPage(currentPage - 1);
                              }}
                              aria-disabled={currentPage <= 1}
                              tabIndex={currentPage <= 1 ? -1 : undefined}
                              className={currentPage <= 1 ? "pointer-events-none opacity-50" : undefined}
                            />
                          </PaginationItem>
                          {/* Idealmente, adicionar lógica para mostrar apenas algumas páginas se houver muitas */}
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
