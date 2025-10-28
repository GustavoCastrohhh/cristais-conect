"use client";

import * as React from 'react'; // Import React
import { useState, useEffect, useMemo } from 'react'; // Import useMemo
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
import { Input } from '@/components/ui/input'; // Importar Input
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Importar Select
import { Label } from '@/components/ui/label'; // Importar Label
import { Button } from '@/components/ui/button'; // Importar Button
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { supabase } from '@/lib/supabaseClient';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';

const ITEMS_PER_PAGE = 10;

// Interface Atualizada
interface HistoricoDisparo {
  id: string | number;
  created_at: string;
  client_name: string | null;
  client_phone: number | null;
  message: string | null;
  status: boolean | null;
  user_name: string | null;
  user_phone: number | null;
  whatsapp_ver: boolean | null;
  remote_jid: string | null;
  campaign_name: string | null;
  client_type: string | null;
}


export default function ReportsPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [allData, setAllData] = useState<HistoricoDisparo[]>([]); // Todos os dados originais
  const [filteredData, setFilteredData] = useState<HistoricoDisparo[]>([]); // Dados após filtros
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0 });
  const [campaignNames, setCampaignNames] = useState<string[]>([]); // Nomes únicos de campanha
  const [selectedCampaign, setSelectedCampaign] = useState<string>(''); // Filtro de campanha
  const [phoneFilter, setPhoneFilter] = useState<string>(''); // Filtro de telefone

  // Efeito para buscar dados iniciais e nomes de campanha
  useEffect(() => {
    if (isAuthLoading) return;

    const userPhoneString = user?.user_metadata?.phone as string | undefined;
    if (!user || !userPhoneString) {
      console.warn('Usuário não autenticado ou sem telefone.');
      setAllData([]);
      setCampaignNames([]);
      setStats({ total: 0, success: 0, failed: 0 });
      setIsLoadingData(false);
      return;
    }

    const userPhoneNumeric = parseInt(userPhoneString.replace(/\D/g, ''), 10);
    if (isNaN(userPhoneNumeric)) {
      console.error('Telefone inválido:', userPhoneString);
      setAllData([]);
      setCampaignNames([]);
      setStats({ total: 0, success: 0, failed: 0 });
      setIsLoadingData(false);
      return;
    }

    async function loadData() {
      setIsLoadingData(true);
      const { data: historicoData, error } = await supabase
        .from('historico_disparos') // Tabela correta
        .select('*')
        .eq('user_phone', userPhoneNumeric) // Coluna correta
        .order('created_at', { ascending: false }); // Coluna correta

      if (error) {
        console.error('Erro Supabase:', error.message);
        setAllData([]);
        setCampaignNames([]);
        setStats({ total: 0, success: 0, failed: 0 });
      } else if (historicoData) {
        setAllData(historicoData);

        // Extrair nomes únicos de campanha (não nulos)
        const uniqueNames = Array.from(
          new Set(historicoData.map(item => item.campaign_name).filter(name => name !== null)) // Usa campaign_name
        ) as string[];
        setCampaignNames(uniqueNames.sort()); // Ordena alfabeticamente

        // Calcular estatísticas com base em allData (lógica inalterada)
        const total = historicoData.length;
        const success = historicoData.filter(item => item.status === true).length;
        const failed = total - success;
        setStats({ total, success, failed });

      } else {
        setAllData([]);
        setCampaignNames([]);
        setStats({ total: 0, success: 0, failed: 0 });
      }
      setIsLoadingData(false);
    }

    loadData();
  }, [user, isAuthLoading]);

  // Efeito para aplicar filtros quando 'allData' ou os filtros mudam
  useEffect(() => {
    let tempData = [...allData];

    // Aplicar filtro de campanha
    if (selectedCampaign && selectedCampaign !== 'all') {
      tempData = tempData.filter(item => item.campaign_name === selectedCampaign); // Usa campaign_name
    }

    // Aplicar filtro de telefone (busca parcial)
    if (phoneFilter.trim()) {
      const searchTerm = phoneFilter.replace(/\D/g, ''); // Remover não dígitos para busca
      tempData = tempData.filter(item =>
        item.client_phone?.toString().includes(searchTerm) // Usa client_phone
      );
    }

    setFilteredData(tempData);
    setCurrentPage(1); // Resetar para a primeira página ao aplicar filtros
  }, [allData, selectedCampaign, phoneFilter]);

  // Use filteredData para paginação e exibição na tabela
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentData = filteredData.slice(startIndex, endIndex);

  // Funções auxiliares (getStatusBadge, formatarData) permanecem as mesmas
  const getStatusBadge = (status: boolean | null) => {
     if (status === true) {
      return <Badge className="bg-green-600 hover:bg-green-700">Enviado</Badge>;
    } else if (status === false) {
      return <Badge variant="destructive">Falha</Badge>;
    } else {
      return <Badge variant="outline">Pendente/Desconhecido</Badge>;
    }
  };

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

  const handleClearFilters = () => {
    setSelectedCampaign('');
    setPhoneFilter('');
  };

  const showLoadingState = isLoadingData || isAuthLoading;

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Relatório de Envios</h1>

          {/* Cards de Estatísticas (usam stats de allData) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          {/* Seção de Filtros */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full md:w-auto space-y-2">
                <Label htmlFor="campaign-filter">Filtrar por Campanha</Label>
                <Select
                  value={selectedCampaign}
                  onValueChange={setSelectedCampaign}
                  disabled={showLoadingState || campaignNames.length === 0}
                >
                  <SelectTrigger id="campaign-filter">
                    <SelectValue placeholder="Todas as Campanhas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Campanhas</SelectItem>
                    {campaignNames.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 w-full md:w-auto space-y-2">
                <Label htmlFor="phone-filter">Filtrar por Telefone</Label>
                <Input
                  id="phone-filter"
                  placeholder="Digite o telefone do cliente..."
                  value={phoneFilter}
                  onChange={(e) => setPhoneFilter(e.target.value)}
                  disabled={showLoadingState}
                />
              </div>
              <Button
                variant="outline"
                onClick={handleClearFilters}
                disabled={showLoadingState || (!selectedCampaign && !phoneFilter)}
              >
                Limpar Filtros
              </Button>
            </CardContent>
          </Card>

          {/* Tabela de Histórico (usa currentData de filteredData) */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Envios</CardTitle>
            </CardHeader>
            <CardContent>
              {showLoadingState ? (
                <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
              ) : filteredData.length === 0 ? ( // Verifica dados filtrados
                <div className="text-center py-8 text-muted-foreground">
                    {allData.length === 0 ? "Nenhum registro encontrado para este usuário." : "Nenhum registro encontrado com os filtros aplicados."}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campanha</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Telefone Cliente</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data Envio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentData.map((row) => ( // Mapeia currentData
                        <TableRow key={row.id}>
                          {/* Usa os nomes corretos da interface */}
                          <TableCell className="font-medium">{row.campaign_name || '-'}</TableCell>
                          <TableCell>{row.client_name || '-'}</TableCell>
                          <TableCell>{row.client_phone || '-'}</TableCell>
                          <TableCell>{getStatusBadge(row.status)}</TableCell>
                          <TableCell>{formatarData(row.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Paginação (usa totalPages de filteredData) */}
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
                          {/* Lógica de paginação como antes */}
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                           .filter(page => page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1))
                           .map((page, index, arr) => (
                            <React.Fragment key={page}>
                              {index > 0 && page > arr[index - 1] + 1 && (
                                <PaginationItem>
                                  <span className="px-3">...</span>
                                </PaginationItem>
                              )}
                              <PaginationItem>
                                <PaginationLink
                                  href="#"
                                  onClick={(e) => { e.preventDefault(); setCurrentPage(page); }}
                                  isActive={currentPage === page}
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            </React.Fragment>
                          ))}
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