'use client';

import { useFirebase, ADMIN_EMAIL } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LogOut,
  Moon,
  Sun,
  User,
  Settings,
  Menu,
  Package,
  Clock,
  TrendingUp,
  LayoutDashboard,
  AlertTriangle,
  Upload,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';

interface TopbarProps {
  onToggleSidebar?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onOpenUpload?: () => void;
}

export function Topbar({ onToggleSidebar, activeTab = 'financial', onTabChange, onOpenUpload }: TopbarProps) {
  const { user, userData, signOut } = useFirebase();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    // Carregar tema inicial
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = saved || (prefersDark ? 'dark' : 'light');
    setTheme(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');

    // Relógio em tempo real
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  const navItems = [
    { id: 'financial', label: 'Financeiro', icon: TrendingUp },
    { id: 'onepage', label: 'Onepage', icon: LayoutDashboard },
    { id: 'residuais', label: 'Residuais', icon: AlertTriangle },
    { id: 'remessas', label: 'Remessas', icon: Package },
  ];

  const userInitial =
    userData?.name?.charAt(0).toUpperCase() ||
    user?.email?.charAt(0).toUpperCase() ||
    'U';

  return (
    <header className="sticky top-0 z-40 w-full h-16 bg-[#13283E] text-white shadow-md border-b border-[#2A4D6E] px-4 flex items-center justify-between backdrop-blur-md">
      {/* Esquerda: Menu toggle + Marca / Logo */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="text-white hover:bg-white/10 rounded-xl h-9 w-9"
          title="Abrir Menu Lateral"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-2.5">
          <img
            src="https://izishared.blob.core.windows.net/assets/grupo-ems-lp/grupoems-logo.png"
            alt="Grupo EMS"
            className="h-8 sm:h-9 w-auto object-contain brightness-0 invert opacity-95 shrink-0"
          />
          <div className="hidden sm:flex flex-col">
            
            <span className="text-[10px] text-[#608BA6] font-medium">
              Controle de Estoque PES - Manaus
            </span>
          </div>
        </div>
      </div>

      {/* Centro: Navegação rápida em desktop */}
      <nav className="hidden md:flex items-center gap-1 bg-[#1B3550] p-1 rounded-xl border border-[#2A4D6E]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange?.(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-[#AEE4FF] text-[#13283E] font-bold shadow-xs'
                  : 'text-[#608BA6] hover:text-white hover:bg-[#234465]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Direita: Relógio + Upload + Tema + Usuário */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Relógio */}
        {time && (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#1B3550] border border-[#2A4D6E] text-xs font-mono font-bold text-[#AEE4FF] shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-[#AEE4FF]" />
            <span>{time}</span>
          </div>
        )}

        {/* Botão de Upload */}
        {onOpenUpload && (
          <Button
            size="sm"
            onClick={onOpenUpload}
            className="h-8 text-xs font-bold gap-1.5 bg-[#AEE4FF] hover:bg-[#86d4fa] text-[#13283E] shadow-sm border-0"
            title="Importar planilhas"
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Upload</span>
          </Button>
        )}

        {/* Toggle Dark/Light Mode */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-white hover:bg-white/10 rounded-xl h-9 w-9 transition-colors"
          title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 text-[#E29A36]" />
          ) : (
            <Moon className="h-4 w-4 text-[#AEE4FF]" />
          )}
        </Button>

        {/* Dropdown Menu do Usuário */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 rounded-xl bg-[#1B3550] border border-[#2A4D6E] hover:bg-[#234465] text-[#AEE4FF] font-mono font-bold text-xs shadow-xs"
            >
              <span>{userInitial}</span>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-[#13283E]" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64 p-0 rounded-2xl shadow-xl border border-[#2A4D6E] bg-[#1B3550] text-slate-100 overflow-hidden">
            {/* Header do Perfil */}
            <div className="p-4 bg-[#13283E] border-b border-[#2A4D6E] text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1B3550] border border-[#2A4D6E] flex items-center justify-center font-mono font-bold text-sm text-[#AEE4FF]">
                  {userInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-xs truncate leading-tight text-[#AEE4FF]">
                    {userData?.name || user?.displayName || 'Usuário'}
                  </p>
                  <p className="text-[11px] text-[#608BA6] truncate font-mono mt-0.5">
                    {user?.email}
                  </p>
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-1">
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-[#1B3550] text-[#AEE4FF] border-[#2A4D6E]">
                  {user?.email === ADMIN_EMAIL ? 'Administrador' : 'Colaborador'}
                </Badge>
              </div>
            </div>

            <div className="p-1">
              <DropdownMenuItem
                onClick={() => onTabChange?.('settings')}
                className="cursor-pointer text-xs font-semibold py-2 px-3 gap-2 text-slate-200 hover:bg-[#234465] hover:text-[#AEE4FF] focus:bg-[#234465] focus:text-[#AEE4FF]"
              >
                <Settings className="h-4 w-4 text-[#608BA6]" />
                <span>Configurações</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-[#2A4D6E]" />

              <DropdownMenuItem
                onClick={() => signOut()}
                className="cursor-pointer text-xs font-semibold py-2 px-3 gap-2 text-[#E75B5B] hover:bg-[#E75B5B]/10 hover:text-[#E75B5B] focus:text-[#E75B5B] focus:bg-[#E75B5B]/10"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair da conta</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
