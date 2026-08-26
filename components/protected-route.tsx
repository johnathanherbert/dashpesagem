"use client";

import { useFirebase } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, userData, loading, signOut } = useFirebase();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Carregando autenticação...</p>
        </div>
      </div>
    );
  }

  if (user && !userData) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Verificando conta...</p>
        </div>
      </div>
    );
  }

  if (userData && !userData.isApproved) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border border-border p-8 rounded-xl shadow-lg text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 mb-6">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold mb-4 text-foreground">Conta Pendente</h2>
          <p className="text-muted-foreground mb-6 font-medium">
            Sua conta está aguardando aprovação ou foi desabilitada por um administrador.
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            Entre em contato com johnathan.herbert47@gmail.com para solicitar o acesso.
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              await signOut();
              router.replace('/login');
            }}
            className="w-full"
          >
            Voltar para Login
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
