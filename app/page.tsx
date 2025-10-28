"use client";

import { useState, useEffect } from 'react'; // Adicionado useEffect
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
import { Download, Database, Upload } from 'lucide-react'; // Adicionado Database, Upload
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Adicionado
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Adicionado
import { supabase } from '@/lib/supabaseClient'; // Adicionado

interface ClientFromDB {
    client_name: string | null;
    client_phone: number | null;
}

export default function Home() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [campaignName, setCampaignName] = useState('');
  const [message, setMessage] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [parsedData, setParsedData] = useState<any[]>([]);

  // Novos Estados
  const [campaignType, setCampaignType] = useState<'upload' | 'database'>('upload');
  const [clientTypes, setClientTypes] = useState<string[]>([]);
  const [selectedClientType, setSelectedClientType] = useState<string>('');
  const [isLoadingClientTypes, setIsLoadingClientTypes] = useState(false);
  const [dbContactsCount, setDbContactsCount] = useState<number | null>(null); // Contagem de contatos do DB
  const [isCountingContacts, setIsCountingContacts] = useState(false); // Loading da contagem

  const insertVariable = (variable: string) => {
    setMessage((prev) => prev + variable);
  };

  // Buscar tipos de cliente do banco de dados
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

      // IMPORTANTE: Substitua 'clientes' pelo nome real da sua tabela de clientes
      const { data, error } = await supabase
        .from('historico_disparos') // <-- VERIFIQUE O NOME DA TABELA
        .select('client_type', { count: 'exact', head: false })
        .eq('user_phone', userPhoneNumeric)
        .not('client_type', 'is', null); // Garante que não busca tipos nulos

      if (error) {
        console.error("Erro ao buscar tipos de cliente:", error.message);
        toast.error("Erro ao carregar tipos", { description: "Não foi possível buscar os tipos de público do banco." });
      } else if (data) {
        // Extrai os tipos únicos e não nulos
        const uniqueTypes = Array.from(new Set(data.map(item => item.client_type).filter(type => type !== null))) as string[];
        setClientTypes(uniqueTypes.sort());
      }
      setIsLoadingClientTypes(false);
    }

    fetchClientTypes();
  }, [user]);

   // Efeito para contar contatos quando o tipo de cliente selecionado muda
  useEffect(() => {
    async function countContacts() {
      if (campaignType !== 'database' || !selectedClientType || !user || !user.user_metadata?.phone) {
        setDbContactsCount(null);
        return;
      }

      setIsCountingContacts(true);
      const userPhoneNumeric = parseInt(String(user.user_metadata.phone).replace(/\D/g, ''), 10);
       if (isNaN(userPhoneNumeric)) {
           console.error("Telefone do usuário inválido para contagem.");
           setIsCountingContacts(false);
           setDbContactsCount(null);
           return;
       }

      // IMPORTANTE: Substitua 'clientes' pelo nome real da sua tabela de clientes
      const { count, error } = await supabase
        .from('historico_disparos') // <-- VERIFIQUE O NOME DA TABELA
        .select('*', { count: 'exact', head: true })
        .eq('user_phone', userPhoneNumeric)
        .eq('client_type', selectedClientType);

      if (error) {
        console.error("Erro ao contar contatos:", error.message);
        toast.error("Erro", { description: "Não foi possível contar os contatos para este tipo." });
        setDbContactsCount(null);
      } else {
        setDbContactsCount(count ?? 0);
      }
      setIsCountingContacts(false);
    }

    countContacts();
  }, [selectedClientType, campaignType, user]);


  const parseFile = (file: File): Promise<any[]> => {
    // ... (função parseFile existente - sem alterações) ...
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
            // Ajustado para usar client_phone e client_name como no page.tsx original
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

  const handleFileRead = async (file: File | null) => {
    // ... (função handleFileRead existente - sem alterações) ...
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

  // Função atualizada para lidar com ambos os tipos
  const handleStartCampaign = async () => {
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
    let sourceDescription = "";

    setIsLoading(true);
    setShowConfirmDialog(false);

    try {
        // Lógica para buscar contatos do banco de dados
        if (campaignType === 'database') {
            sourceDescription = `tipo de público "${selectedClientType}"`;
            if (!selectedClientType) throw new Error("Selecione um tipo de público.");
            if (!user || !user.user_metadata?.phone) throw new Error("Usuário não autenticado ou sem telefone.");

            const userPhoneNumeric = parseInt(String(user.user_metadata.phone).replace(/\D/g, ''), 10);
            if (isNaN(userPhoneNumeric)) throw new Error("Telefone do usuário inválido.");

            // IMPORTANTE: Substitua 'clientes' pelo nome real da sua tabela de clientes
            const { data: dbContacts, error: dbError } = await supabase
                .from('historico_disparos') // <-- VERIFIQUE O NOME DA TABELA
                .select('client_name, client_phone')
                .eq('user_phone', userPhoneNumeric)
                .eq('client_type', selectedClientType);

            if (dbError) throw new Error(`Erro ao buscar contatos do banco: ${dbError.message}`);
            if (!dbContacts || dbContacts.length === 0) throw new Error("Nenhum contato encontrado para este tipo de público.");

            contactsToSend = dbContacts.map(c => ({
                client_name: c.client_name,
                client_phone: c.client_phone // Mantém como número se vier assim do DB
            }));

        // Lógica para usar dados da planilha
        } else {
             sourceDescription = `planilha "${selectedFile?.name}"`;
             if (!parsedData || parsedData.length === 0) throw new Error("Nenhum contato válido na planilha.");
             // Garante que os dados da planilha tenham o formato esperado
             contactsToSend = parsedData.map(row => ({
                 client_name: row.client_name || null,
                 // Converte para número se necessário, ou mantém se já for
                 client_phone: typeof row.client_phone === 'string' ? parseInt(row.client_phone.replace(/\D/g, ''), 10) : row.client_phone
             })).filter(contact => contact.client_phone && !isNaN(contact.client_phone)); // Filtra inválidos após conversão
        }

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
            description: `Sua campanha "${campaignName}" foi enviada para processamento com ${contactsToSend.length} contato(s).`,
        });

        // Limpar campos
        setSelectedFile(null);
        setCampaignName('');
        setMessage('');
        setParsedData([]);
        setSelectedClientType('');
        setDbContactsCount(null);
        setCampaignType('upload'); // Resetar para o padrão

    } catch (error: any) {
        console.error('Falha ao enviar campanha:', error);
        toast.error('Falha no Envio', {
            description: error.message || 'Ocorreu um erro inesperado.',
        });
    } finally {
        setIsLoading(false);
    }
  };

  // Função atualizada para validar antes de abrir o modal
  const handleConfirmClick = () => {
    if (!campaignName.trim()) {
        toast.error('Erro', { description: 'Por favor, digite um nome para a campanha.' });
        return;
    }
    if (!message.trim()) {
      toast.error('Erro', { description: 'Por favor, digite uma mensagem.' });
      return;
    }

    if (campaignType === 'upload') {
        if (!selectedFile) {
            toast.error('Erro', { description: 'Por favor, selecione um arquivo.' });
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
    } else { // campaignType === 'database'
        if (!selectedClientType) {
             toast.error('Erro', { description: 'Por favor, selecione um tipo de público.' });
             return;
        }
         if (isCountingContacts) {
            toast.warning('Aguarde', { description: 'Contando contatos, aguarde...' });
            return;
        }
         if (dbContactsCount === 0 || dbContactsCount === null) {
             toast.error('Erro', { description: 'Nenhum contato encontrado para o tipo de público selecionado.' });
             return;
        }
    }

    setShowConfirmDialog(true);
  };

   // Define a contagem e a descrição da fonte para o modal
  const confirmationCount = campaignType === 'upload' ? parsedData.length : (dbContactsCount ?? 0);
  const confirmationSource = campaignType === 'upload' ? `planilha ${selectedFile?.name}` : `tipo de público "${selectedClientType}"`;


  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold">Nova Campanha de Disparo</h1>

          {/* Seletor de Tipo de Campanha */}
          <div className="space-y-2">
             <Label>Origem dos Contatos</Label>
             <RadioGroup defaultValue="upload" value={campaignType} onValueChange={(value) => setCampaignType(value as 'upload' | 'database')} className="flex space-x-4">
               <div className="flex items-center space-x-2">
                 <RadioGroupItem value="upload" id="r-upload" />
                 <Label htmlFor="r-upload" className="flex items-center gap-2 cursor-pointer">
                    <Upload className="h-4 w-4 text-muted-foreground" /> Importar Planilha (.csv)
                 </Label>
               </div>
               <div className="flex items-center space-x-2">
                 <RadioGroupItem value="database" id="r-database" />
                 <Label htmlFor="r-database" className="flex items-center gap-2 cursor-pointer">
                    <Database className="h-4 w-4 text-muted-foreground" /> Selecionar do Banco
                 </Label>
               </div>
             </RadioGroup>
           </div>


          {/* Seção Planilha (Condicional) */}
          {campaignType === 'upload' && (
            <div className="space-y-2 animate-in fade-in duration-300">
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
          )}

          {/* Seção Selecionar do Banco (Condicional) */}
           {campaignType === 'database' && (
             <div className="space-y-2 animate-in fade-in duration-300">
               <Label htmlFor="client-type-select">Selecionar Tipo de Público</Label>
               <Select
                 value={selectedClientType}
                 onValueChange={setSelectedClientType}
                 disabled={isLoadingClientTypes || clientTypes.length === 0}
               >
                 <SelectTrigger id="client-type-select">
                   <SelectValue placeholder={isLoadingClientTypes ? "Carregando tipos..." : (clientTypes.length === 0 ? "Nenhum tipo encontrado" : "Selecione o tipo de público")} />
                 </SelectTrigger>
                 <SelectContent>
                   {clientTypes.map((type) => (
                     <SelectItem key={type} value={type}>{type}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
               {isCountingContacts && <p className="text-sm text-muted-foreground mt-2 animate-pulse">Contando contatos...</p>}
               {dbContactsCount !== null && !isCountingContacts && (
                    <p className={`text-sm mt-2 ${dbContactsCount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {dbContactsCount} contato(s) encontrado(s) para este tipo.
                    </p>
                )}
               {clientTypes.length === 0 && !isLoadingClientTypes && <p className="text-xs text-muted-foreground mt-2">Nenhum tipo de público cadastrado para seu usuário no banco de dados.</p>}
             </div>
           )}

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
              {/* Se você tiver mais variáveis da tabela clientes, adicione botões aqui */}
               {/* Exemplo:
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertVariable('{{outra_coluna}}')}
                disabled={campaignType === 'upload'} // Desabilitar se for upload e a coluna não existir no CSV
              >
                Inserir {'{{outra_coluna}}'}
              </Button>
              */}
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

          <Button
            onClick={handleConfirmClick}
            size="lg"
            className="w-full"
            disabled={isReadingFile || isLoading || isLoadingClientTypes || isCountingContacts}
          >
            {isLoading ? 'Enviando Campanha...' : 'Disparar Campanha'}
          </Button>

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