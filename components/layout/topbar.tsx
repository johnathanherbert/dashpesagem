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
    <header className="sticky top-0 z-40 w-full h-16 bg-gradient-to-r from-[#002e52] via-[#003b66] to-[#002e52] text-white shadow-md border-b border-white/10 px-4 flex items-center justify-between backdrop-blur-md">
      {/* Esquerda: Menu toggle + Marca / Logo */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="text-white hover:bg-white/15 rounded-xl h-9 w-9"
          title="Abrir Menu Lateral"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center font-black text-sm tracking-wider shadow-xs">
            EMS
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="font-extrabold text-sm tracking-tight leading-none text-white">
              Sistema de Aging & Pesagem
            </span>
            <span className="text-[10px] text-blue-200/80 font-medium">
              Gestão Inteligente de Estoque
            </span>
          </div>
        </div>
      </div>

      {/* Centro: Navegação rápida em desktop */}
      <nav className="hidden md:flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/10">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange?.(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
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
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 border border-white/10 text-xs font-mono font-bold text-blue-100 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-blue-300" />
            <span>{time}</span>
          </div>
        )}

        {/* Botão de Upload */}
        {onOpenUpload && (
          <Button
            size="sm"
            onClick={onOpenUpload}
            className="h-8 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm border-0"
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
          className="text-white hover:bg-white/15 rounded-xl h-9 w-9 transition-colors"
          title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 text-amber-300" />
          ) : (
            <Moon className="h-4 w-4 text-blue-200" />
          )}
        </Button>

        {/* Dropdown Menu do Usuário */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 rounded-xl bg-white/15 border border-white/25 hover:bg-white/25 text-white font-mono font-bold text-xs shadow-xs"
            >
              <span>{userInitial}</span>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-[#002e52]" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64 p-0 rounded-2xl shadow-xl border border-border overflow-hidden">
            {/* Header do Perfil */}
            <div className="p-4 bg-gradient-to-br from-[#002e52] to-[#003b66] text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center font-mono font-bold text-sm text-white">
                  {userInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-xs truncate leading-tight">
                    {userData?.name || user?.displayName || 'Usuário'}
                  </p>
                  <p className="text-[11px] text-blue-200/80 truncate font-mono mt-0.5">
                    {user?.email}
                  </p>
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-1">
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-white/15 text-white border-white/20">
                  {user?.email === ADMIN_EMAIL ? 'Administrador' : 'Colaborador'}
                </Badge>
              </div>
            </div>

            <div className="p-1">
              <DropdownMenuItem
                onClick={() => onTabChange?.('settings')}
                className="cursor-pointer text-xs font-semibold py-2 px-3 gap-2"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span>Configurações</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => signOut()}
                className="cursor-pointer text-xs font-semibold py-2 px-3 gap-2 text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50"
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
