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
  // PaginationEllipsis, // Não utilizado no código atual
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { getReportData, type ReportData } from '@/lib/mockData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'; // Importe o componente

const ITEMS_PER_PAGE = 10;

export default function ReportsPage() {
  const [data, setData] = useState<ReportData[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const reportData = await getReportData();
      setData(reportData);
      setIsLoading(false);
    }
    loadData();
  }, []);

  const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentData = data.slice(startIndex, endIndex);

  // ... (resto do seu código, stats, getStatusBadge) ...
   const stats = {
    total: 1500,
    success: 1450,
    failed: 50,
  };

  const getStatusBadge = (status: ReportData['status']) => {
    switch (status) {
      case 'Enviado':
        return <Badge className="bg-green-600 hover:bg-green-700">Enviado</Badge>;
      case 'Falha':
        return <Badge variant="destructive">Falha</Badge>;
      case 'Pendente':
        return <Badge variant="secondary" className="bg-yellow-600 hover:bg-yellow-700">Pendente</Badge>;
    }
  };


  return (
    <ProtectedRoute> {/* Envolva o conteúdo com ProtectedRoute */}
      <AppLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Relatório de Envios</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ... Cards de estatísticas ... */}
             <Card>
                <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Enviado
                </CardTitle>
                </CardHeader>
                <CardContent>
                <div className="text-3xl font-bold">{stats.total}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    Sucessos
                </CardTitle>
                </CardHeader>
                <CardContent>
                <div className="text-3xl font-bold text-green-600">{stats.success}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    Falhas
                </CardTitle>
                </CardHeader>
                <CardContent>
                <div className="text-3xl font-bold text-red-600">{stats.failed}</div>
                </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de Envios</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : (
                <>
                  <Table>
                    {/* ... Tabela ... */}
                    <TableHeader>
                        <TableRow>
                        <TableHead>Contato</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data Envio</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentData.map((row) => (
                        <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.contato}</TableCell>
                            <TableCell>{row.telefone}</TableCell>
                            <TableCell>{getStatusBadge(row.status)}</TableCell>
                            <TableCell>
                            {format(row.dataEnvio, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                  </Table>

                  {totalPages > 1 && (
                    <div className="mt-4">
                      <Pagination>
                        {/* ... Paginação ... */}
                        <PaginationContent>
                            <PaginationItem>
                            <PaginationPrevious
                                href="#"
                                onClick={(e) => {
                                e.preventDefault();
                                if (currentPage > 1) setCurrentPage(currentPage - 1);
                                }}
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
