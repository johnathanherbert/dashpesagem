'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { 
  Settings,
  FileSpreadsheet,
  TrendingUp,
  Package,
  LogOut,
  LayoutDashboard,
  AlertTriangle,
  User,
  Shield,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useFirebase, ADMIN_EMAIL } from '@/components/auth-provider';
import { Badge } from '@/components/ui/badge';

interface SidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  description: string;
  icon: any;
  badge?: string;
}

export function Sidebar({ open, onOpenChange, activeTab = 'financial', onTabChange }: SidebarProps) {
  const { userData, user, signOut } = useFirebase();

  const menuItems: MenuItem[] = [
    {
      id: 'financial',
      label: 'Análise Financeira',
      description: 'Aging valorizado & evolução',
      icon: TrendingUp,
    },
    {
      id: 'onepage',
      label: 'Onepage Posições',
      description: 'Pesagem, Ajuste e Aju-Saída',
      icon: LayoutDashboard,
      badge: 'Novo',
    },
    {
      id: 'residuais',
      label: 'Gestão de Residuais',
      description: 'Lotes residuais & estoque PES',
      icon: AlertTriangle,
    },
    {
      id: 'remessas',
      label: 'Controle de Remessas',
      description: 'Remessas abertas & picking',
      icon: Package,
    },
  ];

  const handleItemClick = (itemId: string) => {
    if (onTabChange) {
      onTabChange(itemId);
    }
    onOpenChange(false);
  };

  const userInitial =
    userData?.name?.charAt(0).toUpperCase() ||
    user?.email?.charAt(0).toUpperCase() ||
    'U';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[320px] sm:w-[360px] p-0 flex flex-col bg-card border-r border-border">
        {/* Header Elegante estilo EMS */}
        <SheetHeader className="p-5 bg-gradient-to-br from-[#002e52] via-[#003b66] to-[#002e52] text-white text-left space-y-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center font-black text-sm text-white shadow-xs">
              EMS
            </div>
            <div>
              <SheetTitle className="font-extrabold text-sm tracking-tight text-white leading-tight">
                Sistema de Aging & Pesagem
              </SheetTitle>
              <SheetDescription className="text-[11px] text-blue-200/80 font-medium">
                Controle de Estoque Farmacêutico
              </SheetDescription>
            </div>
          </div>

          {/* Usuário autenticado */}
          {(user || userData) && (
            <div className="mt-4 p-3 bg-white/10 rounded-xl flex items-center gap-3 border border-white/15 backdrop-blur-xs">
              <div className="w-9 h-9 rounded-lg bg-white/20 text-white flex items-center justify-center font-mono font-black text-xs shadow-xs">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate text-white">
                  {userData?.name || user?.displayName || 'Usuário'}
                </p>
                <p className="text-[11px] text-blue-200/80 truncate font-mono">
                  {userData?.email || user?.email}
                </p>
              </div>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-white/15 text-white border-white/25">
                {user?.email === ADMIN_EMAIL ? 'Admin' : 'User'}
              </Badge>
            </div>
          )}
        </SheetHeader>

        {/* Corpo do menu */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Navegação Principal */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2">
              Módulos Principais
            </p>
            <nav className="space-y-1.5">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all group ${
                      isActive
                        ? 'bg-primary/10 text-primary font-bold border border-primary/20 shadow-2xs'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      isActive ? 'bg-primary text-primary-foreground' : 'bg-muted group-hover:bg-card text-muted-foreground group-hover:text-foreground'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold">{item.label}</span>
                        {item.badge && (
                          <span className="text-[9px] px-1.5 py-0 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground/80 truncate font-normal">
                        {item.description}
                      </p>
                    </div>
                    <ChevronRight className={`h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'opacity-100 text-primary' : 'text-muted-foreground'}`} />
                  </button>
                );
              })}
            </nav>
          </div>

          <Separator />

          {/* Sistema & Gestão */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2">
              Administração
            </p>
            <nav className="space-y-1">
              <button
                onClick={() => handleItemClick('settings')}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${
                  activeTab === 'settings'
                    ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                  <Settings className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold block">Configurações</span>
                  <p className="text-[10px] text-muted-foreground/80 truncate">Uploads e limites residuais</p>
                </div>
              </button>

              <button
                onClick={() => {
                  signOut();
                  onOpenChange(false);
                }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left text-red-600 hover:bg-red-500/10 dark:hover:bg-red-950/40 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-600 group-hover:bg-red-500 group-hover:text-white transition-colors">
                  <LogOut className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold block">Encerrar Sessão</span>
                  <p className="text-[10px] text-red-600/70 truncate">Sair do sistema</p>
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Footer do Sidebar */}
        <div className="p-4 border-t border-border bg-muted/30">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Versão 1.0.0</span>
            <span className="font-semibold text-foreground">Johnathan Herbert</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
