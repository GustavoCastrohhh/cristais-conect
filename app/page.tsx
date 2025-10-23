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

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const insertVariable = (variable: string) => {
    setMessage((prev) => prev + variable);
  };

  const handleStartCampaign = async () => {
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 2000));

    toast.success('Sucesso', {
      description: 'Sua campanha foi enviada para a fila de disparo.',
    });

    setIsLoading(false);
    setShowConfirmDialog(false);
    setSelectedFile(null);
    setMessage('');
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
          </div>
          <Textarea
            id="message"
            placeholder="Digite sua mensagem aqui..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={8}
            className="resize-none"
          />
        </div>

        <Button
          onClick={handleConfirmClick}
          size="lg"
          className="w-full"
        >
          Disparar Campanha
        </Button>

        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Disparo?</AlertDialogTitle>
              <AlertDialogDescription>
                Você está prestes a enviar esta mensagem para a lista{' '}
                <span className="font-semibold">{selectedFile?.name}</span>. Esta ação não pode ser desfeita.
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
  );
}
