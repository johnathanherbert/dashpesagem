'use client';

import { useMemo, useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { AgingData } from '@/types/aging';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DollarSign, 
  TrendingUp, 
  AlertCircle, 
  Package, 
  Search,
  ChevronDown,
  ChevronUp,
  Calendar,
  Box,
  Flame,
  Thermometer
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getMaterialEspecialBadge } from '@/lib/materiais-especiais';

interface AgingFinancialProps {
  data: AgingData[];
  valores: Record<string, number>; // Mapeamento material -> valor_unitario
  selectedTipoDeposito?: string;
  selectedMaterialEspecial?: 'inf' | 'cfa' | null;
  globalSearch?: string;
  onGlobalSearchChange?: (value: string) => void;
}

export function AgingFinancial({ data, valores, selectedTipoDeposito = 'all', selectedMaterialEspecial = null, globalSearch = '', onGlobalSearchChange }: AgingFinancialProps) {
  const [sortField, setSortField] = useState<'valorTotal' | 'dias' | 'peso' | 'criticidade' | 'tipoEstoque'>('valorTotal');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [tableSearchTerms, setTableSearchTerms] = useState<Record<string, string>>({});
  const [tableLimits, setTableLimits] = useState<Record<string, number>>({});
  const [selectedCriticality, setSelectedCriticality] = useState<'Normal' | 'Alerta' | 'Crítico' | null>(null);
  const [viewMode, setViewMode] = useState<'geral' | 'ajustes'>('geral');
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);

  // Desativar modo ajustes quando mudar de depósito (se não for PES)
  useEffect(() => {
    if (selectedTipoDeposito !== 'PES' && viewMode === 'ajustes') {
      setViewMode('geral');
    }
  }, [selectedTipoDeposito, viewMode]);

  // Filtrar dados com base no modo de visualização e material especial
  const filteredDataByMode = useMemo(() => {
    let filtered = data;
    
    if (viewMode === 'ajustes') {
      // Filtrar apenas PES/PES com tipo_estoque = "S"
      filtered = filtered.filter(item => 
        item.deposito === 'PES' && 
        item.tipo_deposito === 'PES' && 
        item.tipo_estoque === 'S'
      );
    }
    
    // Aplicar filtro de material especial se selecionado
    if (selectedMaterialEspecial) {
      const materiaisEspeciais = require('@/data/materiais-especiais.json');
      const materiaisList = materiaisEspeciais[selectedMaterialEspecial].materiais;
      filtered = filtered.filter(item => materiaisList.includes(item.material));
    }
    
    return filtered;
  }, [data, viewMode, selectedMaterialEspecial]);

  // Estatísticas financeiras gerais
  const financialStats = useMemo(() => {
    let totalValorizado = 0;
    let valorCritico = 0;
    let valorAlerta = 0;
    let itensComValor = 0;

    filteredDataByMode.forEach(item => {
      const valor = valores[item.material];
      if (valor) {
        const valorTotal = (item.estoque_disponivel || 0) * valor;
        totalValorizado += valorTotal;
        itensComValor++;

        const dias = item.dias_aging || 0;
        if (dias > 20) {
          valorCritico += valorTotal;
        } else if (dias >= 10) {
          valorAlerta += valorTotal;
        }
      }
    });

    return {
      totalValorizado,
      valorCritico,
      valorAlerta,
      itensComValor,
      totalItens: filteredDataByMode.length,
      coberturaValores: filteredDataByMode.length > 0 ? ((itensComValor / filteredDataByMode.length) * 100).toFixed(1) : '0',
    };
  }, [filteredDataByMode, valores]);

  // Tipos de depósito únicos
  const tiposDeposito = useMemo(() => {
    const tipos = new Set(filteredDataByMode.map(item => item.tipo_deposito).filter(Boolean));
    return Array.from(tipos).sort();
  }, [filteredDataByMode]);

  // Análise financeira por tipo de depósito com todos os materiais valorizados
  const financialByTipo = useMemo(() => {
    return tiposDeposito.map(tipo => {
      const items = filteredDataByMode.filter(d => d.tipo_deposito === tipo);
      
      let totalValor = 0;
      let valorNormal = 0;
      let valorAlerta = 0;
      let valorCritico = 0;

      const materiaisValorizados = items
        .map(item => {
          const valor = valores[item.material];
          if (!valor) return null;

          const valorTotal = (item.estoque_disponivel || 0) * valor;
          totalValor += valorTotal;

          const dias = item.dias_aging || 0;
          if (dias < 10) valorNormal += valorTotal;
          else if (dias <= 20) valorAlerta += valorTotal;
          else valorCritico += valorTotal;

          return {
            material: item.material,
            descricao: item.texto_breve_material,
            lote: item.lote,
            centro: item.centro,
            deposito: item.deposito,
            tipo_deposito: item.tipo_deposito,
            posicao: item.posicao_deposito,
            peso: item.estoque_disponivel,
            unidade: item.unidade_medida,
            ultimoMovimento: item.ultimo_movimento,
            tipoEstoque: item.tipo_estoque,
            dias: item.dias_aging,
            valorUnitario: valor,
            valorTotal,
            criticidade: dias > 20 ? 'Crítico' : dias >= 10 ? 'Alerta' : 'Normal',
          };
        })
        .filter(Boolean);

      return {
        tipo,
        totalValor,
        valorNormal,
        valorAlerta,
        valorCritico,
        materiaisAll: materiaisValorizados,
      };
    });
  }, [filteredDataByMode, valores, tiposDeposito]);

  // Formatação de moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Formatação de data
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  // Handler de ordenação
  const handleSort = (field: 'valorTotal' | 'dias' | 'peso' | 'criticidade' | 'tipoEstoque') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Função para filtrar e ordenar materiais por tabela
  const getFilteredMaterials = (tipo: string, materiaisAll: any[]) => {
    const searchTerm = tableSearchTerms[tipo] || '';
    const limit = tableLimits[tipo] || 10;

    // Filtrar
    const filtered = materiaisAll.filter(item => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        item?.material.toLowerCase().includes(search) ||
        item?.descricao?.toLowerCase().includes(search) ||
        item?.lote?.toLowerCase().includes(search)
      );
    });

    // Ordenar
    const sorted = [...filtered].sort((a, b) => {
      const multiplier = sortOrder === 'desc' ? -1 : 1;
      
      if (sortField === 'valorTotal') {
        return ((b?.valorTotal || 0) - (a?.valorTotal || 0)) * multiplier;
      } else if (sortField === 'dias') {
        return ((b?.dias || 0) - (a?.dias || 0)) * multiplier;
      } else if (sortField === 'peso') {
        return ((b?.peso || 0) - (a?.peso || 0)) * multiplier;
      } else if (sortField === 'criticidade') {
        // Ordenar por criticidade: Crítico > Alerta > Normal
        const order = { 'Crítico': 3, 'Alerta': 2, 'Normal': 1 };
        const aValue = order[a?.criticidade as keyof typeof order] || 0;
        const bValue = order[b?.criticidade as keyof typeof order] || 0;
        return (bValue - aValue) * multiplier;
      } else if (sortField === 'tipoEstoque') {
        // Ordenar alfabeticamente por tipo de estoque
        const aValue = a?.tipoEstoque || '';
        const bValue = b?.tipoEstoque || '';
        return aValue.localeCompare(bValue) * multiplier;
      }
      
      return 0;
    });

    return {
      filtered: sorted,
      displayed: sorted.slice(0, limit),
    };
  };

  // Gráfico de pizza - Distribuição financeira por criticidade (com interatividade)
  const getCriticalityPieOption = () => {
    // Calcular estatísticas por criticidade
    const allMaterials = financialByTipo.flatMap(t => t.materiaisAll);
    
    const normalMaterials = allMaterials.filter(m => m?.criticidade === 'Normal');
    const alertaMaterials = allMaterials.filter(m => m?.criticidade === 'Alerta');
    const criticoMaterials = allMaterials.filter(m => m?.criticidade === 'Crítico');
    
    const normalLotes = new Set(normalMaterials.map(m => m?.lote)).size;
    const alertaLotes = new Set(alertaMaterials.map(m => m?.lote)).size;
    const criticoLotes = new Set(criticoMaterials.map(m => m?.lote)).size;
    
    const chartData = [
      { 
        name: 'Normal', 
        value: financialByTipo.reduce((sum, t) => sum + t.valorNormal, 0), 
        itemStyle: { color: '#10b981' },
        lotes: normalLotes,
        materiais: normalMaterials.length,
      },
      { 
        name: 'Alerta', 
        value: financialByTipo.reduce((sum, t) => sum + t.valorAlerta, 0), 
        itemStyle: { color: '#f59e0b' },
        lotes: alertaLotes,
        materiais: alertaMaterials.length,
      },
      { 
        name: 'Crítico', 
        value: financialByTipo.reduce((sum, t) => sum + t.valorCritico, 0), 
        itemStyle: { color: '#ef4444' },
        lotes: criticoLotes,
        materiais: criticoMaterials.length,
      },
    ];

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: 'transparent',
        borderRadius: 8,
        padding: 12,
        formatter: (params: any) => {
          const fullName = params.name === 'Normal' ? 'Normal (< 10 dias)' : 
                          params.name === 'Alerta' ? 'Alerta (10-20 dias)' : 
                          'Crítico (> 20 dias)';
          const dataItem = chartData.find(d => d.name === params.name);
          return `<strong style="color: #fff;">${fullName}</strong><br/>
                  <strong style="color: #fff;">${formatCurrency(params.value)}</strong> 
                  <span style="color: #9CA3AF;">(${params.percent}%)</span><br/>
                  <span style="color: #9CA3AF;">${dataItem?.materiais || 0} materiais em ${dataItem?.lotes || 0} lotes</span>`;
        },
      },
      legend: {
        bottom: 5,
        textStyle: { fontSize: 10 },
        formatter: (name: string) => {
          const dataItem = chartData.find(d => d.name === name);
          const label = name === 'Normal' ? 'Normal (< 10d)' : 
                        name === 'Alerta' ? 'Alerta (10-20d)' : 
                        'Crítico (> 20d)';
          return `${label} · ${dataItem?.lotes || 0} lotes`;
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: true,
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 12, fontWeight: 'bold' },
            scaleSize: 10,
          },
          data: chartData.map(item => ({
            ...item,
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)',
              },
            },
          })),
        },
      ],
    };
  };

  // Gráfico dinâmico - Detalhes da criticidade selecionada
  const getDetailedAnalysisOption = () => {
    if (!selectedCriticality) {
      // Gráfico padrão: Top 10 materiais gerais
      const allMaterials = financialByTipo.flatMap(t => {
        const { displayed } = getFilteredMaterials(t.tipo, t.materiaisAll);
        return displayed;
      });
      const topMaterials = allMaterials
        .sort((a, b) => (b?.valorTotal || 0) - (a?.valorTotal || 0))
        .slice(0, 10);

      return {
        title: {
          text: 'Top 10 Materiais por Valor Total',
          left: 'center',
          textStyle: { fontSize: 14 },
          subtext: 'Clique no gráfico ao lado para filtrar por criticidade',
          subtextStyle: { fontSize: 11, color: '#9CA3AF' },
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          borderColor: 'transparent',
          borderRadius: 8,
          padding: 12,
          formatter: (params: any) => {
            const item = topMaterials[params[0].dataIndex];
            return `<strong style="color: #fff;">${item?.material}</strong><br/>
                    <span style="color: #E5E7EB;">${item?.descricao?.substring(0, 40)}...</span><br/>
                    <strong style="color: #fff;">${formatCurrency(item?.valorTotal || 0)}</strong><br/>
                    <span style="color: #9CA3AF;">Estoque: ${item?.peso} ${item?.unidade || 'kg'}</span><br/>
                    <span style="color: #9CA3AF;">Valor Unit.: ${formatCurrency(item?.valorUnitario || 0)}</span><br/>
                    <span style="color: #9CA3AF;">Aging: ${item?.dias} dias · ${item?.tipo_deposito}</span>`;
          },
        },
        grid: {
          bottom: 80,
        },
        xAxis: {
          type: 'category',
          data: topMaterials.map(m => m?.material),
          axisLabel: { rotate: 45, fontSize: 10 },
        },
        yAxis: {
          type: 'value',
          name: 'Valor (R$)',
          axisLabel: {
            formatter: (value: number) => formatCurrency(value),
          },
        },
        series: [
          {
            type: 'bar',
            data: topMaterials.map(m => ({
              value: m?.valorTotal,
              itemStyle: {
                color: m?.criticidade === 'Crítico' ? '#ef4444' : m?.criticidade === 'Alerta' ? '#f59e0b' : '#10b981',
              },
            })),
          },
        ],
      };
    }

    // Materiais filtrados pela criticidade selecionada
    const filteredMaterials = financialByTipo
      .flatMap(t => t.materiaisAll)
      .filter(m => m?.criticidade === selectedCriticality)
      .sort((a, b) => (b?.valorTotal || 0) - (a?.valorTotal || 0))
      .slice(0, 15); // Top 15 da criticidade selecionada

    const chartColor = selectedCriticality === 'Crítico' ? '#ef4444' : 
                       selectedCriticality === 'Alerta' ? '#f59e0b' : '#10b981';

    const criticalityLabel = selectedCriticality === 'Normal' ? '< 10 dias' :
                            selectedCriticality === 'Alerta' ? '10-20 dias' : '> 20 dias';

    const totalValue = filteredMaterials.reduce((s, m) => s + (m?.valorTotal || 0), 0);

    return {
      title: {
        text: `Top 15 Materiais: ${selectedCriticality}`,
        left: 'center',
        textStyle: { fontSize: 14 },
        subtext: `${criticalityLabel} · ${formatCurrency(totalValue)}`,
        subtextStyle: { fontSize: 11, color: '#9CA3AF' },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: 'transparent',
        borderRadius: 8,
        padding: 12,
        formatter: (params: any) => {
          const item = filteredMaterials[params[0].dataIndex];
          return `<strong style="color: #fff;">${item?.material}</strong><br/>
                  <span style="color: #E5E7EB;">${item?.descricao?.substring(0, 40)}...</span><br/>
                  <strong style="color: #fff;">${formatCurrency(item?.valorTotal || 0)}</strong><br/>
                  <span style="color: #9CA3AF;">Estoque: ${item?.peso} ${item?.unidade || 'kg'}</span><br/>
                  <span style="color: #9CA3AF;">Valor Unit.: ${formatCurrency(item?.valorUnitario || 0)}</span><br/>
                  <span style="color: #9CA3AF;">Aging: ${item?.dias} dias · ${item?.tipo_deposito}</span><br/>
                  <span style="color: #9CA3AF;">Lote: ${item?.lote || 'N/A'}</span>`;
        },
      },
      grid: {
        bottom: 80,
      },
      xAxis: {
        type: 'category',
        data: filteredMaterials.map(m => m?.material),
        axisLabel: { 
          rotate: 45, 
          fontSize: 9,
          interval: 0,
        },
      },
      yAxis: {
        type: 'value',
        name: 'Valor (R$)',
        axisLabel: {
          formatter: (value: number) => formatCurrency(value),
        },
      },
      series: [
        {
          type: 'bar',
          data: filteredMaterials.map((m, idx) => ({
            value: m?.valorTotal,
            itemStyle: { color: chartColor },
            materialCode: m?.material,
            dataIndex: idx,
          })),
          barWidth: '60%',
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    };
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortOrder === 'desc' ? <ChevronDown className="h-4 w-4 inline" /> : <ChevronUp className="h-4 w-4 inline" />;
  };

  return (
    <div className="space-y-6">
      {/* Cards de Estatísticas Financeiras */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-green-500 to-teal-600 border-0 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4">
            <CardTitle className="text-sm font-medium opacity-90">Valor Total</CardTitle>
            <div className="p-1.5 bg-white/20 rounded-lg">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="text-2xl font-bold leading-tight">{formatCurrency(financialStats.totalValorizado)}</div>
            <p className="text-[10px] opacity-80 mt-0.5">
              {financialStats.itensComValor} de {financialStats.totalItens} itens valorados
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-cyan-600 border-0 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4">
            <CardTitle className="text-sm font-medium opacity-90">Cobertura de Valores</CardTitle>
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Package className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="text-2xl font-bold leading-tight">{financialStats.coberturaValores}%</div>
            <p className="text-[10px] opacity-80 mt-0.5">
              Materiais com valor cadastrado
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500 to-orange-600 border-0 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4">
            <CardTitle className="text-sm font-medium opacity-90">Valor em Alerta</CardTitle>
            <div className="p-1.5 bg-white/20 rounded-lg">
              <AlertCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="text-2xl font-bold leading-tight">{formatCurrency(financialStats.valorAlerta)}</div>
            <p className="text-[10px] opacity-80 mt-0.5">
              10-20 dias de aging
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-rose-600 border-0 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4">
            <CardTitle className="text-sm font-medium opacity-90">Valor Crítico</CardTitle>
            <div className="p-1.5 bg-white/20 rounded-lg">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="text-2xl font-bold leading-tight">{formatCurrency(financialStats.valorCritico)}</div>
            <p className="text-[10px] opacity-80 mt-0.5">
              Mais de 20 dias de aging
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Botões de Alternância de Modo */}
      {selectedTipoDeposito === 'PES' && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant={viewMode === 'geral' ? 'default' : 'outline'}
            onClick={() => {
              setViewMode('geral');
              setSelectedCriticality(null);
            }}
            className="min-w-[120px]"
          >
            Visão Geral
          </Button>
          <Button
            variant={viewMode === 'ajustes' ? 'default' : 'outline'}
            onClick={() => {
              setViewMode('ajustes');
              setSelectedCriticality(null);
            }}
            className="min-w-[120px]"
          >
            Ajustes (PES/S)
          </Button>
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Valor por Criticidade</span>
              <Badge variant="outline" className="text-xs font-normal">
                Clique para filtrar
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReactECharts 
              option={getCriticalityPieOption()} 
              style={{ height: '280px' }} 
              opts={{ renderer: 'svg' }}
              onEvents={{
                click: (params: any) => {
                  const criticality = params.name as 'Normal' | 'Alerta' | 'Crítico';
                  setSelectedCriticality(selectedCriticality === criticality ? null : criticality);
                },
              }}
            />
            
            {/* Estatísticas detalhadas */}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t">
              {(() => {
                const allMaterials = financialByTipo.flatMap(t => t.materiaisAll);
                const stats = [
                  {
                    label: 'Normal',
                    color: 'bg-green-500',
                    textColor: 'text-green-700 dark:text-green-400',
                    materials: allMaterials.filter(m => m?.criticidade === 'Normal'),
                  },
                  {
                    label: 'Alerta',
                    color: 'bg-yellow-500',
                    textColor: 'text-yellow-700 dark:text-yellow-400',
                    materials: allMaterials.filter(m => m?.criticidade === 'Alerta'),
                  },
                  {
                    label: 'Crítico',
                    color: 'bg-red-500',
                    textColor: 'text-red-700 dark:text-red-400',
                    materials: allMaterials.filter(m => m?.criticidade === 'Crítico'),
                  },
                ];

                return stats.map(stat => {
                  const lotes = new Set(stat.materials.map(m => m?.lote)).size;
                  const materiais = stat.materials.length;
                  
                  return (
                    <div 
                      key={stat.label}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        selectedCriticality === stat.label 
                          ? 'border-current ring-2 ring-offset-2 ring-current' 
                          : 'border-gray-200 dark:border-gray-700'
                      } ${stat.textColor}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${stat.color}`} />
                        <span className="font-semibold text-xs">{stat.label}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Materiais:</span>
                          <span className="font-bold">{materiais}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Lotes:</span>
                          <span className="font-bold">{lotes}</span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {selectedCriticality && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedCriticality(null)}
                className="absolute top-4 right-4 z-10"
              >
                Limpar Filtro
              </Button>
            )}
            <ReactECharts 
              option={getDetailedAnalysisOption()} 
              style={{ height: '350px' }} 
              opts={{ renderer: 'svg' }}
              onEvents={{
                click: (params: any) => {
                  if (params.componentType === 'series') {
                    const clickedMaterial = params.name;
                    if (clickedMaterial) {
                      // Encontrar o tipo_deposito do material clicado
                      const material = financialByTipo
                        .flatMap(t => t.materiaisAll)
                        .find(m => m?.material === clickedMaterial);
                      
                      if (material) {
                        // Atualizar o filtro de busca da tabela correspondente
                        setTableSearchTerms(prev => ({
                          ...prev,
                          [material.tipo_deposito]: clickedMaterial,
                        }));
                        setSelectedMaterial(clickedMaterial);
                        
                        // Scroll suave até a tabela
                        setTimeout(() => {
                          const tableElement = document.getElementById(`table-${material.tipo_deposito}`);
                          if (tableElement) {
                            tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }, 100);
                      }
                    }
                  }
                },
              }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Barra de Busca Global */}
      {onGlobalSearchChange && (
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-600 dark:text-purple-400" />
                <Input
                  type="text"
                  placeholder="Buscar em todos os depósitos: material, descrição, lote, centro..."
                  value={globalSearch}
                  onChange={(e) => onGlobalSearchChange(e.target.value)}
                  className="pl-11 pr-11 h-12 text-base border-purple-300 dark:border-purple-700 focus:ring-purple-500"
                />
                {globalSearch && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-purple-100 dark:hover:bg-purple-900"
                    onClick={() => onGlobalSearchChange('')}
                  >
                    <ChevronDown className="h-5 w-5 rotate-45" />
                  </Button>
                )}
              </div>
              {globalSearch && (
                <Badge className="bg-purple-600 text-white px-4 py-2 text-sm whitespace-nowrap">
                  {financialByTipo.reduce((sum, { materiaisAll }) => {
                    return sum + materiaisAll.filter(item => {
                      const search = globalSearch.toLowerCase();
                      return (
                        item?.material?.toLowerCase().includes(search) ||
                        item?.descricao?.toLowerCase().includes(search) ||
                        item?.lote?.toLowerCase().includes(search) ||
                        item?.centro?.toLowerCase().includes(search)
                      );
                    }).length;
                  }, 0)} resultados
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabelas Detalhadas por Tipo de Depósito */}
      {financialByTipo.map(({ tipo, materiaisAll, totalValor }) => {
        const { filtered, displayed } = getFilteredMaterials(tipo, materiaisAll);
        const searchTerm = tableSearchTerms[tipo] || '';
        const limit = tableLimits[tipo] || 10;
        const showAll = limit >= 999999;
        
        // Calcular total filtrado e informações de lotes
        const filteredTotal = filtered.reduce((sum, item) => sum + (item?.valorTotal || 0), 0);
        const filteredLotes = new Set(filtered.map(item => item?.lote)).size;
        const hasFilter = searchTerm.length > 0;
        
        return (
          <Card key={tipo} id={`table-${tipo}`}>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">Materiais - {tipo}</CardTitle>
                  <Badge variant="secondary">
                    {displayed.length} de {filtered.length} materiais
                  </Badge>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className="bg-blue-600 hover:bg-blue-700">
                    Total: {formatCurrency(totalValor)}
                  </Badge>
                  {hasFilter && filteredTotal !== totalValor && (
                    <Badge variant="outline" className="bg-green-50 dark:bg-green-950 border-green-600 text-green-700 dark:text-green-400 text-xs">
                      Filtrado: {formatCurrency(filteredTotal)} · {filteredLotes} {filteredLotes === 1 ? 'lote' : 'lotes'}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Barra de Filtro da Tabela */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar material, descrição ou lote..."
                    value={searchTerm}
                    onChange={(e) => setTableSearchTerms(prev => ({ ...prev, [tipo]: e.target.value }))}
                    className="pl-10"
                  />
                </div>
                <Select 
                  value={limit.toString()} 
                  onValueChange={(v) => setTableLimits(prev => ({ ...prev, [tipo]: Number(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">Mostrar 10</SelectItem>
                    <SelectItem value="20">Mostrar 20</SelectItem>
                    <SelectItem value="50">Mostrar 50</SelectItem>
                    <SelectItem value="100">Mostrar 100</SelectItem>
                    <SelectItem value="999999">Mostrar Todos ({filtered.length})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b-2 bg-slate-50 dark:bg-slate-800">
                    <tr className="text-left">
                      <th className="pb-3 pt-2 px-3 font-semibold">Material</th>
                      <th className="pb-3 pt-2 px-3 font-semibold">Descrição</th>
                      <th className="pb-3 pt-2 px-3 font-semibold">Lote</th>
                      <th className="pb-3 pt-2 px-3 font-semibold text-center">Centro</th>
                      <th className="pb-3 pt-2 px-3 font-semibold text-center">Posição</th>
                      <th 
                        className="pb-3 pt-2 px-3 font-semibold text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                        onClick={() => handleSort('peso')}
                      >
                        Qtd <SortIcon field="peso" />
                      </th>
                      <th className="pb-3 pt-2 px-3 font-semibold text-center">UMB</th>
                      <th className="pb-3 pt-2 px-3 font-semibold text-right">Valor Unit.</th>
                      <th 
                        className="pb-3 pt-2 px-3 font-semibold text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                        onClick={() => handleSort('valorTotal')}
                      >
                        Valor Total <SortIcon field="valorTotal" />
                      </th>
                      <th className="pb-3 pt-2 px-3 font-semibold text-center">
                        <Calendar className="h-4 w-4 inline mr-1" />
                        Último Mov.
                      </th>
                      <th 
                        className="pb-3 pt-2 px-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                        onClick={() => handleSort('dias')}
                      >
                        Aging <SortIcon field="dias" />
                      </th>
                      <th 
                        className="pb-3 pt-2 px-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                        onClick={() => handleSort('tipoEstoque')}
                      >
                        Tipo Est. <SortIcon field="tipoEstoque" />
                      </th>
                      <th 
                        className="pb-3 pt-2 px-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                        onClick={() => handleSort('criticidade')}
                      >
                        Status <SortIcon field="criticidade" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((item: any, idx: number) => {
                      const isSelected = selectedMaterial === item?.material;
                      return (
                        <tr 
                          key={idx} 
                          className={`border-b transition-colors ${
                            isSelected 
                              ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500' 
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold">{item?.material}</span>
                              {(() => {
                                const especial = getMaterialEspecialBadge(item?.material || '');
                                if (especial) {
                                  return (
                                    <Badge 
                                      className="text-[10px] flex items-center gap-1 whitespace-nowrap" 
                                      style={{ 
                                        backgroundColor: especial.config.cor,
                                        color: 'white',
                                        border: 'none'
                                      }}
                                    >
                                      {especial.tipo === 'inf' && <Flame className="h-3 w-3" />}
                                      {especial.tipo === 'cfa' && <Thermometer className="h-3 w-3" />}
                                      {especial.tipo.toUpperCase()}
                                    </Badge>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </td>
                        <td className="py-3 px-3 max-w-xs truncate" title={item?.descricao}>{item?.descricao}</td>
                        <td className="py-3 px-3 font-mono text-xs">{item?.lote || '-'}</td>
                        <td className="py-3 px-3 text-center text-xs">{item?.centro || '-'}</td>
                        <td className="py-3 px-3 text-center text-xs">{item?.posicao || '-'}</td>
                        <td className="py-3 px-3 text-right font-medium">{item?.peso?.toFixed(2)}</td>
                        <td className="py-3 px-3 text-center text-xs">
                          <Badge variant="outline" className="text-[10px]">{item?.unidade}</Badge>
                        </td>
                        <td className="py-3 px-3 text-right text-muted-foreground">{formatCurrency(item?.valorUnitario || 0)}</td>
                        <td className="py-3 px-3 text-right font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(item?.valorTotal || 0)}
                        </td>
                        <td className="py-3 px-3 text-center text-xs text-muted-foreground">
                          {item?.ultimoMovimento ? formatDate(item.ultimoMovimento) : '-'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Badge variant="outline" className={
                            (item?.dias || 0) > 20 ? 'border-red-500 text-red-700 dark:text-red-400' :
                            (item?.dias || 0) >= 10 ? 'border-yellow-500 text-yellow-700 dark:text-yellow-400' :
                            'border-green-500 text-green-700 dark:text-green-400'
                          }>
                            {item?.dias} dias
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-center text-xs">
                          <Badge variant="secondary" className="text-[10px]">
                            {item?.tipoEstoque || '-'}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Badge
                            className={
                              item?.criticidade === 'Crítico'
                                ? 'bg-red-500 hover:bg-red-600'
                                : item?.criticidade === 'Alerta'
                                ? 'bg-yellow-500 hover:bg-yellow-600 text-slate-900'
                                : 'bg-green-500 hover:bg-green-600'
                            }
                          >
                            {item?.criticidade}
                          </Badge>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {displayed.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Box className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum material encontrado com os filtros aplicados</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
