"use client";

import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { FileUpload } from '@/components/FileUpload';
import { Textarea } from '@/components/ui/textarea';
import { Button, buttonVariants } from '@/components/ui/button';
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
import Link from 'next/link';
import { Download, Database, Upload, Trash2 } from 'lucide-react'; // Adicionado Trash2
import { cn } from '@/lib/utils';
// Removido RadioGroup
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ClientFromDB {
    client_name: string | null;
    client_phone: number | null;
}

export default function Home() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // Mantido para upload opcional
  const [campaignName, setCampaignName] = useState('');
  const [message, setMessage] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false); // Mantido para feedback do upload
  const [parsedData, setParsedData] = useState<any[]>([]); // Mantido para feedback do upload

  // Estados para seleção de público do DB (agora obrigatório)
  const [clientTypes, setClientTypes] = useState<string[]>([]);
  const [selectedClientType, setSelectedClientType] = useState<string>(''); // Este é o público selecionado
  const [isLoadingClientTypes, setIsLoadingClientTypes] = useState(false);
  const [dbContactsCountMap, setDbContactsCountMap] = useState<Record<string, number | null>>({});
  const [isCountingContacts, setIsCountingContacts] = useState(false);

  const insertVariable = (variable: string) => {
    setMessage((prev) => prev + variable);
  };

  // Buscar tipos de cliente do banco de dados (sem alterações na lógica interna)
  useEffect(() => {
    async function fetchClientTypes() {
      if (!user || !user.user_metadata?.phone) return;
      setIsLoadingClientTypes(true);
      const userPhoneNumeric = parseInt(String(user.user_metadata.phone).replace(/\D/g, ''), 10);
      if (isNaN(userPhoneNumeric)) {
        console.error("Telefone do usuário inválido.");
        setIsLoadingClientTypes(false);
        return;
      }
      const { data, error } = await supabase
        .from('historico_disparos')
        .select('client_type', { count: 'exact', head: false })
        .eq('user_phone', userPhoneNumeric)
        .not('client_type', 'is', null);

      if (error) {
        console.error("Erro ao buscar tipos de cliente:", error.message);
        toast.error("Erro ao carregar tipos", { description: "Não foi possível buscar os tipos de público." });
      } else if (data) {
        const uniqueTypes = Array.from(new Set(data.map(item => item.client_type).filter(type => type !== null))) as string[];
        setClientTypes(uniqueTypes.sort());
        countContactsForTypes(uniqueTypes, userPhoneNumeric); // Dispara contagem
      }
      setIsLoadingClientTypes(false);
    }
    fetchClientTypes();
  }, [user]);

  // Função para contar contatos para múltiplos tipos (sem alterações)
  async function countContactsForTypes(types: string[], userPhoneNumeric: number) {
    if (types.length === 0 || isNaN(userPhoneNumeric)) return;
    setIsCountingContacts(true);
    const counts: Record<string, number | null> = {};
    const promises = types.map(async (type) => {
      const { count, error } = await supabase
        .from('historico_disparos')
        .select('*', { count: 'exact', head: true })
        .eq('user_phone', userPhoneNumeric)
        .eq('client_type', type);
      if (error) {
        console.error(`Erro ao contar contatos para ${type}:`, error.message);
        counts[type] = null;
      } else {
        counts[type] = count ?? 0;
      }
    });
    await Promise.all(promises);
    setDbContactsCountMap(counts);
    setIsCountingContacts(false);
  }

  // Função parseFile mantida (para upload opcional)
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
            if (!results.meta.fields?.includes('client_phone')) {
              reject(new Error('Coluna "client_phone" não encontrada na planilha.'));
              return;
            }
            if (!results.meta.fields?.includes('client_name')) {
                reject(new Error('Coluna "client_name" não encontrada na planilha.'));
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
    });
  };

  // handleFileRead mantido (para upload opcional)
  const handleFileRead = async (file: File | null) => {
    setSelectedFile(file);
    setParsedData([]); // Limpa dados anteriores ao selecionar novo arquivo
    if (file) {
      setIsReadingFile(true);
      try {
        const data = await parseFile(file);
        if (data.length === 0) {
            toast.warning("Planilha lida", { description: "Nenhum contato com telefone válido encontrado."});
        }
        setParsedData(data); // Armazena dados lidos para feedback
        toast.info("Planilha Carregada", { description: `${data.length} contatos válidos encontrados na planilha.` });
      } catch (error: any) {
        toast.error("Erro ao Ler Planilha", { description: error.message });
        setSelectedFile(null); // Limpa seleção em caso de erro
      } finally {
        setIsReadingFile(false);
      }
    }
  };

  // Função para limpar o arquivo selecionado (mantida)
  const clearSelectedFile = () => {
    setSelectedFile(null);
    setParsedData([]);
  };

  // Função handleStartCampaign ATUALIZADA - Usa apenas o banco de dados
  const handleStartCampaign = async () => {
    // Validações básicas (já feitas no handleConfirmClick, mas reforçadas)
    if (!selectedClientType) {
       toast.error('Erro', { description: 'Por favor, selecione um tipo de público do banco.' });
       setShowConfirmDialog(false);
       return;
    }
    if (!campaignName.trim()) {
       toast.error('Erro', { description: 'Por favor, digite um nome para a campanha.' });
       setShowConfirmDialog(false);
       return;
    }
    if (!message.trim()) {
      toast.error('Erro', { description: 'A mensagem não pode estar vazia.' });
      setShowConfirmDialog(false);
      return;
    }

    let contactsToSend: ClientFromDB[] = [];
    let sourceDescription = `tipo de público "${selectedClientType}"`;

    setIsLoading(true);
    setShowConfirmDialog(false);

    try {
        // --- Lógica ÚNICA: Buscar contatos do banco de dados ---
        if (!user || !user.user_metadata?.phone) throw new Error("Usuário não autenticado ou sem telefone.");
        const userPhoneNumeric = parseInt(String(user.user_metadata.phone).replace(/\D/g, ''), 10);
        if (isNaN(userPhoneNumeric)) throw new Error("Telefone do usuário inválido.");

        const { data: dbContacts, error: dbError } = await supabase
            .from('historico_disparos')
            .select('client_name, client_phone')
            .eq('user_phone', userPhoneNumeric)
            .eq('client_type', selectedClientType);

        if (dbError) throw new Error(`Erro ao buscar contatos do banco: ${dbError.message}`);
        if (!dbContacts || dbContacts.length === 0) throw new Error(`Nenhum contato encontrado para "${selectedClientType}" no banco.`);

        contactsToSend = dbContacts.map(c => ({
            client_name: c.client_name,
            client_phone: c.client_phone
        }));
        // --- Fim Busca Contatos ---


        // Validação final da lista (deve ter contatos do DB)
        if (contactsToSend.length === 0) {
            throw new Error(`Nenhum contato válido encontrado para ${sourceDescription}.`);
        }

        // --- Envio para o Webhook (lógica inalterada) ---
        const userInfo = {
          nome: user?.user_metadata?.full_name || user?.email || 'Usuário Desconhecido',
          email: user?.email || 'Email não disponível',
          telefone: user?.user_metadata?.phone || 'Telefone não disponível'
        };
        const webhookUrl = 'https://n8nwebhook.cristaisdegramado.com.br/webhook/cristais_conecta';
        const payload = {
          campaignName: campaignName,
          message: message,
          contacts: contactsToSend,
          senderInfo: userInfo
        };
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
         if (!response.ok) {
            let errorBody = `Erro ${response.status} ao enviar para o webhook.`;
            try { const errorData = await response.json(); errorBody = errorData.message || JSON.stringify(errorData); }
            catch (e) { const textError = await response.text(); if(textError) errorBody = textError; }
            throw new Error(errorBody);
        }
        const responseData = await response.json();
        console.log('Resposta do Webhook n8n:', responseData);
        // --- Fim Envio Webhook ---

        toast.success('Sucesso!', {
            description: `Sua campanha "${campaignName}" foi enviada para processamento com ${contactsToSend.length} contato(s).`,
        });

        // Limpar campos após sucesso
        setSelectedFile(null); // Limpa arquivo opcional
        setParsedData([]); // Limpa dados do arquivo opcional
        setCampaignName('');
        setMessage('');
        setSelectedClientType(''); // Limpa seleção obrigatória do DB
        // Não precisa limpar dbContactsCountMap, ele é atualizado pelos useEffects

    } catch (error: any) {
        console.error('Falha ao enviar campanha:', error);
        toast.error('Falha no Envio', {
            description: error.message || 'Ocorreu um erro inesperado.',
        });
    } finally {
        setIsLoading(false);
    }
  };

  // Função handleConfirmClick ATUALIZADA - Valida seleção do DB como obrigatória
  const handleConfirmClick = () => {
    // 1. Validar seleção de público do BANCO (OBRIGATÓRIO)
    if (!selectedClientType) {
        toast.error('Erro', { description: 'Por favor, selecione um tipo de público do banco.' });
        return;
    }

    // 2. Validar se o público selecionado do BANCO tem contatos
    const countForType = dbContactsCountMap[selectedClientType];
     if (isCountingContacts) {
         toast.warning('Aguarde', { description: 'Contando contatos do banco, aguarde...' });
         return;
     }
    if (countForType === null || countForType === 0) {
        toast.error('Erro', { description: `Nenhum contato encontrado no banco para o tipo "${selectedClientType}".` });
        return;
    }

    // 3. Validar nome da campanha e mensagem (OBRIGATÓRIOS)
    if (!campaignName.trim()) {
        toast.error('Erro', { description: 'Por favor, digite um nome para a campanha.' });
        return;
    }
    if (!message.trim()) {
      toast.error('Erro', { description: 'Por favor, digite uma mensagem.' });
      return;
    }

     // 4. (Opcional) Validar se o arquivo está sendo lido (caso tenha sido selecionado)
     // Não impede o envio, apenas informa o usuário
    if (selectedFile && isReadingFile) {
        toast.warning('Aguarde Leitura', { description: 'A leitura do arquivo opcional ainda está em andamento.' });
        // Não retorna, pois o envio será pelo DB de qualquer forma
    }


    setShowConfirmDialog(true); // Abre o modal se tudo estiver OK
  };

  // Define a contagem e a descrição da fonte para o modal (sempre do DB)
  const getConfirmationDetails = () => {
     if (selectedClientType) {
         return {
             count: dbContactsCountMap[selectedClientType] ?? 0,
             source: `tipo de público "${selectedClientType}" do banco` // Descrição fixa
         };
     }
     return { count: 0, source: 'origem desconhecida' }; // Fallback
  };
  const { count: confirmationCount, source: confirmationSource } = getConfirmationDetails();

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold">Nova Campanha de Disparo</h1>

          {/* Etapa 1: Upload de Arquivo (Opcional) */}
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                   <span>1. Carregar Lista (Etapa Opcional)</span>
                    {selectedFile && (
                        <Button variant="ghost" size="sm" onClick={clearSelectedFile} className="text-destructive hover:text-destructive/80">
                            <Trash2 className="h-4 w-4 mr-1"/> Remover Arquivo
                        </Button>
                     )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                 <FileUpload onFileSelect={handleFileRead} selectedFile={selectedFile} />
                 <div className="flex justify-center pt-4">
                     <Link
                         href="/planilha-modelo.csv"
                         download
                         className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
                     >
                         <Download className="h-4 w-4" />
                         Baixar Modelo CSV
                     </Link>
                 </div>
                 {isReadingFile && <p className="text-sm text-center text-muted-foreground mt-2 animate-pulse">Lendo arquivo...</p>}
                 {selectedFile && !isReadingFile && parsedData.length > 0 && (
                     <p className="text-sm text-center text-green-600 mt-2">{parsedData.length} contatos válidos encontrados na planilha.</p>
                 )}
                 {selectedFile && !isReadingFile && parsedData.length === 0 && (
                    <p className="text-sm text-center text-red-600 mt-2">Nenhum contato com telefone válido encontrado no arquivo.</p>
                 )}
                 <p className="text-xs text-center text-muted-foreground mt-4">
                    O público para envio será selecionado do banco de dados na próxima etapa.
                 </p>
            </CardContent>
          </Card>

         {/* Etapa 2: Selecionar Público do Banco (Obrigatório) */}
          <Card>
              <CardHeader>
                  <CardTitle>2. Escolher Público</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                 <Label htmlFor="client-type-select">Público da Campanha</Label>
                 <Select
                    value={selectedClientType}
                    onValueChange={setSelectedClientType}
                    disabled={isLoadingClientTypes || clientTypes.length === 0}
                 >
                     <SelectTrigger id="client-type-select">
                       <SelectValue placeholder={
                           isLoadingClientTypes || isCountingContacts ? "Carregando..." :
                           (clientTypes.length === 0) ? "Nenhum tipo de público encontrado" :
                           "Selecione o tipo de público alvo"
                       } />
                     </SelectTrigger>
                     <SelectContent>
                       {/* Remove a opção 'uploaded_list' */}
                       {!isLoadingClientTypes && clientTypes.map((type) => {
                         const count = dbContactsCountMap[type];
                         const countText = isCountingContacts ? '(contando...)' :
                                           count !== null ? `(${count} contato${count !== 1 ? 's' : ''})` : '(erro ao contar)';
                         return (
                           <SelectItem key={type} value={type} disabled={count === 0 || count === null}>
                              {type} {countText}
                           </SelectItem>
                         );
                       })}
                     </SelectContent>
                   </Select>
                    {isCountingContacts && <p className="text-xs text-muted-foreground animate-pulse">Atualizando contagem de contatos...</p>}
                    {clientTypes.length === 0 && !isLoadingClientTypes && <p className="text-xs text-muted-foreground mt-2">Nenhum tipo de público cadastrado para seu usuário no banco de dados.</p>}
             </CardContent>
           </Card>

          {/* Etapa 3 e 4: Nome da Campanha e Mensagem (Obrigatórios) */}
           <Card>
               <CardHeader>
                   <CardTitle>3. Detalhes da Campanha</CardTitle>
               </CardHeader>
               <CardContent className="space-y-4">
                  {/* Nome da Campanha */}
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

                  {/* Mensagem */}
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
                      {/* Adicionar mais variáveis se necessário */}
                    </div>
                    <Textarea
                      id="message"
                      placeholder="Digite sua mensagem aqui... Use {{client_name}} para o nome do cliente."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={8}
                      className="resize-none"
                    />
                     <p className="text-xs text-muted-foreground">
                       Variável disponível: {'{{client_name}}'}
                     </p>
                  </div>
              </CardContent>
           </Card>


          {/* Botão de Disparo */}
          <Button
            onClick={handleConfirmClick}
            size="lg"
            className="w-full"
            disabled={isLoading || isLoadingClientTypes || isCountingContacts} // Não depende mais de isReadingFile para habilitar
          >
            {isLoading ? 'Enviando Campanha...' : 'Disparar Campanha'}
          </Button>

          {/* Modal de Confirmação (Descrição ajustada) */}
          <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Disparo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Você está prestes a enviar a campanha "<span className="font-semibold">{campaignName}</span>"
                  para <span className="font-semibold">{confirmationCount}</span>{' '}
                  contato(s) da origem:{' '}
                  <span className="font-semibold">{confirmationSource}</span>.
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