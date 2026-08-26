"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/components/auth-provider';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Lock, Mail, Loader2, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
  
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
    <div className="w-full max-w-[440px] mx-auto">
      <div className="p-7 sm:p-9 space-y-7 bg-[#13283E]/95 backdrop-blur-xl border border-[#2A4D6E] rounded-3xl shadow-2xl shadow-black/60 relative overflow-hidden">
        {/* Barra decorativa superior */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1B3550] via-[#AEE4FF] to-[#1B3550]" />

        {/* Header com Logo Grupo EMS */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-[#1B3550]/80 border border-[#2A4D6E] rounded-2xl shadow-inner mb-1">
            <img
              src="https://izishared.blob.core.windows.net/assets/grupo-ems-lp/grupoems-logo.png"
              alt="Grupo EMS"
              className="h-10 sm:h-11 w-auto object-contain brightness-0 invert opacity-95"
            />
          </div>
          
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
              Controle de Estoque
            </h1>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <span className="text-xs font-bold text-[#AEE4FF] tracking-wider uppercase">
                PES - Manaus
              </span>
              <span className="text-[#608BA6]">•</span>
              <span className="text-xs font-medium text-[#608BA6]">
                Gestão de Aging
              </span>
            </div>
          </div>
        </div>

        {/* Formulário de Acesso */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-[11px] font-bold text-[#608BA6] uppercase tracking-wider block">
              E-mail Corporativo
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                {...register('email')}
                className="w-full pl-4 pr-10 py-3 bg-[#1B3550]/90 border border-[#2A4D6E] rounded-xl text-white placeholder:text-[#608BA6]/70 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#AEE4FF]/40 focus:border-[#AEE4FF] transition-all"
                disabled={isLoading}
                placeholder="seu.email@ems.com.br"
                autoComplete="email"
              />
              <Mail className="absolute right-3.5 top-3.5 w-4 h-4 text-[#608BA6] pointer-events-none" />
            </div>
            {errors.email && (
              <p className="text-xs text-[#E75B5B] font-medium flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errors.email.message}
              </p>
            )}
          </div>
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-[11px] font-bold text-[#608BA6] uppercase tracking-wider block">
                Senha
              </label>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={isLoading || isResetting}
                className="text-[11px] font-semibold text-[#AEE4FF] hover:underline transition-colors disabled:opacity-50"
              >
                {isResetting ? "Enviando..." : "Esqueci minha senha"}
              </button>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                {...register('password')}
                className="w-full pl-4 pr-10 py-3 bg-[#1B3550]/90 border border-[#2A4D6E] rounded-xl text-white placeholder:text-[#608BA6]/70 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#AEE4FF]/40 focus:border-[#AEE4FF] transition-all"
                disabled={isLoading}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-[#608BA6] hover:text-[#AEE4FF] transition-colors"
                title={showPassword ? "Ocultar senha" : "Ver senha"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-[#E75B5B] font-medium flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errors.password.message}
              </p>
            )}
          </div>        

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl py-5 text-sm font-bold tracking-wide bg-[#AEE4FF] hover:bg-[#86d4fa] text-[#13283E] shadow-md shadow-[#AEE4FF]/10 transition-all active:scale-[0.99] mt-2 border-0 cursor-pointer"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#13283E]" />
                Autenticando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Lock className="w-4 h-4" />
                Entrar no Sistema
              </span>
            )}
          </Button>
        </form>
        
        {/* Footer / Links */}
        <div className="space-y-3 pt-4 border-t border-[#2A4D6E]/80 text-center">
          <p className="text-xs text-[#608BA6]">
            Não possui uma conta?{' '}
            <Link 
              href="/register" 
              className="text-[#AEE4FF] font-bold hover:underline"
            >
              Criar acesso
            </Link>
          </p>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#608BA6]/90 bg-[#1B3550]/50 py-1.5 px-3 rounded-lg border border-[#2A4D6E]/60">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Autenticação unificada com o ecossistema AgileWork</span>
          </div>
        </div>
      </div>
    </div>
  );
}
