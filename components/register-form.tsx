"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/components/auth-provider';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { UserPlus, Mail, Lock, User, Loader2, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

const formSchema = z
  .object({
    firstName: z.string().min(2, { message: 'Mínimo de 2 caracteres.' }),
    lastName: z.string().min(2, { message: 'Mínimo de 2 caracteres.' }),
    email: z.string().email({ message: 'Email inválido.' }),
    password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
    confirmPassword: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof formSchema>;

export function RegisterForm() {
  const router = useRouter();
  const { signUp } = useFirebase();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const formatTitleCase = (str: string) => {
    return str
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    
    try {
      const formattedFirstName = formatTitleCase(data.firstName);
      const formattedLastName = formatTitleCase(data.lastName);
      const formattedName = `${formattedFirstName} ${formattedLastName}`;
      const { error } = await signUp(data.email, data.password, formattedName);
      
      if (error) {
        let msg = 'Falha no registro. Tente novamente.';
        if (error.code === 'auth/email-already-in-use') {
          msg = 'Este e-mail já está em uso.';
        } else if (error.code === 'auth/weak-password') {
          msg = 'A senha informada é muito fraca.';
        }
        toast.error(msg);
        console.error('Registration error:', error);
        return;
      }
      
      toast.success('Conta criada com sucesso! Faça login para continuar.');
      router.push('/login');
    } catch (error) {
      console.error('Unexpected error during registration', error);
      toast.error('Ocorreu um erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[480px] mx-auto">
      <div className="p-7 sm:p-9 space-y-6 bg-[#13283E]/95 backdrop-blur-xl border border-[#2A4D6E] rounded-3xl shadow-2xl shadow-black/60 relative overflow-hidden">
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
              Criar Nova Conta
            </h1>
            <p className="text-xs font-medium text-[#608BA6] mt-1">
              Acesso ao Controle de Estoque PES - Manaus
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="firstName" className="text-[11px] font-bold text-[#608BA6] uppercase tracking-wider block">
                Nome
              </label>
              <div className="relative">
                <input
                  id="firstName"
                  type="text"
                  {...register('firstName')}
                  className="w-full px-3.5 py-2.5 bg-[#1B3550]/90 border border-[#2A4D6E] rounded-xl text-white placeholder:text-[#608BA6]/70 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#AEE4FF]/40 focus:border-[#AEE4FF] transition-all"
                  disabled={isLoading}
                  placeholder="João"
                />
              </div>
              {errors.firstName && (
                <p className="text-xs text-[#E75B5B] font-medium flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.firstName.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="lastName" className="text-[11px] font-bold text-[#608BA6] uppercase tracking-wider block">
                Sobrenome
              </label>
              <input
                id="lastName"
                type="text"
                {...register('lastName')}
                className="w-full px-3.5 py-2.5 bg-[#1B3550]/90 border border-[#2A4D6E] rounded-xl text-white placeholder:text-[#608BA6]/70 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#AEE4FF]/40 focus:border-[#AEE4FF] transition-all"
                disabled={isLoading}
                placeholder="Silva"
              />
              {errors.lastName && (
                <p className="text-xs text-[#E75B5B] font-medium flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>
          
          <div className="space-y-1">
            <label htmlFor="email" className="text-[11px] font-bold text-[#608BA6] uppercase tracking-wider block">
              E-mail Corporativo
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                {...register('email')}
                className="w-full pl-3.5 pr-10 py-2.5 bg-[#1B3550]/90 border border-[#2A4D6E] rounded-xl text-white placeholder:text-[#608BA6]/70 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#AEE4FF]/40 focus:border-[#AEE4FF] transition-all"
                disabled={isLoading}
                placeholder="seu.email@ems.com.br"
              />
              <Mail className="absolute right-3.5 top-3 w-4 h-4 text-[#608BA6] pointer-events-none" />
            </div>
            {errors.email && (
              <p className="text-xs text-[#E75B5B] font-medium flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errors.email.message}
              </p>
            )}
          </div>
          
          <div className="space-y-1">
            <label htmlFor="password" className="text-[11px] font-bold text-[#608BA6] uppercase tracking-wider block">
              Senha
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                {...register('password')}
                className="w-full pl-3.5 pr-10 py-2.5 bg-[#1B3550]/90 border border-[#2A4D6E] rounded-xl text-white placeholder:text-[#608BA6]/70 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#AEE4FF]/40 focus:border-[#AEE4FF] transition-all"
                disabled={isLoading}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-[#608BA6] hover:text-[#AEE4FF] transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-[#E75B5B] font-medium flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errors.password.message}
              </p>
            )}
          </div>
          
          <div className="space-y-1">
            <label htmlFor="confirmPassword" className="text-[11px] font-bold text-[#608BA6] uppercase tracking-wider block">
              Confirmar Senha
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                {...register('confirmPassword')}
                className="w-full pl-3.5 pr-10 py-2.5 bg-[#1B3550]/90 border border-[#2A4D6E] rounded-xl text-white placeholder:text-[#608BA6]/70 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#AEE4FF]/40 focus:border-[#AEE4FF] transition-all"
                disabled={isLoading}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-3 text-[#608BA6] hover:text-[#AEE4FF] transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-[#E75B5B] font-medium flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errors.confirmPassword.message}
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
                Registrando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <UserPlus className="w-4 h-4" />
                Cadastrar Conta
              </span>
            )}
          </Button>
        </form>
        
        <div className="space-y-3 pt-3 border-t border-[#2A4D6E]/80 text-center">
          <p className="text-xs text-[#608BA6]">
            Já possui acesso?{' '}
            <Link 
              href="/login" 
              className="text-[#AEE4FF] font-bold hover:underline"
            >
              Fazer Login
            </Link>
          </p>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#608BA6]/90 bg-[#1B3550]/50 py-1.5 px-3 rounded-lg border border-[#2A4D6E]/60">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Compatível com contas corporativas Grupo EMS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
