'use client';

import { useState, useEffect } from 'react';
import { AgingData } from '@/types/aging';
import { fetchAgingData, fetchMaterialValores } from '@/lib/supabase';
import { AgingStats } from '@/components/aging-stats';
import { AgingCharts } from '@/components/aging-charts';
import { AgingFinancial } from '@/components/aging-financial';
import { ValorUpload } from '@/components/valor-upload';
import { Sidebar } from '@/components/layout/sidebar';
import { UploadButton } from '@/components/layout/upload-button';
import { FilterPanel } from '@/components/layout/filter-panel';
import { ThemeToggle } from '@/components/theme-toggle';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart3, Settings, TrendingUp } from 'lucide-react';

export default function Home() {
  const [data, setData] = useState<AgingData[]>([]);
  const [valores, setValores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('financial');
  const [selectedTipoDeposito, setSelectedTipoDeposito] = useState<string>('all');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [agingData, valoresData] = await Promise.all([
        fetchAgingData(),
        fetchMaterialValores(),
      ]);
      setData(agingData);
      setValores(valoresData);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError('Erro ao carregar dados. Verifique a configuração do Supabase.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUploadComplete = () => {
    loadData();
  };

  const handleTabChange = (tab: string) => {
    // Mapear tabs da sidebar para tabs do dashboard
    const tabMap: Record<string, string> = {
      overview: 'financial',
      charts: 'financial',
      table: 'table',
      financial: 'financial',
      settings: 'settings',
    };
    const newTab = tabMap[tab] || 'financial';
    setActiveTab(newTab);
  };

  // Obter tipos de depósito únicos
  const tiposDeposito = Array.from(
    new Set(data.map(item => item.tipo_deposito).filter(Boolean))
  ).sort();

  // Filtrar dados por tipo de depósito selecionado
  const filteredData = selectedTipoDeposito === 'all' 
    ? data 
    : data.filter(item => item.tipo_deposito === selectedTipoDeposito);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab === 'financial' ? 'overview' : activeTab} onTabChange={handleTabChange} />
      
      {/* Upload Button - Hidden on mobile */}
      <div className="hidden lg:block">
        <UploadButton onUploadComplete={handleUploadComplete} />
      </div>

      {/* Filter Panel */}
      {!loading && !error && data.length > 0 && (
        <FilterPanel
          tiposDeposito={tiposDeposito}
          selectedTipo={selectedTipoDeposito}
          onTipoChange={setSelectedTipoDeposito}
        />
      )}
      
      <div className="container mx-auto py-8 px-4 space-y-8 pt-24 lg:pt-8">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:pl-12">
          <div className="flex items-center justify-between pr-16">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Dashboard de Aging</h1>
              <p className="text-muted-foreground mt-2">
                Gestão inteligente do estoque Pesagem
              </p>
              {selectedTipoDeposito !== 'all' && (
                <div className="mt-3">
                  <Badge className="bg-blue-600 hover:bg-blue-700 text-white">
                    Filtrado depósito: {selectedTipoDeposito}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando dados...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3 max-w-md">
              <p className="text-red-600 font-medium">{error}</p>
              <p className="text-sm text-muted-foreground">
                Configure as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local
              </p>
            </div>
          </div>
        )}

        {/* Dashboard Content */}
        {!loading && !error && data.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <p className="text-lg font-medium">Nenhum dado disponível</p>
              <p className="text-sm text-muted-foreground">
                Faça upload de uma planilha Excel para começar
              </p>
            </div>
          </div>
        )}

        {!loading && !error && data.length > 0 && (
          <>
            {/* Statistics Cards */}
            <AgingStats data={filteredData} />

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full max-w-xl grid-cols-2">
                <TabsTrigger value="financial" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Financeiro
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Config
                </TabsTrigger>
              </TabsList>

              <TabsContent value="financial" className="space-y-6">
                {Object.keys(valores).length > 0 ? (
                  <AgingFinancial data={filteredData} valores={valores} selectedTipoDeposito={selectedTipoDeposito} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum valor unitário cadastrado</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Faça upload da planilha de valores unitários na aba "Configurações" para visualizar a análise financeira
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="settings" className="space-y-6">
                <div className="max-w-2xl space-y-6">
                  <h2 className="text-2xl font-bold">Configurações do Sistema</h2>
                  <ValorUpload />
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {/* Theme Toggle */}
      <ThemeToggle />
    </div>
  );
}

