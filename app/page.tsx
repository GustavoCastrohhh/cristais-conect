// /app/page.tsx
"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
// IMPORTANTE: Adicionar componentes para seleção de público aqui
// Exemplo: import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Home() {
  const { user } = useAuth();
  const [campaignName, setCampaignName] = useState('');
  const [message, setMessage] = useState('');
  const [selectedAudience, setSelectedAudience] = useState<string | null>(null); // NOVO ESTADO: Público selecionado
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const insertVariable = (variable: string) => {
    setMessage((prev) => prev + variable);
  };

  // Lógica para buscar os públicos disponíveis (exemplo)
  // useEffect(() => {
  //   fetchAudiences().then(setAudiences);
  // }, []);
  const audiences = [ // Exemplo de públicos
    { id: 'all', name: 'Todos os Clientes' },
    { id: 'vip', name: 'Clientes VIP' },
    { id: 'inactive', name: 'Clientes Inativos' },
  ];

  const handleStartCampaign = async () => {
    if (!campaignName.trim()) {
      toast.error('Erro', { description: 'Por favor, digite um nome para a campanha.' });
      setShowConfirmDialog(false);
      return;
    }
    if (!selectedAudience) { // Validar seleção de público
        toast.error('Erro', { description: 'Por favor, selecione um público para a campanha.' });
        setShowConfirmDialog(false);
        return;
    }
    if (!message.trim()) {
      toast.error('Erro', { description: 'Por favor, digite a mensagem.' });
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

    const webhookUrl = 'https://n8nwebhook.cristaisdegramado.com.br/webhook/cristais_conecta'; // URL Mantida
    const payload = {
      campaignName: campaignName,
      message: message,
      audienceType: selectedAudience, // Enviar o tipo de público selecionado
      senderInfo: userInfo
    };

    console.log("Enviando payload:", payload); // Log para depuração

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

      // Limpar campos
      setCampaignName('');
      setMessage('');
      setSelectedAudience(null); // Limpar seleção de público

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
     if (!campaignName.trim()) {
        toast.error('Erro', { description: 'Por favor, digite um nome para a campanha.' });
        return;
    }
     if (!selectedAudience) { // Validar seleção de público
        toast.error('Erro', { description: 'Por favor, selecione um público.' });
        return;
    }
    if (!message.trim()) {
      toast.error('Erro', { description: 'Por favor, digite uma mensagem.' });
      return;
    }
    setShowConfirmDialog(true);
  };


  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold">Nova Campanha de Disparo</h1>

          {/* Campo Nome da Campanha */}
          <div className="space-y-2">
            <Label htmlFor="campaignName">Nome da Campanha</Label>
            <Input
              id="campaignName"
              placeholder="Ex: Promoção Dia dos Pais"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              maxLength={100}
            />
             <p className="text-xs text-muted-foreground">
                Este nome ajudará a identificar a campanha nos relatórios.
            </p>
          </div>

          {/* Seção Seleção de Público */}
          <div className="space-y-2">
            <Label htmlFor="audience">Público da Campanha</Label>
             {/* Componente Select para escolher o público */}
             {/*
             <Select value={selectedAudience || ''} onValueChange={setSelectedAudience}>
                <SelectTrigger id="audience">
                    <SelectValue placeholder="Selecione o público alvo" />
                </SelectTrigger>
                <SelectContent>
                    {audiences.map((audience) => (
                        <SelectItem key={audience.id} value={audience.id}>
                            {audience.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            */}
             <p className="text-xs text-muted-foreground">
               Selecione o grupo de clientes que receberá esta mensagem.
             </p>
             {/* Placeholder enquanto o Select não está implementado */}
             <div className="border border-dashed p-4 text-center text-muted-foreground">
                Componente de Seleção de Público (Implementar)
             </div>

          </div>

          {/* Seção Mensagem */}
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <div className="flex gap-2 mb-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertVariable('{{client_name}}')}
              >
                Inserir {'{{client_name}}'}
              </Button>
               {/* Poderia adicionar outras variáveis se necessário */}
            </div>
            <Textarea
              id="message"
              placeholder="Digite sua mensagem aqui... Use {{client_name}} para personalizar com o nome do cliente."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="resize-none"
            />
             <p className="text-xs text-muted-foreground">
               Variável disponível: {'{{client_name}}'}
             </p>
          </div>

          <Button
            onClick={handleConfirmClick}
            size="lg"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Enviando Campanha...' : 'Disparar Campanha'}
          </Button>

          <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Disparo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Você está prestes a enviar a campanha "<span className="font-semibold">{campaignName}</span>"
                  para o público "<span className="font-semibold">{audiences.find(a => a.id === selectedAudience)?.name || selectedAudience}</span>".
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