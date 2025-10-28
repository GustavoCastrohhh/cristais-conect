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
import { Download, Database, Upload, Trash2, UserPlus } from 'lucide-react'; // Adicionado UserPlus
import { cn } from '@/lib/utils';
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

// Interface para dados do CSV (usada no handleAddContacts)
interface ClientFromCSV {
    client_name: string | null;
    client_phone: string | number | null; // Pode vir como string do CSV
    // Adicionar outros campos do CSV se houver
}


export default function Home() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [campaignName, setCampaignName] = useState('');
  const [message, setMessage] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [parsedData, setParsedData] = useState<ClientFromCSV[]>([]); // Tipado com ClientFromCSV

  const [clientTypes, setClientTypes] = useState<string[]>([]);
  const [selectedClientType, setSelectedClientType] = useState<string>('');
  const [isLoadingClientTypes, setIsLoadingClientTypes] = useState(false);
  const [dbContactsCountMap, setDbContactsCountMap] = useState<Record<string, number | null>>({});
  const [isCountingContacts, setIsCountingContacts] = useState(false);
  const [isAddingContacts, setIsAddingContacts] = useState(false); // Novo estado para loading do botão Adicionar Contatos

  const insertVariable = (variable: string) => {
    setMessage((prev) => prev + variable);
  };

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
        countContactsForTypes(uniqueTypes, userPhoneNumeric);
      }
      setIsLoadingClientTypes(false);
    }
    fetchClientTypes();
  }, [user]);

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

  // --- Função parseFile ---
  const parseFile = (file: File): Promise<ClientFromCSV[]> => { // Retorna ClientFromCSV[]
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
            const data = results.data as any[]; // PapaParse retorna 'any[]'
            // Validações de colunas
            if (!results.meta.fields?.includes('client_phone')) {
              reject(new Error('Coluna "client_phone" não encontrada na planilha.'));
              return;
            }
            if (!results.meta.fields?.includes('client_name')) {
                reject(new Error('Coluna "client_name" não encontrada na planilha.'));
                return;
            }
            // Filtra e mapeia para a interface ClientFromCSV
            const validData: ClientFromCSV[] = data
              .filter(row => row.client_phone && String(row.client_phone).trim() !== '')
              .map(row => ({
                  client_name: row.client_name || null,
                  client_phone: String(row.client_phone).trim() // Garante que é string
                  // Mapear outros campos se necessário
              }));
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
        toast.info("Planilha Carregada", { description: `${data.length} contatos válidos encontrados na planilha.` });
      } catch (error: any) {
        toast.error("Erro ao Ler Planilha", { description: error.message });
        setSelectedFile(null);
      } finally {
        setIsReadingFile(false);
      }
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setParsedData([]);
  };

  // --- NOVA FUNÇÃO: handleAddContacts ---
  const handleAddContacts = async () => {
    if (!parsedData || parsedData.length === 0) {
      toast.error("Nenhum Contato", { description: "Carregue um arquivo CSV com contatos válidos primeiro." });
      return;
    }
    if (!user) {
        toast.error("Erro", { description: "Usuário não autenticado." });
        return;
    }

    setIsAddingContacts(true); // Inicia loading específico
    try {
        const userInfo = {
          nome: user?.user_metadata?.full_name || user?.email || 'Usuário Desconhecido',
          email: user?.email || 'Email não disponível',
          telefone: user?.user_metadata?.phone || 'Telefone não disponível'
        };

        const webhookUrl = 'https://n8nwebhook.cristaisdegramado.com.br/webhook/cristais_conecta'; // Mesma URL
        const payload = {
          action: "novos contatos", // Identificador
          contacts: parsedData,     // Dados parseados do CSV
          senderInfo: userInfo
        };

        console.log("Enviando payload para 'novos contatos':", payload);

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

         if (!response.ok) {
            let errorBody = `Erro ${response.status} ao adicionar contatos via webhook.`;
            try { const errorData = await response.json(); errorBody = errorData.message || JSON.stringify(errorData); }
            catch (e) { const textError = await response.text(); if(textError) errorBody = textError; }
            throw new Error(errorBody);
        }

        const responseData = await response.json();
        console.log('Resposta do Webhook n8n (novos contatos):', responseData);

        toast.success('Contatos Enviados!', {
            description: `${parsedData.length} contato(s) da planilha foram enviados para adição/atualização.`,
        });

        // Opcional: Limpar o arquivo após adicionar com sucesso?
        // clearSelectedFile();

    } catch (error: any) {
        console.error('Falha ao adicionar contatos:', error);
        toast.error('Falha ao Adicionar', {
            description: error.message || 'Ocorreu um erro inesperado ao enviar os contatos.',
        });
    } finally {
        setIsAddingContacts(false); // Finaliza loading específico
    }
  };
  // --- FIM handleAddContacts ---

  const handleStartCampaign = async () => {
    if (!selectedClientType || !campaignName.trim() || !message.trim()) {
       // A validação já ocorreu, mas é uma segurança extra
       setShowConfirmDialog(false);
       return;
    }

    let contactsToSend: ClientFromDB[] = [];
    let sourceDescription = `tipo de público "${selectedClientType}"`;

    setIsLoading(true);
    setShowConfirmDialog(false);

    try {
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

        if (contactsToSend.length === 0) {
            throw new Error(`Nenhum contato válido encontrado para ${sourceDescription}.`);
        }

        const userInfo = {
          nome: user?.user_metadata?.full_name || user?.email || 'Usuário Desconhecido',
          email: user?.email || 'Email não disponível',
          telefone: user?.user_metadata?.phone || 'Telefone não disponível'
        };
        const webhookUrl = 'https://n8nwebhook.cristaisdegramado.com.br/webhook/cristais_conecta';
        const payload = {
          action: "disparar campanha", // <-- IDENTIFICADOR ADICIONADO
          campaignName: campaignName,
          message: message,
          contacts: contactsToSend,
          senderInfo: userInfo
        };

        console.log("Enviando payload para 'disparar campanha':", payload); // Log para depuração

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
        console.log('Resposta do Webhook n8n (disparar campanha):', responseData);

        toast.success('Sucesso!', {
            description: `Sua campanha "${campaignName}" foi enviada para processamento com ${contactsToSend.length} contato(s).`,
        });

        setSelectedFile(null);
        setParsedData([]);
        setCampaignName('');
        setMessage('');
        setSelectedClientType('');

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
    if (!selectedClientType) {
        toast.error('Erro', { description: 'Por favor, selecione um tipo de público do banco.' });
        return;
    }
    const countForType = dbContactsCountMap[selectedClientType];
     if (isCountingContacts) {
         toast.warning('Aguarde', { description: 'Contando contatos do banco, aguarde...' });
         return;
     }
    if (countForType === null || countForType === 0) {
        toast.error('Erro', { description: `Nenhum contato encontrado no banco para o tipo "${selectedClientType}".` });
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
    if (selectedFile && isReadingFile) {
        toast.warning('Aguarde Leitura', { description: 'A leitura do arquivo opcional ainda está em andamento.' });
    }
    setShowConfirmDialog(true);
  };

  const getConfirmationDetails = () => {
     if (selectedClientType) {
         return {
             count: dbContactsCountMap[selectedClientType] ?? 0,
             source: `tipo de público "${selectedClientType}" do banco`
         };
     }
     return { count: 0, source: 'origem desconhecida' };
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
                   <span>1. Carregar Lista (Opcional - Apenas para Adicionar Contatos)</span>
                    {selectedFile && (
                        <Button variant="ghost" size="sm" onClick={clearSelectedFile} className="text-destructive hover:text-destructive/80">
                            <Trash2 className="h-4 w-4 mr-1"/> Remover Arquivo
                        </Button>
                     )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                 <FileUpload onFileSelect={handleFileRead} selectedFile={selectedFile} />
                 <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4"> {/* Flex container */}
                     <Link
                         href="/planilha-modelo.csv"
                         download
                         className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2 w-full sm:w-auto")} // Ajuste de largura
                     >
                         <Download className="h-4 w-4" />
                         Baixar Modelo CSV
                     </Link>
                     {/* NOVO BOTÃO ADICIONAR CONTATOS */}
                     <Button
                        onClick={handleAddContacts}
                        variant="secondary"
                        size="sm"
                        disabled={!selectedFile || parsedData.length === 0 || isReadingFile || isAddingContacts} // Desabilita se não houver arquivo/dados ou se estiver carregando
                        className="gap-2 w-full sm:w-auto" // Ajuste de largura
                    >
                        {isAddingContacts ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Adicionando...
                            </>
                        ) : (
                             <>
                                <UserPlus className="h-4 w-4" />
                                Adicionar Contatos ao Banco
                             </>
                         )}
                     </Button>
                 </div>
                 {/* Feedback continua o mesmo */}
                 {isReadingFile && <p className="text-sm text-center text-muted-foreground mt-2 animate-pulse">Lendo arquivo...</p>}
                 {selectedFile && !isReadingFile && parsedData.length > 0 && (
                     <p className="text-sm text-center text-green-600 mt-2">{parsedData.length} contatos válidos encontrados na planilha.</p>
                 )}
                 {selectedFile && !isReadingFile && parsedData.length === 0 && (
                    <p className="text-sm text-center text-red-600 mt-2">Nenhum contato com telefone válido encontrado no arquivo.</p>
                 )}
                 <p className="text-xs text-center text-muted-foreground mt-4">
                    Use o botão "Adicionar Contatos" para incluir/atualizar os contatos da planilha no banco.
                    <br/>
                    O público para o disparo da campanha será selecionado na próxima etapa.
                 </p>
            </CardContent>
          </Card>

         {/* Etapa 2: Selecionar Público do Banco (Obrigatório) */}
          <Card>
              <CardHeader>
                  <CardTitle>2. Escolher Público para Disparo</CardTitle>
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
            disabled={isLoading || isLoadingClientTypes || isCountingContacts || isAddingContacts} // Desabilita também se estiver adicionando contatos
          >
            {isLoading ? 'Enviando Campanha...' : 'Disparar Campanha'}
          </Button>

          {/* Modal de Confirmação */}
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