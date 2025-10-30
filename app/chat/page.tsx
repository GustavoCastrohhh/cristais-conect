"use client";

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Tipagem (simplificada)
interface Conversation {
  id: string;
  contact_phone: string;
  contact_name: string | null;
  last_message_body: string | null;
  // ... outros campos
}

interface Message {
  id: string;
  direction: 'in' | 'out';
  message_body: string;
  created_at: string;
  // ... outros campos
}

export default function ChatPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState('');

  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  // 1. Buscar conversas iniciais
  useEffect(() => {
    if (!user) return;

    async function fetchConversations() {
      setIsLoadingConversations(true);
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('last_message_timestamp', { ascending: false });

      if (error) {
        console.error('Erro ao buscar conversas:', error);
      } else {
        setConversations(data as Conversation[]);
      }
      setIsLoadingConversations(false);
    }
    fetchConversations();
  }, [user]);

  // 2. Buscar mensagens ao selecionar uma conversa
  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    async function fetchMessages() {
      setIsLoadingMessages(true);
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', selectedConversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar mensagens:', error);
      } else {
        setMessages(data as Message[]);
      }
      setIsLoadingMessages(false);
    }
    fetchMessages();
  }, [selectedConversationId]);

  // 3. Ouvir por novas mensagens (Realtime)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('chat-messages-channel')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'chat_messages',
          filter: `user_id=eq.${user.id}` // Ouvir apenas mensagens deste usuário
        },
        (payload) => {
          const newMessage = payload.new as Message;

          // Se a mensagem for da conversa selecionada, adiciona na tela
          if (newMessage.conversation_id === selectedConversationId) {
            setMessages((prevMessages) => [...prevMessages, newMessage]);
          }

          // Atualizar a lista de conversas (não implementado aqui, mas necessário)
          // (Ex: mover a conversa para o topo, atualizar last_message)
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedConversationId]);

  // 4. Enviar mensagem (chamar n8n)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim() || !selectedConversation || !user) return;

    setIsSending(true);

    // Esta URL deve ser o seu webhook "Enviar Mensagem" do n8n
    const N8N_SEND_URL = 'https://seu-n8n.com/webhook/chat/send'; 

    try {
      const response = await fetch(N8N_SEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_phone: selectedConversation.contact_phone,
          message_body: currentMessage,
          user_id: user.id
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao enviar mensagem pelo webhook.');
      }

      // O n8n vai inserir no banco, e o Supabase Realtime (passo 3)
      // vai atualizar a UI. Limpamos o input.
      setCurrentMessage('');

    } catch (error) {
      console.error(error);
      // Adicionar toast de erro aqui
    } finally {
      setIsSending(false);
    }
  };

  if (isAuthLoading) {
    return (
      <AppLayout>
        <div className="flex h-[calc(100vh-8rem)]">
          <Skeleton className="w-1/3 h-full" />
          <Skeleton className="w-2/3 h-full ml-4" />
        </div>
      </AppLayout>
    );
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="flex h-[calc(100vh-8rem)] gap-4">

          {/* Painel Esquerdo: Conversas */}
          <Card className="w-1/3 flex flex-col">
            <CardContent className="p-2 flex-1 overflow-y-auto">
              {isLoadingConversations ? (
                <div className="space-y-2 p-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                conversations.map((convo) => (
                  <button
                    key={convo.id}
                    onClick={() => setSelectedConversationId(convo.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg hover:bg-accent",
                      selectedConversationId === convo.id && "bg-accent"
                    )}
                  >
                    <div className="font-medium">{convo.contact_name || convo.contact_phone}</div>
                    <p className="text-sm text-muted-foreground truncate">{convo.last_message_body}</p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {/* Painel Direito: Mensagens */}
          <Card className="w-2/3 flex flex-col">
            {selectedConversationId ? (
              <>
                {/* Header */}
                <div className="p-4 border-b">
                  <h3 className="font-semibold">{selectedConversation?.contact_name || selectedConversation?.contact_phone}</h3>
                </div>

                {/* Mensagens */}
                <CardContent className="flex-1 p-4 space-y-4 overflow-y-auto">
                  {isLoadingMessages ? (
                    <div className="space-y-4">
                       <Skeleton className="h-10 w-3/5" />
                       <Skeleton className="h-10 w-3/5 ml-auto" />
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          msg.direction === 'out' ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "p-3 rounded-lg max-w-[70%]",
                            msg.direction === 'out'
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <p>{msg.message_body}</p>
                          <p className="text-xs opacity-70 text-right mt-1">
                            {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>

                {/* Input de Envio */}
                <form onSubmit={handleSendMessage} className="p-4 border-t flex gap-2">
                  <Input
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    disabled={isSending}
                  />
                  <Button type="submit" size="icon" disabled={isSending}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Selecione uma conversa para começar
              </div>
            )}
          </Card>

        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}