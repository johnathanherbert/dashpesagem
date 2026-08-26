"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/components/auth-provider';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { UserPlus, Mail, Lock, User, Loader2, AlertCircle } from 'lucide-react';
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
      
      toast.success('Registro realizado com sucesso! Aguarde aprovação ou faça login.');
      router.push('/login');
    } catch (error) {
      console.error('Unexpected error during registration', error);
      toast.error('Ocorreu um erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="p-8 space-y-8 bg-card border border-border rounded-2xl shadow-xl">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
            <UserPlus className="w-7 h-7" />
          </div>
          
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Criar Conta
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              Registre-se para solicitar acesso ao sistema
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="firstName" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Nome
              </label>
              <div className="relative">
                <input
                  id="firstName"
                  type="text"
                  {...register('firstName')}
                  className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground/60 text-sm font-medium transition-all"
                  disabled={isLoading}
                  placeholder="João"
                />
              </div>
              {errors.firstName && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.firstName.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="lastName" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Sobrenome
              </label>
              <input
                id="lastName"
                type="text"
                {...register('lastName')}
                className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground/60 text-sm font-medium transition-all"
                disabled={isLoading}
                placeholder="Silva"
              />
              {errors.lastName && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>
          
          <div className="space-y-1.5">
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
              <p className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.email.message}
              </p>
            )}
          </div>
          
          <div className="space-y-1.5">
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
              <p className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.password.message}
              </p>
            )}
          </div>
          
          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Confirmar Senha
            </label>
            <input
              id="confirmPassword"
              type="password"
              {...register('confirmPassword')}
              className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground/60 text-sm font-medium transition-all"
              disabled={isLoading}
              placeholder="••••••••"
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
          
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl py-5 font-bold text-sm tracking-wide mt-2"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Registrando...
              </span>
            ) : 'Criar Conta'}
          </Button>
        </form>
        
        <div className="text-center pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground font-medium">
            Já tem uma conta?{' '}
            <Link 
              href="/login" 
              className="text-primary font-bold hover:underline"
            >
              Faça login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
