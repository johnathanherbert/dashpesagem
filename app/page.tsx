'use client';

import { useState, useEffect } from 'react';
import { AgingData, RemessaData, ConfiguracaoResiduais } from '@/types/aging';
import { isMaterialEspecial } from '@/lib/materiais-especiais';
import { fetchAgingData, fetchMaterialValores, fetchRemessas, fetchConfiguracaoResiduais } from '@/lib/supabase';
import { AgingStats } from '@/components/aging-stats';
import { AgingFinancial } from '@/components/aging-financial';
import { ValorUpload } from '@/components/valor-upload';
import { RemessaUpload } from '@/components/remessa-upload';
import { ResiduaisView } from '@/components/residuais-view';
import { RemessasView } from '@/components/remessas-view';
import { ConfiguracaoResiduaisComponent } from '@/components/configuracao-residuais';
import { Sidebar } from '@/components/layout/sidebar';
import { UploadButton } from '@/components/layout/upload-button';
import { FilterPanel } from '@/components/layout/filter-panel';
import { ThemeToggle } from '@/components/theme-toggle';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Settings, TrendingUp, Package, AlertTriangle } from 'lucide-react';

export default function Home() {
  const [data, setData] = useState<AgingData[]>([]);
  const [valores, setValores] = useState<Record<string, number>>({});
  const [remessas, setRemessas] = useState<RemessaData[]>([]);
  const [configResiduais, setConfigResiduais] = useState<ConfiguracaoResiduais>({
    limite_verde: 100,
    limite_amarelo: 900,
    limite_maximo: 999,
    materiais_alto_valor: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('financial');
  const [materialFilter, setMaterialFilter] = useState<string | undefined>(undefined);
  const [selectedTipoDeposito, setSelectedTipoDeposito] = useState<string>('all');
  const [selectedMaterialEspecial, setSelectedMaterialEspecial] = useState<'inf' | 'cfa' | null>(null);
  const [selectedCriticality, setSelectedCriticality] = useState<'Normal' | 'Alerta' | 'Crítico' | null>(null);
  const [viewMode, setViewMode] = useState<'geral' | 'ajustes'>('geral');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [agingData, valoresData, remessasData, configData] = await Promise.all([
        fetchAgingData(),
        fetchMaterialValores(),
        fetchRemessas().catch(() => []), // Não falhar se remessas não existir
        fetchConfiguracaoResiduais().catch(() => ({
          limite_verde: 100,
          limite_amarelo: 900,
          limite_maximo: 999,
          materiais_alto_valor: [],
        })),
      ]);
      setData(agingData);
      setValores(valoresData);
      setRemessas(remessasData);
      setConfigResiduais(configData);
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

  // Filtrar dados por tipo de depósito
  const filteredData = data.filter(item => {
    if (selectedTipoDeposito !== 'all' && item.tipo_deposito !== selectedTipoDeposito) {
      return false;
    }
    return true;
  });

  // Filtrar dados para tabela (depósito + material especial + criticidade + modo)
  const tableFilteredData = (() => {
    let result = filteredData;

    if (selectedMaterialEspecial) {
      result = result.filter(item => isMaterialEspecial(item.material) === selectedMaterialEspecial);
    }

    if (viewMode === 'ajustes') {
      result = result.filter(item =>
        item.deposito === 'PES' &&
        item.tipo_deposito === 'PES' &&
        item.tipo_estoque === 'S'
      );
    }

    if (selectedCriticality) {
      result = result.filter(item => {
        const dias = item.dias_aging || 0;
        if (selectedCriticality === 'Normal') return dias < 10;
        if (selectedCriticality === 'Alerta') return dias >= 10 && dias <= 20;
        return dias > 20; // Crítico
      });
    }

    return result;
  })();

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
      
      <div className="w-full py-3 px-3 space-y-3 pt-16 lg:pt-3">
        {/* Header compacto */}
        <div className="flex items-center gap-4 lg:pl-12">
          <h1 className="text-lg font-bold tracking-tight whitespace-nowrap">Dashboard de Aging</h1>
          {selectedTipoDeposito !== 'all' && (
            <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
              Dep: {selectedTipoDeposito}
            </Badge>
          )}
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
            <AgingStats 
              data={filteredData} 
              onMaterialEspecialClick={setSelectedMaterialEspecial}
              selectedMaterialEspecial={selectedMaterialEspecial}
            />

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
              <TabsList className="grid w-full max-w-2xl grid-cols-4 h-8">
                <TabsTrigger value="financial" className="flex items-center gap-1.5 text-xs">
                  <TrendingUp className="h-3 w-3" />
                  Financeiro
                </TabsTrigger>
                <TabsTrigger value="residuais" className="flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="h-3 w-3" />
                  Residuais
                </TabsTrigger>
                <TabsTrigger value="remessas" className="flex items-center gap-1.5 text-xs">
                  <Package className="h-3 w-3" />
                  Remessas
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-1.5 text-xs">
                  <Settings className="h-3 w-3" />
                  Config
                </TabsTrigger>
              </TabsList>

              <TabsContent value="financial" className="space-y-3">
                {Object.keys(valores).length > 0 ? (
                  <>
                    <AgingFinancial
                      data={filteredData}
                      valores={valores}
                      selectedTipoDeposito={selectedTipoDeposito}
                      selectedMaterialEspecial={selectedMaterialEspecial}
                      selectedCriticality={selectedCriticality}
                      onCriticalityChange={setSelectedCriticality}
                      viewMode={viewMode}
                      onViewModeChange={setViewMode}
                    />
                    <ResiduaisView
                      agingData={tableFilteredData}
                      valores={valores}
                      remessas={remessas}
                      configResiduais={configResiduais}
                      onNavigateToRemessas={(material) => {
                        setMaterialFilter(material);
                        setActiveTab('remessas');
                      }}
                    />
                  </>
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

              <TabsContent value="settings" className="space-y-4">
                <div className="max-w-4xl space-y-4">
                  <h2 className="text-lg font-bold">Configuracoes do Sistema</h2>

                  <div className="space-y-4">
                    <ValorUpload onUploadComplete={loadData} />
                    <RemessaUpload onUploadComplete={loadData} />
                  </div>

                  <div className="pt-4">
                    <h3 className="text-base font-semibold mb-3">Configuracao de Residuais</h3>
                    <ConfiguracaoResiduaisComponent onConfigChange={loadData} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="residuais">
                <ResiduaisView
                  agingData={tableFilteredData}
                  valores={valores}
                  remessas={remessas}
                  configResiduais={configResiduais}
                  onNavigateToRemessas={(material) => {
                    setMaterialFilter(material);
                    setActiveTab('remessas');
                  }}
                />
              </TabsContent>

              <TabsContent value="remessas">
                <RemessasView
                  remessas={remessas}
                  materialFilter={materialFilter}
                />
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

