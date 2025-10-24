"use client";

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { FileUpload } from '@/components/FileUpload';
import { Textarea } from '@/components/ui/textarea';
import { Button, buttonVariants } from '@/components/ui/button'; // Importar buttonVariants
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import * as XLSX from 'xlsx'; // Importar xlsx
import Papa from 'papaparse'; // Importar papaparse
import { Download } from 'lucide-react'; // Importar o ícone Download
import Link from 'next/link'; // Importar Link para o download
import { cn } from '@/lib/utils'; // Importar cn

// Interface para os dados lidos da planilha
interface ContactData {
  nome?: string;
  telefone: string;
  variavel_1?: string;
  [key: string]: any;
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ContactData[]>([]);
  const [message, setMessage] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);

  const insertVariable = (variable: string) => {
    setMessage((prev) => prev + variable);
  };

  const handleFileRead = async (file: File | null) => {
    setSelectedFile(file);
    setParsedData([]);

    if (!file) {
      return;
    }

    setIsReadingFile(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const fileContent = event.target?.result;
        if (!fileContent) {
          throw new Error('Não foi possível ler o conteúdo do arquivo.');
        }

        let data: ContactData[] = [];
        const fileNameInsideOnload = file.name.toLowerCase();

        if (fileNameInsideOnload.endsWith('.xlsx') || fileNameInsideOnload.endsWith('.xls')) {
          const workbook = XLSX.read(fileContent, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

          if (jsonData.length < 2) {
             throw new Error('Planilha vazia ou sem cabeçalho.');
          }

          const headers = jsonData[0].map(String);
          const rows = jsonData.slice(1);

          data = rows.map(row => {
            const rowData: ContactData = { telefone: '' };
            headers.forEach((header, index) => {
                const normalizedHeader = header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '');
                if (normalizedHeader === 'nome' || normalizedHeader === 'nomecliente') {
                   rowData.nome = String(row[index] || '');
                } else if (normalizedHeader === 'telefone' || normalizedHeader === 'phone' || normalizedHeader === 'celular') {
                   rowData.telefone = String(row[index] || '').replace(/\D/g, '');
                } else if (normalizedHeader === 'variavel1' || normalizedHeader === 'variavel_1') {
                   rowData.variavel_1 = String(row[index] || '');
                } else {
                   rowData[header] = row[index];
                }
            });
            return rowData;
          }).filter(contact => contact.telefone && contact.telefone.length > 8);

          if (data.length === 0) {
             toast.warning('Aviso', { description: 'Nenhum contato com telefone válido encontrado na planilha.' });
          } else {
              setParsedData(data);
              console.log("Dados XLSX lidos:", data);
              toast.success('Planilha lida', { description: `${data.length} contatos encontrados.` });
          }

        } else if (fileNameInsideOnload.endsWith('.csv')) {
          const csvContent = event.target?.result as string;
           Papa.parse<any>(csvContent, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ''),
            complete: (results) => {
              if (results.errors.length > 0) {
                 console.error("Erros ao parsear CSV:", results.errors);
              }

              console.log('Dados brutos lidos pelo PapaParse:', results.data);

              data = (results.data as any[]).map(row => {
                const contact = {
                    nome: row.nome || row.nomecliente || '',
                    telefone: String(row.telefone || row.phone || row.celular || '').replace(/\D/g, ''),
                    variavel_1: row.variavel1 || '',
                };
                console.log('Contato processado (antes do filtro):', contact);
                return contact;
              }).filter(contact => contact.telefone && contact.telefone.length > 8);

              if (data.length === 0 && results.data.length > 0) {
                 toast.warning('Aviso', { description: 'Nenhum contato com telefone válido encontrado na planilha CSV.' });
              } else if (data.length > 0) {
                 setParsedData(data);
                 console.log("Dados CSV lidos:", data);
                 toast.success('Planilha lida', { description: `${data.length} contatos encontrados.` });
              } else if (results.errors.length > 0) {
                 toast.error('Erro ao ler CSV', { description: 'Verifique o formato do arquivo e tente novamente.' });
              } else {
                 toast.warning('Aviso', { description: 'Planilha CSV vazia ou sem dados válidos.' });
              }
              setIsReadingFile(false);
            },
             error: (error: Error) => {
                 console.error("Erro PapaParse:", error);
                 toast.error('Erro ao ler CSV', { description: error.message });
                 setIsReadingFile(false);
             }
          });
          return;

        } else {
          throw new Error('Formato de arquivo não suportado (.xlsx, .xls ou .csv).');
        }

      } catch (error: any) {
        console.error("Erro ao processar arquivo:", error);
        toast.error('Erro ao ler planilha', { description: error.message || 'Não foi possível processar o arquivo.' });
        setSelectedFile(null);
        setParsedData([]);
      } finally {
        const currentFileName = file?.name?.toLowerCase();
        if (currentFileName && !currentFileName.endsWith('.csv')) {
             setIsReadingFile(false);
        } else if (!currentFileName && !fileName.endsWith('.csv')) { // Fallback adicionado aqui também
             setIsReadingFile(false);
        }
      }
    }; // Fim do reader.onload

    reader.onerror = (error) => {
        console.error("Erro do FileReader:", error);
        toast.error('Erro de Leitura', { description: 'Não foi possível ler o arquivo selecionado.' });
        setSelectedFile(null);
        setParsedData([]);
        setIsReadingFile(false);
    };

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv')) {
        reader.readAsText(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        reader.readAsArrayBuffer(file);
    } else {
        toast.error('Erro', { description: 'Formato de arquivo inválido (.xlsx, .xls ou .csv).' });
        setSelectedFile(null);
        setParsedData([]);
        setIsReadingFile(false);
    }
  }; // Fim da função handleFileRead

  const handleConfirmClick = () => {
    if (parsedData.length === 0 || !message.trim()) {
      toast.error('Erro', {
        description: parsedData.length === 0
          ? 'Por favor, selecione e carregue uma planilha com contatos válidos (coluna telefone).'
          : 'Por favor, digite uma mensagem.',
      });
      return;
    }
    setShowConfirmDialog(true);
  };

  // --- FUNÇÃO handleStartCampaign ATUALIZADA ---
  const handleStartCampaign = async () => {
    setIsLoading(true);
    const webhookUrl = 'https://n8nwebhook.cristaisdegramado.com.br/webhook/cristais_conecta';

    console.log("Iniciando campanha - Dados a enviar:", parsedData);
    console.log("Mensagem:", message);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Envia a mensagem e a lista de contatos no corpo da requisição
        body: JSON.stringify({
          message: message,
          contacts: parsedData,
        }),
      });

      // Verifica se a resposta do webhook foi bem-sucedida (status 2xx)
      if (!response.ok) {
        // Tenta ler uma mensagem de erro do corpo da resposta, se houver
        let errorBody = `Erro ${response.status} ao enviar para o webhook.`;
        try {
          const errorData = await response.json();
          // Se o n8n retornar um JSON com uma propriedade 'message', use-a
          errorBody = errorData.message || JSON.stringify(errorData);
        } catch (e) {
          // Se a resposta não for JSON, tenta ler como texto
           const textError = await response.text();
           if(textError) errorBody = textError;
        }
        throw new Error(errorBody); // Lança um erro para ser pego pelo catch
      }

      // Opcional: Logar a resposta do webhook se ele retornar algo útil
      const responseData = await response.json();
      console.log('Resposta do Webhook n8n:', responseData);

      toast.success('Sucesso!', {
        description: `Campanha para ${parsedData.length} contatos enviada com sucesso para processamento.`,
      });

      // Limpa os dados do formulário somente após o envio bem-sucedido
      setSelectedFile(null);
      setParsedData([]);
      setMessage('');
      setShowConfirmDialog(false);

    } catch (error: any) {
      // Captura erros de rede ou erros lançados por respostas não-ok
      console.error('Erro ao enviar para o webhook:', error);
      toast.error('Erro ao Enviar Campanha', {
        description: `Falha ao enviar dados: ${error.message || 'Verifique a URL do webhook ou a conexão.'}`,
      });
      // Mantém o diálogo aberto e os dados preenchidos para o usuário tentar novamente se quiser
      setShowConfirmDialog(true); // Reabre ou mantém o diálogo aberto
    } finally {
      setIsLoading(false); // Garante que o estado de loading termine, mesmo com erro
    }
  };
  // --- FIM DA FUNÇÃO ATUALIZADA ---

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold">Nova Campanha de Disparo</h1>

          <div className="space-y-2">
            <Label>Planilha de Contatos (.xlsx, .xls, .csv)</Label>
            <FileUpload onFileSelect={handleFileRead} selectedFile={selectedFile} />

            <div className="flex justify-center pt-2">
              <Link
                href="/planilha-modelo.xlsx"
                download
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "gap-2"
                )}
              >
                <Download className="h-4 w-4" />
                Baixar Modelo de Planilha
              </Link>
            </div>

            {isReadingFile && <p className="text-sm text-muted-foreground mt-2 animate-pulse">Lendo arquivo...</p>}
            {parsedData.length > 0 && !isReadingFile && (
                <p className="text-sm text-green-600 mt-2">{parsedData.length} contatos válidos carregados.</p>
            )}
             {selectedFile && parsedData.length === 0 && !isReadingFile && (
                <p className="text-sm text-red-600 mt-2">Nenhum contato com telefone válido encontrado no arquivo.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <div className="flex gap-2 mb-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertVariable('{{nome}}')}
              >
                Inserir {'{{nome}}'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertVariable('{{variavel_1}}')}
              >
                Inserir {'{{variavel_1}}'}
              </Button>
            </div>
            <Textarea
              id="message"
              placeholder="Digite sua mensagem aqui... Use {{nome}} para o nome do cliente e {{variavel_1}} para a variável personalizada."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Variáveis disponíveis: {'{{nome}}'}, {'{{variavel_1}}'}
            </p>
          </div>

          <Button
            onClick={handleConfirmClick}
            size="lg"
            className="w-full"
            disabled={isReadingFile || isLoading}
          >
            {isLoading ? 'Enviando Campanha...' : 'Disparar Campanha'}
          </Button>

          <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Disparo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Você está prestes a enviar a mensagem definida para{' '}
                  <span className="font-semibold">{parsedData.length}</span>{' '}
                  contatos da lista{' '}
                  <span className="font-semibold">{selectedFile?.name}</span>.
                  <br />
                   Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleStartCampaign}
                  disabled={isLoading}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isLoading ? 'Enviando...' : 'Confirmar Disparo'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}