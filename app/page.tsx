"use client";

import { useState } from 'react';
import Papa from 'papaparse';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { FileUpload } from '@/components/FileUpload';
import { Textarea } from '@/components/ui/textarea';
import { Button, buttonVariants } from '@/components/ui/button'; // Import buttonVariants
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
import Link from 'next/link'; // Import Link
import { Download } from 'lucide-react'; // Import Download icon
import { cn } from '@/lib/utils'; // Import cn if not already

export default function Home() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // General loading state (for sending)
  const [isReadingFile, setIsReadingFile] = useState(false); // Specific state for file reading
  const [parsedData, setParsedData] = useState<any[]>([]); // Initialize as empty array for safety

  // Function to insert variable text into the message textarea
  const insertVariable = (variable: string) => {
    setMessage((prev) => prev + variable);
  };

  // Function to parse the selected file (only CSV for now)
  const parseFile = (file: File): Promise<any[]> => { // Explicit return type Promise<any[]>
    return new Promise((resolve, reject) => {
      // Check file type extension
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (fileExtension !== 'csv') {
          // You could add support for xlsx here later using the 'xlsx' library
          reject(new Error('Formato de arquivo inválido. Por favor, envie um arquivo .csv'));
          return;
      }

      // Use Papaparse for CSV
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            console.error("Erros ao parsear CSV:", results.errors);
            // Pega a primeira mensagem de erro para exibir
            reject(new Error(`Erro ao ler CSV: ${results.errors[0]?.message || 'Verifique o formato.'}`));
          } else {
            const data = results.data as any[]; // Type assertion
            // Basic validation
            if (!results.meta.fields?.includes('telefone')) {
              reject(new Error('Coluna "telefone" não encontrada na planilha.'));
              return;
            }
            if (!results.meta.fields?.includes('nome')) {
                reject(new Error('Coluna "nome" não encontrada na planilha.'));
                return;
            }
             // Filter out rows without a phone number before resolving
            const validData = data.filter(row => row.telefone && String(row.telefone).trim() !== '');
            resolve(validData);
          }
        },
        error: (error: any) => { // Add type annotation for error
          console.error("Erro no Papaparse:", error);
          reject(new Error(`Não foi possível ler o arquivo CSV: ${error.message}`));
        }
      });
    });
  };

  // Handles reading the file when selected
  const handleFileRead = async (file: File | null) => {
    setSelectedFile(file);
    setParsedData([]); // Clear previous data

    if (file) {
      setIsReadingFile(true); // Start reading indicator
      try {
        const data = await parseFile(file);
        if (data.length === 0) {
            toast.warning("Planilha lida", { description: "Nenhum contato com telefone válido encontrado."});
        }
        setParsedData(data);
      } catch (error: any) {
        toast.error("Erro ao Ler Planilha", { description: error.message });
        setSelectedFile(null); // Deselect file on error
      } finally {
        setIsReadingFile(false); // Stop reading indicator
      }
    }
  };


  // Handles the final confirmation and sending to n8n
  const handleStartCampaign = async () => {
    // Basic check, though data should be parsed already if dialog is open
    if (!parsedData || parsedData.length === 0 || !message.trim()) {
      toast.error('Erro', {
        description: 'Não há contatos válidos ou a mensagem está vazia.',
      });
      setShowConfirmDialog(false);
      return;
    }

    // Get user info
    const userInfo = {
      nome: user?.user_metadata?.full_name || user?.email || 'Usuário Desconhecido',
      email: user?.email || 'Email não disponível',
      telefone: user?.user_metadata?.phone || 'Telefone não disponível'
    };

    setIsLoading(true); // Start sending indicator
    setShowConfirmDialog(false); // Close dialog

    const webhookUrl = 'https://n8nwebhook.cristaisdegramado.com.br/webhook/cristais_conecta';
    const payload = {
      message: message,
      contacts: parsedData,
      senderInfo: userInfo
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Try to get a better error message from the response body
        let errorBody = `Erro ${response.status} ao enviar para o webhook.`;
        try {
          const errorData = await response.json();
          // If n8n returns a JSON with a 'message' property, use it
          errorBody = errorData.message || JSON.stringify(errorData);
        } catch (e) {
          // If the response isn't JSON, try reading as text
           const textError = await response.text();
           if(textError) errorBody = textError;
        }
        throw new Error(errorBody); // Throw an error to be caught by the catch block
      }

      // Optional: Log the webhook response if it returns something useful
      const responseData = await response.json();
      console.log('Resposta do Webhook n8n:', responseData);

      toast.success('Sucesso!', {
        description: 'Sua campanha foi enviada para processamento.',
      });

      // Reset state on success
      setSelectedFile(null);
      setMessage('');
      setParsedData([]);

    } catch (error: any) {
      console.error('Falha ao enviar campanha:', error);
      toast.error('Falha no Envio', {
        description: error.message || 'Ocorreu um erro inesperado.',
      });
    } finally {
      setIsLoading(false); // Stop sending indicator
    }
  };
  // --- END OF UPDATED FUNCTION ---

   // Opens the confirmation dialog (data should be parsed by handleFileRead now)
   const handleConfirmClick = () => {
    if (!selectedFile) {
        toast.error('Erro', { description: 'Por favor, selecione um arquivo primeiro.' });
        return;
    }
    if (isReadingFile) {
        toast.warning('Aguarde', { description: 'Aguarde a leitura do arquivo terminar.' });
        return;
    }
     if (parsedData.length === 0) {
        toast.error('Erro', { description: 'Nenhum contato válido encontrado no arquivo selecionado.' });
        return;
    }
    if (!message.trim()) {
      toast.error('Erro', { description: 'Por favor, digite uma mensagem.' });
      return;
    }
    setShowConfirmDialog(true);
  };


  return ( // Make sure this return is inside the Home component scope
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold">Nova Campanha de Disparo</h1>

          <div className="space-y-2">
            <Label>Planilha de Contatos (.csv)</Label>
            {/* Pass handleFileRead to FileUpload */}
            <FileUpload onFileSelect={handleFileRead} selectedFile={selectedFile} />

            {/* Link para baixar modelo */}
             <div className="flex justify-center pt-2">
               <Link
                 href="/planilha-modelo.csv" // Make sure this file exists in your /public folder
                 download
                 className={cn(
                   buttonVariants({ variant: "outline", size: "sm" }),
                   "gap-2"
                 )}
               >
                 <Download className="h-4 w-4" />
                 Baixar Modelo CSV
               </Link>
             </div>

             {/* Feedback Visual sobre Leitura/Contagem */}
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
            <div className="flex gap-2 mb-2 flex-wrap"> {/* Added flex-wrap */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertVariable('{{nome}}')}
                // disabled={parsedData.length === 0} // Optionally disable if no contacts
              >
                Inserir {'{{nome}}'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertVariable('{{variavel_1}}')}
                // disabled={parsedData.length === 0} // Optionally disable if no contacts
              >
                Inserir {'{{variavel_1}}'}
              </Button>
              {/* Add more buttons if needed */}
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
            disabled={isReadingFile || isLoading} // Disable while reading or sending
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
  ); // End of main return
} // End of Home component