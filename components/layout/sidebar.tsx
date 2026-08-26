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
      <SheetContent side="left" className="w-[320px] sm:w-[360px] p-0 flex flex-col bg-[#13283E] border-r border-[#2A4D6E]">
        {/* Header Elegante estilo EMS */}
        <SheetHeader className="p-5 bg-[#1B3550] border-b border-[#2A4D6E] text-white text-left space-y-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#13283E] border border-[#2A4D6E] flex items-center justify-center font-black text-sm text-[#AEE4FF] shadow-xs">
              EMS
            </div>
            <div>
              <SheetTitle className="font-extrabold text-sm tracking-tight text-[#AEE4FF] uppercase leading-tight">
                Grupo EMS
              </SheetTitle>
              <SheetDescription className="text-[11px] text-[#608BA6] font-medium">
                Controle de Estoque & Pesagem
              </SheetDescription>
            </div>
          </div>

          {/* Usuário autenticado */}
          {(user || userData) && (
            <div className="mt-4 p-3 bg-[#13283E] rounded-xl flex items-center gap-3 border border-[#2A4D6E]">
              <div className="w-9 h-9 rounded-lg bg-[#1B3550] text-[#AEE4FF] flex items-center justify-center font-mono font-black text-xs shadow-xs border border-[#2A4D6E]">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate text-[#AEE4FF]">
                  {userData?.name || user?.displayName || 'Usuário'}
                </p>
                <p className="text-[11px] text-[#608BA6] truncate font-mono">
                  {userData?.email || user?.email}
                </p>
              </div>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-[#1B3550] text-[#AEE4FF] border-[#2A4D6E]">
                {user?.email === ADMIN_EMAIL ? 'Admin' : 'User'}
              </Badge>
            </div>
          )}
        </SheetHeader>

        {/* Corpo do menu */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Navegação Principal */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#608BA6] px-2">
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
                        ? 'bg-[#1B3550] text-[#AEE4FF] font-bold border border-[#2A4D6E] shadow-2xs'
                        : 'text-slate-300 hover:bg-[#1B3550]/70 hover:text-[#AEE4FF]'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      isActive ? 'bg-[#AEE4FF] text-[#13283E]' : 'bg-[#1B3550] group-hover:bg-[#234465] text-[#608BA6] group-hover:text-[#AEE4FF]'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold">{item.label}</span>
                        {item.badge && (
                          <span className="text-[9px] px-1.5 py-0 rounded-full bg-[#AEE4FF]/15 text-[#AEE4FF] font-bold border border-[#AEE4FF]/30">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#608BA6] truncate font-normal">
                        {item.description}
                      </p>
                    </div>
                    <ChevronRight className={`h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'opacity-100 text-[#AEE4FF]' : 'text-[#608BA6]'}`} />
                  </button>
                );
              })}
            </nav>
          </div>

          <Separator className="bg-[#2A4D6E]" />

          {/* Sistema & Gestão */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#608BA6] px-2">
              Administração
            </p>
            <nav className="space-y-1">
              <button
                onClick={() => handleItemClick('settings')}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${
                  activeTab === 'settings'
                    ? 'bg-[#1B3550] text-[#AEE4FF] font-bold border border-[#2A4D6E]'
                    : 'text-slate-300 hover:bg-[#1B3550]/70 hover:text-[#AEE4FF]'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#1B3550] flex items-center justify-center text-[#608BA6]">
                  <Settings className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold block">Configurações</span>
                  <p className="text-[10px] text-[#608BA6] truncate">Uploads e limites residuais</p>
                </div>
              </button>

              <button
                onClick={() => {
                  signOut();
                  onOpenChange(false);
                }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left text-[#E75B5B] hover:bg-[#E75B5B]/10 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#E75B5B]/10 flex items-center justify-center text-[#E75B5B] group-hover:bg-[#E75B5B] group-hover:text-white transition-colors">
                  <LogOut className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold block">Encerrar Sessão</span>
                  <p className="text-[10px] text-[#E75B5B]/70 truncate">Sair do sistema</p>
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Footer do Sidebar */}
        <div className="p-4 border-t border-[#2A4D6E] bg-[#13283E]">
          <div className="flex items-center justify-between text-[11px] text-[#608BA6]">
            <span>Versão 1.0.0</span>
            <span className="font-semibold text-[#AEE4FF]">Johnathan Herbert</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
