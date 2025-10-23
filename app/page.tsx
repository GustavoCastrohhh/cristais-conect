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
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'; // Importe o componente

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const insertVariable = (variable: string) => {
    setMessage((prev) => prev + variable);
  };

  const handleStartCampaign = async () => {
    if (!selectedFile || !message.trim()) {
      toast.error('Erro', {
        description: 'Por favor, selecione um arquivo e digite uma mensagem.',
      });
      setShowConfirmDialog(false); // Fechar o diálogo se houver erro antes de enviar
      return;
    }

    setIsLoading(true);
    setShowConfirmDialog(false); // Fechar o diálogo de confirmação imediatamente

    const webhookUrl = 'https://n8nwebhook.cristaisdegramado.com.br/webhook/cristais_conecta';
    const formData = new FormData();

    formData.append('file', selectedFile); // Nome 'file' para o n8n identificar
    formData.append('message', message);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        body: formData,
        // Não defina Content-Type manualmente para FormData, o navegador faz isso.
      });

      if (!response.ok) {
        // Tenta pegar alguma mensagem de erro do n8n, se houver
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          // Ignora se a resposta não for JSON
        }
        console.error('Erro na resposta do n8n:', response.status, response.statusText, errorData);
        throw new Error(errorData?.message || `Erro ${response.status}: ${response.statusText}`);
      }

      // Se a resposta for OK (ex: n8n retorna { "message": "Webhook received" })
      const result = await response.json();
      console.log('Resposta do n8n:', result);

      toast.success('Sucesso', {
        description: 'Sua campanha foi enviada para a fila de disparo.',
      });

      // Limpa o estado após sucesso
      setSelectedFile(null);
      setMessage('');

    } catch (error: any) {
      console.error('Falha ao enviar para o n8n:', error);
      toast.error('Falha no Envio', {
        description: error.message || 'Não foi possível conectar ao servidor de disparo.',
      });
    } finally {
      setIsLoading(false);
      // setShowConfirmDialog(false); // Já foi fechado no início
    }
  };


   const handleConfirmClick = () => {
    if (!selectedFile || !message.trim()) {
      toast.error('Erro', {
        description: 'Por favor, selecione um arquivo e digite uma mensagem.',
      });
      return;
    }
    setShowConfirmDialog(true);
  };


  return (
    <ProtectedRoute> {/* Envolva o conteúdo com ProtectedRoute */}
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold">Nova Campanha de Disparo</h1>

          <div className="space-y-2">
            <Label>Planilha de Contatos</Label>
            <FileUpload onFileSelect={setSelectedFile} selectedFile={selectedFile} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <div className="flex gap-2 mb-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertVariable('{{nome}}')}
              >
                Inserir nome
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertVariable('{{variavel_1}}')}
              >
                Inserir variavel_1
              </Button>
              {/* Adicione mais botões para outras variáveis se necessário */}
            </div>
            <Textarea
              id="message"
              placeholder="Digite sua mensagem aqui... Use {{nome}} para o nome do contato e {{variavel_1}} para a primeira variável extra."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="resize-none"
            />
             <p className="text-xs text-muted-foreground">
                Exemplo: Olá {'{{nome}}'}, você tem um cupom: {'{{variavel_1}}'}!
            </p>
          </div>

          <Button
            onClick={handleConfirmClick}
            size="lg"
            className="w-full"
            disabled={isLoading} // Desabilita o botão principal durante o loading
          >
             {isLoading ? 'Enviando...' : 'Disparar Campanha'}
          </Button>

          <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Disparo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Você está prestes a enviar a mensagem para a lista de contatos do arquivo{' '}
                  <span className="font-semibold">{selectedFile?.name}</span>. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleStartCampaign}
                  disabled={isLoading} // Desabilita o botão de confirmação durante o loading
                  className="bg-primary hover:bg-primary/90"
                >
                  Confirmar Disparo
                  {/* O texto do botão de ação não muda durante o loading, pois o botão principal já indica */}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
