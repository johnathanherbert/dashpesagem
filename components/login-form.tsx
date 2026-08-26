"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/components/auth-provider';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const formSchema = z.object({
  email: z.string().email({ message: 'Email inválido.' }),
  password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
});

type FormData = z.infer<typeof formSchema>;

export function LoginForm() {
  const router = useRouter();
  const { signIn, resetPassword } = useFirebase();
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    
    try {
      const { error } = await signIn(data.email, data.password);
      
      if (error) {
        let errorMsg = 'Falha no login. Verifique seu email e senha.';
        const code = error.code;
        
        switch (code) {
          case 'auth/invalid-credential':
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            errorMsg = 'E-mail ou senha incorretos.';
            break;
          case 'auth/too-many-requests':
            errorMsg = 'Muitas tentativas falhas. Tente novamente mais tarde.';
            break;
          case 'auth/user-disabled':
            errorMsg = 'Esta conta foi desativada pelo administrador.';
            break;
        }

        toast.error(errorMsg);
        console.error('Login error:', error);
        return;
      }

      toast.success('Login realizado com sucesso!');
      router.push('/');
    } catch (error) {
      console.error('Unexpected error during login', error);
      toast.error('Ocorreu um erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const emailStr = getValues('email');
    if (!emailStr || !emailStr.includes('@')) {
      toast.error('Por favor, preencha um e-mail válido no campo acima para recuperar a senha.');
      return;
    }

    setIsResetting(true);
    try {
      const { error, success } = await resetPassword(emailStr);
      if (error) {
        toast.error('Ocorreu um erro ao enviar o link. Verifique o e-mail digitado.');
      } else if (success) {
        toast.success(`Link de recuperação enviado para ${emailStr}! Cheque sua caixa de entrada.`);
      }
    } catch (e) {
      toast.error('Erro na solicitação de recuperação.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="p-8 space-y-8 bg-card border border-border rounded-2xl shadow-xl">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
            <Lock className="w-7 h-7" />
          </div>
          
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Sistema de Aging & Pesagem
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              Entre para acessar o painel de gestão
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Email
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                {...register('email')}
                className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground/60 text-sm font-medium transition-all"
                disabled={isLoading}
                placeholder="seu@email.com"
              />
              <Mail className="absolute right-3.5 top-3 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
            </div>
            {errors.email && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.email.message}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Senha
            </label>
            <input
              id="password"
              type="password"
              {...register('password')}
              className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground/60 text-sm font-medium transition-all"
              disabled={isLoading}
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.password.message}
              </p>
            )}
          </div>        
          
          <div className="flex justify-end pt-0.5">
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={isLoading || isResetting}
              className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
            >
              {isResetting ? "Enviando..." : "Esqueci minha senha"}
            </button>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl py-5 font-bold text-sm tracking-wide"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Entrando...
              </span>
            ) : 'Entrar'}
          </Button>
        </form>
        
        <div className="text-center pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground font-medium">
            Não tem uma conta?{' '}
            <Link 
              href="/register" 
              className="text-primary font-bold hover:underline"
            >
              Registre-se aqui
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
