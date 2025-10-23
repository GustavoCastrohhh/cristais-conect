"use client";

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { FileUpload } from '@/components/FileUpload';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
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

// Interface para os dados lidos da planilha
interface ContactData {
  nome?: string; // Assumindo coluna 'nome'
  telefone: string; // Assumindo coluna 'telefone' (obrigatória)
  variavel_1?: string; // Assumindo coluna 'variavel_1'
  // Adicione outras colunas que você espera ler
  [key: string]: any; // Permite outras colunas
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ContactData[]>([]); // Estado para os dados lidos
  const [message, setMessage] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Loading do envio da campanha
  const [isReadingFile, setIsReadingFile] = useState(false); // Loading da leitura do arquivo

  const insertVariable = (variable: string) => {
    setMessage((prev) => prev + variable);
  };

  const handleFileRead = async (file: File | null) => {
    setSelectedFile(file); // Atualiza o estado do arquivo selecionado
    setParsedData([]); // Limpa dados anteriores

    if (!file) {
      return;
    }

    setIsReadingFile(true); // Indica que a leitura começou
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const fileContent = event.target?.result;
        if (!fileContent) {
          throw new Error('Não foi possível ler o conteúdo do arquivo.');
        }

        let data: ContactData[] = [];
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
          // Ler arquivos Excel (xlsx, xls)
          const workbook = XLSX.read(fileContent, { type: 'array' });
          const sheetName = workbook.SheetNames[0]; // Pega a primeira planilha
          const worksheet = workbook.Sheets[sheetName];
          // Converte para JSON, header: 1 cria array de arrays, defval preenche células vazias
          const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

          if (jsonData.length < 2) { // Precisa de cabeçalho + pelo menos uma linha de dados
             throw new Error('Planilha vazia ou sem cabeçalho.');
          }

          const headers = jsonData[0].map(String); // Pega cabeçalhos da primeira linha
          const rows = jsonData.slice(1); // Pega as linhas de dados

          data = rows.map(row => {
            const rowData: ContactData = { telefone: '' }; // Inicializa com telefone obrigatório
            headers.forEach((header, index) => {
                // Tenta mapear colunas comuns, normalizando nomes (minúsculas, sem acentos/espaços)
                const normalizedHeader = header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '');
                if (normalizedHeader === 'nome' || normalizedHeader === 'nomecliente') {
                   rowData.nome = String(row[index] || '');
                } else if (normalizedHeader === 'telefone' || normalizedHeader === 'phone' || normalizedHeader === 'celular') {
                   // Limpa caracteres não numéricos do telefone antes de salvar
                   rowData.telefone = String(row[index] || '').replace(/\D/g, '');
                } else if (normalizedHeader === 'variavel1' || normalizedHeader === 'variavel_1') {
                   rowData.variavel_1 = String(row[index] || '');
                } else {
                   // Adiciona outras colunas se existirem
                   rowData[header] = row[index];
                }
            });
            return rowData;
          }).filter(contact => contact.telefone && contact.telefone.length > 8); // Filtra linhas sem telefone ou telefone muito curto

          // Para XLSX, atualiza o estado aqui
          if (data.length === 0) {
             toast.warning('Aviso', { description: 'Nenhum contato com telefone válido encontrado na planilha.' });
          } else {
              setParsedData(data);
              console.log("Dados XLSX lidos:", data);
              toast.success('Planilha lida', { description: `${data.length} contatos encontrados.` });
          }

        } else if (fileName.endsWith('.csv')) {
          // Ler arquivos CSV
          const csvContent = event.target?.result as string; // Lê como texto para papaparse
           Papa.parse<any>(csvContent, { // Use <any> ou defina um tipo mais estrito se souber as colunas
            header: true, // Usa a primeira linha como cabeçalho
            skipEmptyLines: true,
            transformHeader: (header) => header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ''), // Normaliza cabeçalhos do CSV também
            complete: (results) => {
              if (results.errors.length > 0) {
                 console.error("Erros ao parsear CSV:", results.errors);
              }

              // Mapeia os dados usando os cabeçalhos normalizados
              data = (results.data as any[]).map(row => ({
                    nome: row.nome || row.nomecliente || '', // Usa cabeçalhos normalizados
                    // Limpa caracteres não numéricos do telefone
                    telefone: String(row.telefone || row.phone || row.celular || '').replace(/\D/g, ''),
                    variavel_1: row.variavel1 || row.variavel_1 || '',
                    // Adicione outras colunas aqui se necessário, usando nomes normalizados
                 })).filter(contact => contact.telefone && contact.telefone.length > 8); // Filtra linhas sem telefone válido

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
              setIsReadingFile(false); // Finaliza loading após processar CSV
            },
             error: (error: Error) => {
                 console.error("Erro PapaParse:", error);
                 toast.error('Erro ao ler CSV', { description: error.message });
                 setIsReadingFile(false); // Finaliza o loading em caso de erro
             }
          });
          // Não coloque setIsReadingFile(false) aqui para CSV, pois ele termina no 'complete'
          return; // Retorna pois o processamento CSV é feito no callback 'complete'

        } else {
          throw new Error('Formato de arquivo não suportado (.xlsx, .xls ou .csv).');
        }

      } catch (error: any) {
        console.error("Erro ao processar arquivo:", error);
        toast.error('Erro ao ler planilha', { description: error.message || 'Não foi possível processar o arquivo.' });
        setSelectedFile(null); // Limpa seleção em caso de erro
        setParsedData([]);
      } finally {
        // Garante que o loading termine para XLSX e XLS ou em caso de erro inicial
        if (!file.name.toLowerCase().endsWith('.csv')) {
             setIsReadingFile(false);
        }
      }
    };

    reader.onerror = (error) => {
        console.error("Erro do FileReader:", error);
        toast.error('Erro de Leitura', { description: 'Não foi possível ler o arquivo selecionado.' });
        setSelectedFile(null);
        setParsedData([]);
        setIsReadingFile(false);
    };

    // Decide como ler o arquivo baseado na extensão
    if (fileName.endsWith('.csv')) {
        reader.readAsText(file); // PapaParse precisa de texto
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        reader.readAsArrayBuffer(file); // SheetJS prefere ArrayBuffer
    } else {
        toast.error('Erro', { description: 'Formato de arquivo inválido (.xlsx, .xls ou .csv).' });
        setSelectedFile(null);
        setIsReadingFile(false);
    }
  };

  const handleConfirmClick = () => {
    // Verifica se há dados lidos e mensagem
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

  const handleStartCampaign = async () => {
    setIsLoading(true);

    // LOG: Mostra os dados que seriam usados
    console.log("Iniciando campanha com os seguintes dados:", parsedData);
    console.log("Mensagem:", message);

    // AQUI você adicionaria a lógica real de envio,
    // iterando sobre `parsedData` e substituindo as variáveis na `message`
    // Exemplo:
    // for (const contact of parsedData) {
    //   let finalMessage = message.replace('{{nome}}', contact.nome || '');
    //   finalMessage = finalMessage.replace('{{variavel_1}}', contact.variavel_1 || '');
    //   // Chamar API de envio com contact.telefone e finalMessage
    //   await sendToApi(contact.telefone, finalMessage);
    // }

    // Simulação de envio (manter por enquanto)
    await new Promise(resolve => setTimeout(resolve, 2000));

    toast.success('Sucesso', {
      description: `Sua campanha para ${parsedData.length} contatos foi enviada para a fila de disparo.`,
    });

    setIsLoading(false);
    setShowConfirmDialog(false);
    setSelectedFile(null);
    setParsedData([]); // Limpa os dados lidos
    setMessage('');
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold">Nova Campanha de Disparo</h1>

          <div className="space-y-2">
            <Label>Planilha de Contatos (.xlsx, .xls, .csv)</Label>
            {/* Passa handleFileRead para onFileSelect */}
            <FileUpload onFileSelect={handleFileRead} selectedFile={selectedFile} />
            {/* Mostra indicador de leitura */}
            {isReadingFile && <p className="text-sm text-muted-foreground mt-2 animate-pulse">Lendo arquivo...</p>}
            {/* Mostra contagem após leitura */}
            {parsedData.length > 0 && !isReadingFile && (
                <p className="text-sm text-green-600 mt-2">{parsedData.length} contatos válidos carregados.</p>
            )}
             {selectedFile && parsedData.length === 0 && !isReadingFile && (
                <p className="text-sm text-red-600 mt-2">Nenhum contato com telefone válido encontrado no arquivo.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <div className="flex gap-2 mb-2 flex-wrap"> {/* Adicionado flex-wrap */}
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
              {/* Adicione botões para outras variáveis se houver */}
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
            disabled={isReadingFile || isLoading} // Desabilita enquanto lê ou envia
          >
            {isLoading ? 'Enviando Campanha...' : 'Disparar Campanha'}
          </Button>

          {/* AlertDialog (sem alterações significativas) */}
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