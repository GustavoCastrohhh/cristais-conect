// /app/clients/page.tsx
"use client";

import { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx'; // Importar a biblioteca xlsx
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
}

export default function ClientsPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false); // Estado unificado para leitura e envio
  const [parsedData, setParsedData] = useState<ContactRow[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Função para parsear CSV e XLSX
  const parseFile = (file: File): Promise<ContactRow[]> => {
    return new Promise((resolve, reject) => {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'csv') {
        Papa.parse<ContactRow>(file, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'), // Normaliza cabeçalhos
          complete: (results) => {
            if (results.errors.length > 0) {
              console.error("Erros ao parsear CSV:", results.errors);
              reject(new Error(`Erro ao ler CSV: ${results.errors[0]?.message || 'Verifique o formato.'}`));
            } else {
              const data = results.data;
              // Validar cabeçalhos essenciais
              const headers = results.meta.fields?.map(h => h.trim().toLowerCase().replace(/\s+/g, '_')) || [];
              if (!headers.includes('client_phone')) {
                reject(new Error('Coluna "client_phone" (ou similar) não encontrada na planilha.'));
                return;
              }
              if (!headers.includes('client_name')) {
                  reject(new Error('Coluna "client_name" (ou similar) não encontrada na planilha.'));
                  return;
              }
              // Filtrar linhas válidas (com telefone)
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
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = event.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            // Ler a primeira linha como array para pegar os headers crus
            const jsonDataHeaders = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "" }); // Adicionado defval

            if (!jsonDataHeaders || jsonDataHeaders.length < 1) {
                reject(new Error('Planilha XLSX vazia ou inválida.'));
                return;
            }

            // Normalizar cabeçalhos da primeira linha
            // CORREÇÃO APLICADA AQUI: Tipar jsonDataHeaders[0] como any[] ou unknown[]
            const rawHeaders = (jsonDataHeaders[0] as any[]).map(h => String(h ?? '').trim().toLowerCase().replace(/\s+/g, '_'));

            if (!rawHeaders.includes('client_phone')) {
                reject(new Error('Coluna "client_phone" (ou similar) não encontrada na planilha XLSX.'));
                return;
            }
             if (!rawHeaders.includes('client_name')) {
                reject(new Error('Coluna "client_name" (ou similar) não encontrada na planilha XLSX.'));
                return;
            }

            // Agora, converter para array de objetos usando os cabeçalhos normalizados
            // sheet_to_json sem header: 1 usará a primeira linha como cabeçalho automaticamente
             const dataObjects = XLSX.utils.sheet_to_json<ContactRow>(worksheet, {
                raw: false, // Tenta formatar datas e números
                // Não precisa mais especificar 'header' aqui, pois ele pega a primeira linha por padrão
                defval: "" // Preenche células vazias com string vazia
             }).map(row => {
                // Remapeia as chaves do objeto para o formato normalizado, caso o sheet_to_json não tenha pego corretamente
                const newRow: Partial<ContactRow> = {};
                for (const rawHeader of rawHeaders) {
                    // Encontra a chave original correspondente (case-insensitive e com espaços)
                    const originalKey = Object.keys(row).find(k => k.trim().toLowerCase().replace(/\s+/g, '_') === rawHeader);
                    if (originalKey) {
                        (newRow as any)[rawHeader] = (row as any)[originalKey];
                    }
                }
                 // Garante que as propriedades essenciais existam, mesmo que vazias
                 if (!('client_name' in newRow)) newRow.client_name = '';
                 if (!('client_phone' in newRow)) newRow.client_phone = '';
                return newRow as ContactRow;
            });


            // Filtrar linhas válidas (com telefone)
            const validData = dataObjects.filter(row => row.client_phone && String(row.client_phone).trim() !== '');
            resolve(validData);
          } catch (error: any) {
            console.error("Erro ao ler XLSX:", error);
            reject(new Error(`Erro ao processar arquivo XLSX: ${error.message}`));
          }
        };
        reader.onerror = (error) => {
          console.error("Erro no FileReader:", error);
          reject(new Error('Falha ao ler o arquivo XLSX.'));
        };
        reader.readAsBinaryString(file);
      } else {
        reject(new Error('Formato de arquivo inválido. Por favor, envie .csv ou .xlsx'));
      }
    });
  };

  const handleFileSelect = async (file: File | null) => {
    setSelectedFile(file);
    setParsedData([]); // Limpa dados anteriores
    setUploadProgress(null); // Reseta progresso
    if (file) {
      setIsProcessing(true); // Inicia processamento (leitura)
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
        setSelectedFile(null); // Desseleciona o arquivo em caso de erro
      } finally {
        setIsProcessing(false); // Finaliza processamento (leitura)
      }
    }
  };

  const handleImportContacts = async () => {
    if (!parsedData || parsedData.length === 0) {
      toast.error('Nenhum contato válido para importar', { description: 'Selecione um arquivo .csv ou .xlsx válido com a coluna "client_phone".' });
      return;
    }

    setIsProcessing(true); // Inicia processamento (envio)
    setUploadProgress(0); // Inicia progresso
    console.log('Iniciando importação para Supabase:', parsedData);

    const contactsToInsert = parsedData.map(contact => ({
      client_name: contact.client_name || null, // Garante null se não houver nome
      client_phone: String(contact.client_phone).replace(/\D/g, ''), // Limpa e converte para string
      // Adicione outros campos aqui se necessário
      // variavel_1: contact.variavel_1 || null,
    }));

    // Inserir em lotes para evitar sobrecarga (opcional, mas bom para muitos contatos)
    const BATCH_SIZE = 100;
    let successfulInserts = 0;
    let failedInserts = 0;
    const errors: string[] = [];

    for (let i = 0; i < contactsToInsert.length; i += BATCH_SIZE) {
        const batch = contactsToInsert.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
            .from('clientes') // Certifique-se que o nome da tabela está correto
            .upsert(batch, { onConflict: 'client_phone' }); // Usar upsert para evitar duplicados pelo telefone

        if (error) {
            console.error('Erro ao inserir lote no Supabase:', error);
            failedInserts += batch.length;
            errors.push(`Erro no lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
            // Decide se quer parar ou continuar em caso de erro no lote
            // break; // Para parar
        } else {
             successfulInserts += batch.length;
        }
         setUploadProgress(Math.round(((i + batch.length) / contactsToInsert.length) * 100));
    }


     setUploadProgress(100); // Garante 100% no final


    if (failedInserts > 0) {
        toast.error(`Falha ao importar ${failedInserts} contatos`, {
            description: ` ${successfulInserts} importados com sucesso. Erros: ${errors.slice(0, 2).join('; ')}${errors.length > 2 ? '...' : ''}`,
            duration: 10000 // Aumenta duração para ler erro
        });
    } else {
        toast.success('Importação Concluída!', {
            description: `${successfulInserts} contatos foram importados com sucesso.`,
        });
    }

    // Limpar estado após a importação
    setSelectedFile(null);
    setParsedData([]);
    setIsProcessing(false); // Finaliza processamento (envio)
     setTimeout(() => setUploadProgress(null), 1500); // Limpa barra de progresso após um tempo
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-bold">Gerenciar Clientes</h1>
            <div className="flex gap-2 flex-wrap">
                {/* Botão Importar Contatos */}
                <Button onClick={handleImportContacts} disabled={isProcessing || parsedData.length === 0}>
                   {isProcessing && uploadProgress !== null ? `Importando... ${uploadProgress}%` : (
                       <>
                         <UploadCloud className="mr-2 h-4 w-4" />
                         Importar Contatos ({parsedData.length})
                       </>
                   )}
                </Button>
                 {/* Botão Baixar Modelo */}
                <Link
                    href="/planilha-modelo.csv" // Garanta que o arquivo está na pasta public
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

          {/* Progresso da Importação */}
          {isProcessing && uploadProgress !== null && (
               <Progress value={uploadProgress} className="w-full h-2 mt-2" />
           )}


          {/* Seção Upload */}
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
                 A planilha deve conter as colunas obrigatórias: <strong>client_name</strong> e <strong>client_phone</strong>. Outras colunas podem ser adicionadas para variáveis.
               </p>
          </div>

          {/* TODO: Adicionar aqui a listagem/gerenciamento de clientes existentes */}
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