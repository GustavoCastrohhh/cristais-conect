"use client";

import { useState } from 'react';
import Papa from 'papaparse';
// Não importar 'xlsx' diretamente aqui
// import * as XLSX from 'xlsx';
import { AppLayout } from '@/components/layout/AppLayout';
import { FileUpload } from '@/components/FileUpload';
import { Button, buttonVariants } from '@/components/ui/button';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { toast } from 'sonner';
import Link from 'next/link';
import { Download, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient'; // Importar supabase
import { Progress } from '@/components/ui/progress'; // Importar Progress

// Interface para definir a estrutura esperada da linha do CSV/XLSX
interface ContactRow {
    client_name: string;
    client_phone: string | number; // Aceita string ou número para flexibilidade
    // Adicione outros campos se necessário, ex: variavel_1: string;
    [key: string]: any; // Permite outras colunas
}

export default function ClientsPage() {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false); // Estado unificado para leitura e envio
    const [parsedData, setParsedData] = useState<ContactRow[]>([]);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    // Função para normalizar cabeçalhos
    const normalizeHeader = (header: string): string => {
        return String(header ?? '').trim().toLowerCase().replace(/\s+/g, '_');
    }

    // Função para parsear CSV e XLSX
    const parseFile = (file: File): Promise<ContactRow[]> => {
        return new Promise(async (resolve, reject) => { // Tornar async para dynamic import
            const fileExtension = file.name.split('.').pop()?.toLowerCase();

            if (fileExtension === 'csv') {
                Papa.parse<ContactRow>(file, {
                    header: true,
                    skipEmptyLines: true,
                    transformHeader: normalizeHeader, // Usa a função de normalização
                    complete: (results) => {
                        if (results.errors.length > 0) {
                            console.error("Erros ao parsear CSV:", results.errors);
                            reject(new Error(`Erro ao ler CSV: ${results.errors[0]?.message || 'Verifique o formato.'}`));
                        } else {
                            const data = results.data;
                            const headers = results.meta.fields?.map(normalizeHeader) || [];
                            if (!headers.includes('client_phone')) {
                                reject(new Error('Coluna obrigatória "client_phone" não encontrada na planilha CSV.'));
                                return;
                            }
                            if (!headers.includes('client_name')) {
                                reject(new Error('Coluna obrigatória "client_name" não encontrada na planilha CSV.'));
                                return;
                            }
                            const validData = data.filter(row => row.client_phone && String(row.client_phone).trim() !== '');
                            resolve(validData);
                        }
                    },
                    error: (error: any) => {
                        console.error("Erro no Papaparse:", error);
                        reject(new Error(`Não foi possível ler o arquivo CSV: ${error.message}`));
                    }
                });
            } else if (fileExtension === 'xlsx') {
                try {
                    // Importar XLSX dinamicamente
                    const XLSX = await import('xlsx');
                    const reader = new FileReader();

                    reader.onload = (event) => {
                        try {
                            const data = event.target?.result;
                            const workbook = XLSX.read(data, { type: 'binary' });
                            const sheetName = workbook.SheetNames[0];
                            const worksheet = workbook.Sheets[sheetName];

                            // 1. Ler apenas a primeira linha para obter cabeçalhos brutos
                            const headerArray = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, range: 0, defval: "" })[0] || [];
                             if (headerArray.length === 0) {
                                reject(new Error('Planilha XLSX vazia ou sem cabeçalho.'));
                                return;
                            }
                            const rawHeaders = headerArray.map(normalizeHeader);

                             // 2. Validar cabeçalhos essenciais
                            if (!rawHeaders.includes('client_phone')) {
                                reject(new Error('Coluna obrigatória "client_phone" não encontrada na planilha XLSX.'));
                                return;
                            }
                            if (!rawHeaders.includes('client_name')) {
                                reject(new Error('Coluna obrigatória "client_name" não encontrada na planilha XLSX.'));
                                return;
                            }

                             // 3. Ler a planilha inteira como objetos
                             const dataObjectsRaw = XLSX.utils.sheet_to_json<any>(worksheet, {
                                 raw: false,
                                 defval: ""
                             });

                             // 4. Mapear para garantir chaves normalizadas
                             const dataObjectsNormalized = dataObjectsRaw.map(row => {
                                 const newRow: Partial<ContactRow> = {};
                                 rawHeaders.forEach((normalizedHeader, index) => {
                                     const originalKey = Object.keys(row)[index];
                                     if (originalKey !== undefined) {
                                         newRow[normalizedHeader] = row[originalKey];
                                     }
                                 });
                                  if (!('client_name' in newRow)) newRow.client_name = '';
                                  if (!('client_phone' in newRow)) newRow.client_phone = '';
                                 return newRow as ContactRow;
                             });

                            // 5. Filtrar linhas válidas
                            const validData = dataObjectsNormalized.filter(row => row.client_phone && String(row.client_phone).trim() !== '');
                            resolve(validData);

                        } catch (error: any) {
                            console.error("Erro ao processar XLSX após leitura:", error);
                            reject(new Error(`Erro ao processar arquivo XLSX: ${error.message}`));
                        }
                    };
                    reader.onerror = (error) => {
                        console.error("Erro no FileReader:", error);
                        reject(new Error('Falha ao ler o arquivo XLSX.'));
                    };
                    reader.readAsBinaryString(file);

                } catch(importError) {
                     console.error("Erro ao importar dinamicamente XLSX:", importError);
                     reject(new Error('Não foi possível carregar o processador de arquivos XLSX.'));
                }
            } else {
                reject(new Error('Formato de arquivo inválido. Por favor, envie .csv ou .xlsx'));
            }
        });
    };

    const handleFileSelect = async (file: File | null) => {
        setSelectedFile(file);
        setParsedData([]);
        setUploadProgress(null);
        if (file) {
            setIsProcessing(true);
            try {
                const data = await parseFile(file);
                if (data.length === 0) {
                    toast.warning("Planilha lida", { description: "Nenhum contato com telefone válido encontrado." });
                } else {
                    toast.info("Planilha Pronta", { description: `${data.length} contatos válidos encontrados. Clique em "Importar Contatos" para salvá-los.` });
                }
                setParsedData(data);
            } catch (error: any) {
                toast.error("Erro ao Ler Planilha", { description: error.message });
                setSelectedFile(null);
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const handleImportContacts = async () => {
        if (!parsedData || parsedData.length === 0) {
            toast.error('Nenhum contato válido para importar', { description: 'Selecione um arquivo .csv ou .xlsx válido com a coluna "client_phone".' });
            return;
        }

        setIsProcessing(true);
        setUploadProgress(0);
        console.log('Iniciando importação para Supabase:', parsedData);

        const contactsToInsert = parsedData.map(contact => ({
            client_name: contact.client_name || null,
            client_phone: String(contact.client_phone).replace(/\D/g, ''),
            // variavel_1: contact.variavel_1 || null,
        }));

        const BATCH_SIZE = 100;
        let successfulInserts = 0;
        let failedInserts = 0;
        const errors: string[] = [];

        for (let i = 0; i < contactsToInsert.length; i += BATCH_SIZE) {
            const batch = contactsToInsert.slice(i, i + BATCH_SIZE);
            const { error } = await supabase
                .from('clientes')
                .upsert(batch, { onConflict: 'client_phone' });

            if (error) {
                console.error('Erro ao inserir lote no Supabase:', error);
                failedInserts += batch.length;
                errors.push(`Erro no lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
                // break; // Descomente para parar no primeiro erro
            } else {
                successfulInserts += batch.length;
            }
            setUploadProgress(Math.min(100, Math.round(((i + batch.length) / contactsToInsert.length) * 100)));
        }

        if (failedInserts > 0) {
            toast.error(`Falha ao importar ${failedInserts} contatos`, {
                description: ` ${successfulInserts} importados com sucesso. Erros: ${errors.slice(0, 2).join('; ')}${errors.length > 2 ? '...' : ''}`,
                duration: 10000
            });
        } else {
            toast.success('Importação Concluída!', {
                description: `${successfulInserts} contatos foram importados com sucesso.`,
            });
        }

        setSelectedFile(null);
        setParsedData([]);
        setIsProcessing(false);
        setTimeout(() => setUploadProgress(null), 1500);
    };

    return (
        <ProtectedRoute>
            <AppLayout>
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h1 className="text-3xl font-bold">Gerenciar Clientes</h1>
                        <div className="flex gap-2 flex-wrap">
                            <Button onClick={handleImportContacts} disabled={isProcessing || parsedData.length === 0}>
                                {isProcessing && uploadProgress !== null ? `Importando... ${uploadProgress}%` : (
                                    <>
                                        <UploadCloud className="mr-2 h-4 w-4" />
                                        Importar Contatos ({parsedData.length})
                                    </>
                                )}
                            </Button>
                            <Link
                                href="/planilha-modelo.csv"
                                download
                                className={cn(
                                    buttonVariants({ variant: "outline" }),
                                    "gap-2"
                                )}
                            >
                                <Download className="h-4 w-4" />
                                Baixar Modelo CSV
                            </Link>
                        </div>
                    </div>

                    {isProcessing && uploadProgress !== null && (
                        <Progress value={uploadProgress} className="w-full h-2 mt-2" />
                    )}

                    <div className="space-y-2 pt-4">
                        <h2 className="text-xl font-semibold">Importar Nova Lista</h2>
                        <FileUpload onFileSelect={handleFileSelect} selectedFile={selectedFile} />
                        {isProcessing && uploadProgress === null && <p className="text-sm text-muted-foreground mt-2 animate-pulse">Lendo arquivo...</p>}
                        {parsedData.length > 0 && !isProcessing && (
                            <p className="text-sm text-green-600 mt-2">{parsedData.length} contatos válidos carregados. Clique em "Importar Contatos" para salvar.</p>
                        )}
                        {selectedFile && parsedData.length === 0 && !isProcessing && (
                            <p className="text-sm text-red-600 mt-2">Nenhum contato com telefone válido encontrado no arquivo.</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                            A planilha (.csv ou .xlsx) deve conter as colunas obrigatórias: <strong>client_name</strong> e <strong>client_phone</strong>.
                        </p>
                    </div>

                    <div className="border-t pt-6 mt-6">
                        <h2 className="text-xl font-semibold mb-4">Clientes Cadastrados</h2>
                        <div className="border border-dashed p-8 text-center text-muted-foreground">
                            (Listagem de clientes será implementada aqui)
                        </div>
                    </div>
                </div>
            </AppLayout>
        </ProtectedRoute>
    );
}