"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image'; // Importe o Image
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await login(email, password);

    if (error) {
      console.error('Falha no Submit do Login:', error);
      toast.error('Falha no Login', {
        description: error.message || 'Email ou senha inválidos.',
      });
    } else {
      console.log('Login bem-sucedido para:', email);
      router.push('/');
    }
    setIsSubmitting(false);
  };

  return (
    // Ajuste o container para centralizar verticalmente e adicionar padding
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Adicione a Logo aqui */}
      <div className="mb-8"> {/* Adiciona margem inferior */}
        <Image
          src="https://udblxrmkivxksgflmkni.supabase.co/storage/v1/object/public/logos/logo_cg_escrita_abaixo.png" // Mesma URL da logo
          alt="Logo Cristais de Gramado Conecta"
          width={200} // Tamanho maior - Largura
          height={66} // Tamanho maior - Altura (mantendo proporção aprox. de 120/40)
          className="object-contain"
          priority // Priorizar carregamento
        />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Acessar Plataforma</CardTitle> {/* Centralizado */}
          <CardDescription className="text-center"> {/* Centralizado */}
            Entre com suas credenciais para acessar o Cristais Conect
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
