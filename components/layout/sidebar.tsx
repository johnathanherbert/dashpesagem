'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { 
  PanelLeftOpen, 
  Home, 
  BarChart3, 
  Table2, 
  Settings,
  FileSpreadsheet,
  TrendingUp,
  Package,
  LogOut
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { signOut } from '@/lib/auth';

interface SidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function Sidebar({ activeTab = 'overview', onTabChange }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const menuItems = [
    { id: 'overview', label: 'Visão Geral', icon: Home },
    { id: 'financial', label: 'Análise Financeira', icon: TrendingUp },
    { id: 'inventory', label: 'Gestão de Estoque', icon: Package, disabled: true },
  ];

  const handleItemClick = (itemId: string) => {
    if (onTabChange) {
      onTabChange(itemId);
    }
    setOpen(false);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed left-4 top-4 z-50 shadow-lg"
        >
          <PanelLeftOpen className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[350px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Pesagem
          </SheetTitle>
          <SheetDescription>
            Sistema em desenvolvimento
          </SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-6">
          {/* Menu de Navegação */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground px-2">
              Navegação
            </h3>
            <nav className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => handleItemClick(item.id)}
                    disabled={item.disabled}
                  >
                    <Icon className="h-4 w-4 mr-3" />
                    {item.label}
                    {item.disabled && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        Em breve
                      </span>
                    )}
                  </Button>
                );
              })}
            </nav>
          </div>

          <Separator />

          {/* Seção de Configurações */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground px-2">
              Sistema
            </h3>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => handleItemClick('settings')}
            >
              <Settings className="h-4 w-4 mr-3" />
              Configurações
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <LogOut className="h-4 w-4 mr-3" />
              {loggingOut ? "Saindo..." : "Sair"}
            </Button>
          </div>

          {/* Informações do Sistema */}
          <div className="mt-auto pt-6">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p className="text-xs font-medium">Sistema de Aging</p>
              <p className="text-xs text-muted-foreground">
                Versão 1.0.0
              </p>
              <p className="text-xs text-muted-foreground">
                Gestão inteligente de estoque
              </p>
              <Separator className="my-3" />
              <p className="text-xs text-muted-foreground">
                Desenvolvido por{' '}
                <a 
                  href="https://github.com/johnathanherbert" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  Johnathan Herbert
                </a>
              </p>
              <p className="text-xs text-muted-foreground">
                ID75710
              </p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
