'use client';

import React from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  LayoutDashboard,
  AlertTriangle,
  Package,
  QrCode,
  Settings,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  const items = [
    {
      id: 'financial',
      label: 'Financeiro',
      icon: TrendingUp,
      action: () => onTabChange('financial'),
    },
    {
      id: 'residuais',
      label: 'Residuais',
      icon: AlertTriangle,
      action: () => onTabChange('residuais'),
    },
    {
      id: 'onepage',
      label: 'Onepage',
      icon: LayoutDashboard,
      action: () => onTabChange('onepage'),
    },
    {
      id: 'remessas',
      label: 'Remessas',
      icon: Package,
      action: () => onTabChange('remessas'),
    },
    {
      id: 'scanner',
      label: 'Scanner',
      icon: QrCode,
      action: () => onTabChange('scanner'),
    },
    {
      id: 'settings',
      label: 'Ajustes',
      icon: Settings,
      action: () => onTabChange('settings'),
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0E1D2D]/95 backdrop-blur-xl border-t border-[#2A4D6E] shadow-2xl px-1.5 py-1.5 flex items-center justify-around pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={item.action}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-xl transition-all duration-200 min-w-[52px]',
              isActive
                ? 'text-[#AEE4FF] font-bold active:scale-95'
                : 'text-[#608BA6] hover:text-slate-200 active:scale-95'
            )}
          >
            <div
              className={cn(
                'p-1 rounded-lg transition-colors',
                isActive
                  ? 'bg-[#AEE4FF] text-[#13283E] shadow-sm font-bold'
                  : 'bg-transparent text-current'
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-semibold leading-none mt-0.5">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
