"use client";

import { useState } from 'react';
import Papa from 'papaparse';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { FileUpload } from '@/components/FileUpload';
import { Textarea } from '@/components/ui/textarea';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input'; // Importar Input
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
import Link from 'next/link';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Home() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [campaignName, setCampaignName] = useState(''); // NOVO ESTADO: Nome da Campanha
  const [message, setMessage] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [parsedData, setParsedData] = useState<any[]>([]);

  const insertVariable = (variable: string) => {
    setMessage((prev) => prev + variable);
  };

  const parseFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (fileExtension !== 'csv') {
          reject(new Error('Formato de arquivo inválido. Por favor, envie um arquivo .csv'));
          return;
      }
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            console.error("Erros ao parsear CSV:", results.errors);
            reject(new Error(`Erro ao ler CSV: ${results.errors[0]?.message || 'Verifique o formato.'}`));
          } else {
            const data = results.data as any[];
            if (!results.meta.fields?.includes('phone')) {
              reject(new Error('Coluna "phone" não encontrada na planilha.'));
              return;
            }
            if (!results.meta.fields?.includes('client_name')) {
                reject(new Error('Coluna "client_name" não encontrada na planilha.'));
                return;
            }
            const validData = data.filter(row => row.phone && String(row.phone).trim() !== '');
            resolve(validData);
          }
        },
        error: (error: any) => {
          console.error("Erro no Papaparse:", error);
          reject(new Error(`Não foi possível ler o arquivo CSV: ${error.message}`));
        }
      });
    });
  };

  const handleFileRead = async (file: File | null) => {
    setSelectedFile(file);
    setParsedData([]);
    if (file) {
      setIsReadingFile(true);
      try {
        const data = await parseFile(file);
        if (data.length === 0) {
            toast.warning("Planilha lida", { description: "Nenhum contato com telefone válido encontrado."});
        }
        setParsedData(data);
      } catch (error: any) {
        toast.error("Erro ao Ler Planilha", { description: error.message });
        setSelectedFile(null);
      } finally {
        setIsReadingFile(false);
      }
    }
  };

  const handleStartCampaign = async () => {
    // Validação adicional para nome da campanha
    if (!campaignName.trim()) {
       toast.error('Erro', { description: 'Por favor, digite um nome para a campanha.' });
       setShowConfirmDialog(false); // Fecha o diálogo se o nome estiver faltando
       return;
    }

    if (!parsedData || parsedData.length === 0 || !message.trim()) {
      toast.error('Erro', { description: 'Verifique a planilha, contatos e mensagem.' });
      setShowConfirmDialog(false);
      return;
    }

    const userInfo = {
      nome: user?.user_metadata?.full_name || user?.email || 'Usuário Desconhecido',
      email: user?.email || 'Email não disponível',
      telefone: user?.user_metadata?.phone || 'Telefone não disponível'
    };

    setIsLoading(true);
    setShowConfirmDialog(false);

    const webhookUrl = 'https://n8nwebhook.cristaisdegramado.com.br/webhook/cristais_conecta';
    const payload = {
      campaignName: campaignName, // INCLUIR NOME DA CAMPANHA
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
        let errorBody = `Erro ${response.status} ao enviar para o webhook.`;
        try {
          const errorData = await response.json();
          errorBody = errorData.message || JSON.stringify(errorData);
        } catch (e) {
           const textError = await response.text();
           if(textError) errorBody = textError;
        }
        throw new Error(errorBody);
      }

      const responseData = await response.json();
      console.log('Resposta do Webhook n8n:', responseData);

      toast.success('Sucesso!', {
        description: 'Sua campanha foi enviada para processamento.',
      });

      // Limpar todos os campos
      setSelectedFile(null);
      setCampaignName(''); // Limpar nome da campanha
      setMessage('');
      setParsedData([]);

    } catch (error: any) {
      console.error('Falha ao enviar campanha:', error);
      toast.error('Falha no Envio', {
        description: error.message || 'Ocorreu um erro inesperado.',
      });
    } finally {
      setIsLoading(false);
    }
  };

   const handleConfirmClick = () => {
    // Adiciona validação do nome da campanha aqui também
    if (!selectedFile) {
        toast.error('Erro', { description: 'Por favor, selecione um arquivo primeiro.' });
        return;
    }
     if (!campaignName.trim()) {
        toast.error('Erro', { description: 'Por favor, digite um nome para a campanha.' });
        return;
    }
    if (!message.trim()) {
      toast.error('Erro', { description: 'Por favor, digite uma mensagem.' });
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
    setShowConfirmDialog(true);
  };


  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold">Nova Campanha de Disparo</h1>

          {/* Seção Planilha */}
          <div className="space-y-2">
            <Label>Planilha de Contatos (.csv)</Label>
            <FileUpload onFileSelect={handleFileRead} selectedFile={selectedFile} />
             <div className="flex justify-center pt-2">
               <Link
                 href="/planilha-modelo.csv"
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
             {isReadingFile && <p className="text-sm text-muted-foreground mt-2 animate-pulse">Lendo arquivo...</p>}
             {parsedData.length > 0 && !isReadingFile && (
                 <p className="text-sm text-green-600 mt-2">{parsedData.length} contatos válidos carregados.</p>
             )}
              {selectedFile && parsedData.length === 0 && !isReadingFile && (
                  <p className="text-sm text-red-600 mt-2">Nenhum contato com telefone válido encontrado no arquivo.</p>
              )}
          </div>

          {/* NOVO CAMPO: Nome da Campanha */}
          <div className="space-y-2">
            <Label htmlFor="campaignName">Nome da Campanha</Label>
            <Input
              id="campaignName"
              placeholder="Ex: Promoção Dia dos Pais"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              maxLength={100} // Limite opcional
            />
             <p className="text-xs text-muted-foreground">
                Este nome ajudará a identificar a campanha nos relatórios.
            </p>
          </div>
          {/* FIM NOVO CAMPO */}


          {/* Seção Mensagem */}
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <div className="flex gap-2 mb-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertVariable('{{client_name}}')} // Atualizado para client_name
              >
                Inserir {'{{client_name}}'}
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
              placeholder="Digite sua mensagem aqui... Use {{client_name}} para o nome do cliente e {{variavel_1}} para a variável personalizada." // Atualizado placeholder
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="resize-none"
            />
             <p className="text-xs text-muted-foreground">
               Variáveis disponíveis: {'{{client_name}}'}, {'{{variavel_1}}'} {/* Atualizado texto */}
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
                  Você está prestes a enviar a campanha "<span className="font-semibold">{campaignName}</span>"
                  para <span className="font-semibold">{parsedData.length}</span>{' '}
                  contato(s) da lista{' '}
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