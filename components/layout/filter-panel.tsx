'use client';

import { Badge } from '@/components/ui/badge';
import { Package, Layers } from 'lucide-react';

interface FilterPanelProps {
  tiposDeposito: string[];
  selectedTipo: string;
  onTipoChange: (tipo: string) => void;
}

export function FilterPanel({ tiposDeposito, selectedTipo, onTipoChange }: FilterPanelProps) {
  const activeFilterCount = selectedTipo !== 'all' ? 1 : 0;

  return (
    <>
      {/* Desktop: Painel lateral direito */}
      <div className="hidden lg:flex fixed right-4 top-32 z-40 flex-col gap-2">
        {/* Header */}
        <div className="flex items-center justify-center mb-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider rotate-0 flex items-center gap-1">
            <Layers className="h-3 w-3" />
          </div>
        </div>

        {/* Botão "Todos" */}
        <button
          onClick={() => onTipoChange('all')}
          className={`group relative px-3 py-6 rounded-xl transition-all duration-200 ${
            selectedTipo === 'all'
              ? 'bg-gradient-to-b from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
              : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 shadow-sm hover:shadow-md'
          }`}
          title="Todos os tipos"
        >
          <div className="flex flex-col items-center gap-2">
            <Package className={`h-4 w-4 ${
              selectedTipo === 'all' ? 'text-white' : 'text-slate-600 dark:text-slate-400'
            }`} />
            <span className={`text-[10px] font-semibold uppercase tracking-wide writing-mode-vertical ${
              selectedTipo === 'all' ? 'text-white' : 'text-slate-600 dark:text-slate-400'
            }`} style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
              Todos
            </span>
            {selectedTipo === 'all' && activeFilterCount === 0 && (
              <div className="absolute -top-1 -right-1">
                <div className="h-2 w-2 rounded-full bg-white border-2 border-blue-500" />
              </div>
            )}
          </div>
        </button>

        {/* Separator */}
        <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />

        {/* Lista de Tipos */}
        <div className="flex flex-col gap-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
          {tiposDeposito.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <Package className="h-4 w-4 mx-auto mb-1 text-muted-foreground opacity-50" />
              <p className="text-[8px] text-muted-foreground">Vazio</p>
            </div>
          ) : (
            tiposDeposito.map((tipo) => (
              <button
                key={tipo}
                onClick={() => onTipoChange(tipo)}
                className={`group relative px-3 py-6 rounded-xl transition-all duration-200 ${
                  selectedTipo === tipo
                    ? 'bg-gradient-to-b from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
                    : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600 shadow-sm hover:shadow-md'
                }`}
                title={tipo}
              >
                <div className="flex flex-col items-center gap-2">
                  <Package className={`h-4 w-4 ${
                    selectedTipo === tipo ? 'text-white' : 'text-slate-600 dark:text-slate-400'
                  }`} />
                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${
                    selectedTipo === tipo ? 'text-white' : 'text-slate-600 dark:text-slate-400'
                  }`} style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                    {tipo}
                  </span>
                  {selectedTipo === tipo && (
                    <div className="absolute -top-1 -right-1">
                      <div className="h-2 w-2 rounded-full bg-white border-2 border-emerald-500 animate-pulse" />
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Indicador de filtro ativo */}
        {activeFilterCount > 0 && (
          <div className="mt-1 px-2 py-1 rounded-lg bg-blue-500 text-white text-center">
            <p className="text-[8px] font-bold uppercase tracking-wider">Ativo</p>
          </div>
        )}
      </div>

      {/* Mobile: Barra superior fixa */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-md">
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Filtro por Tipo
            </span>
            {activeFilterCount > 0 && (
              <Badge variant="default" className="h-5 text-[10px] bg-blue-500">
                {activeFilterCount}
              </Badge>
            )}
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
            {/* Botão "Todos" */}
            <button
              onClick={() => onTipoChange('all')}
              className={`flex-shrink-0 px-4 py-2 rounded-lg transition-all duration-200 ${
                selectedTipo === 'all'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg'
                  : 'bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span className="text-xs font-semibold whitespace-nowrap">Todos</span>
              </div>
            </button>

            {/* Lista de tipos */}
            {tiposDeposito.map((tipo) => (
              <button
                key={tipo}
                onClick={() => onTipoChange(tipo)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg transition-all duration-200 ${
                  selectedTipo === tipo
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg'
                    : 'bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span className="text-xs font-semibold whitespace-nowrap">{tipo}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
