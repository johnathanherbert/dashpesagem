'use client';

import { useMemo, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { AgingData } from '@/types/aging';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  Package,
} from 'lucide-react';

interface AgingFinancialProps {
  data: AgingData[];
  valores: Record<string, number>;
  selectedTipoDeposito?: string;
  selectedMaterialEspecial?: 'inf' | 'cfa' | null;
  selectedCriticality?: 'Normal' | 'Alerta' | 'Crítico' | null;
  onCriticalityChange?: (value: 'Normal' | 'Alerta' | 'Crítico' | null) => void;
  viewMode?: 'geral' | 'ajustes';
  onViewModeChange?: (value: 'geral' | 'ajustes') => void;
}

export function AgingFinancial({
  data,
  valores,
  selectedTipoDeposito = 'all',
  selectedMaterialEspecial = null,
  selectedCriticality = null,
  onCriticalityChange,
  viewMode = 'geral',
  onViewModeChange,
}: AgingFinancialProps) {

  useEffect(() => {
    if (selectedTipoDeposito !== 'PES' && viewMode === 'ajustes') {
      onViewModeChange?.('geral');
    }
  }, [selectedTipoDeposito, viewMode, onViewModeChange]);

  const filteredDataByMode = useMemo(() => {
    let filtered = data;

    if (viewMode === 'ajustes') {
      filtered = filtered.filter(item =>
        item.deposito === 'PES' &&
        item.tipo_deposito === 'PES' &&
        item.tipo_estoque === 'S'
      );
    }

    if (selectedMaterialEspecial) {
      const materiaisEspeciais = require('@/data/materiais-especiais.json');
      const materiaisList = materiaisEspeciais[selectedMaterialEspecial].materiais;
      filtered = filtered.filter(item => materiaisList.includes(item.material));
    }

    return filtered;
  }, [data, viewMode, selectedMaterialEspecial]);

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

  const tiposDeposito = useMemo(() => {
    const tipos = new Set(filteredDataByMode.map(item => item.tipo_deposito).filter(Boolean));
    return Array.from(tipos).sort();
  }, [filteredDataByMode]);

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
            tipo_deposito: item.tipo_deposito,
            peso: item.estoque_disponivel,
            unidade: item.unidade_medida,
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getCriticalityPieOption = () => {
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

  const getDetailedAnalysisOption = () => {
    const allMaterials = financialByTipo.flatMap(t => t.materiaisAll);

    if (!selectedCriticality) {
      const topMaterials = [...allMaterials]
        .sort((a, b) => (b?.valorTotal || 0) - (a?.valorTotal || 0))
        .slice(0, 10);

      return {
        title: {
          text: 'Top 10 Materiais por Valor Total',
          left: 'center',
          textStyle: { fontSize: 14 },
          subtext: 'Clique no grafico ao lado para filtrar por criticidade',
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
        grid: { bottom: 80 },
        xAxis: {
          type: 'category',
          data: topMaterials.map(m => m?.material),
          axisLabel: { rotate: 45, fontSize: 10 },
        },
        yAxis: {
          type: 'value',
          name: 'Valor (R$)',
          axisLabel: { formatter: (value: number) => formatCurrency(value) },
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

    const filteredMaterials = allMaterials
      .filter(m => m?.criticidade === selectedCriticality)
      .sort((a, b) => (b?.valorTotal || 0) - (a?.valorTotal || 0))
      .slice(0, 15);

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
      grid: { bottom: 80 },
      xAxis: {
        type: 'category',
        data: filteredMaterials.map(m => m?.material),
        axisLabel: { rotate: 45, fontSize: 9, interval: 0 },
      },
      yAxis: {
        type: 'value',
        name: 'Valor (R$)',
        axisLabel: { formatter: (value: number) => formatCurrency(value) },
      },
      series: [
        {
          type: 'bar',
          data: filteredMaterials.map(m => ({
            value: m?.valorTotal,
            itemStyle: { color: chartColor },
          })),
          barWidth: '60%',
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' },
          },
        },
      ],
    };
  };

  return (
    <div className="space-y-3">
      {/* Cards de Estatisticas Financeiras */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <Card className="bg-gradient-to-br from-green-500 to-teal-600 border-0 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-2">
            <CardTitle className="text-sm font-medium opacity-90">Valor Total</CardTitle>
            <div className="p-1 bg-white/20 rounded-lg">
              <DollarSign className="h-3 w-3" />
            </div>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="text-lg font-bold leading-tight">{formatCurrency(financialStats.totalValorizado)}</div>
            <p className="text-[10px] opacity-80 mt-0.5">
              {financialStats.itensComValor} de {financialStats.totalItens} itens valorados
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-cyan-600 border-0 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-2">
            <CardTitle className="text-sm font-medium opacity-90">Cobertura de Valores</CardTitle>
            <div className="p-1 bg-white/20 rounded-lg">
              <Package className="h-3 w-3" />
            </div>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="text-lg font-bold leading-tight">{financialStats.coberturaValores}%</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500 to-orange-600 border-0 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-2">
            <CardTitle className="text-sm font-medium opacity-90">Valor em Alerta</CardTitle>
            <div className="p-1 bg-white/20 rounded-lg">
              <AlertCircle className="h-3 w-3" />
            </div>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="text-lg font-bold leading-tight">{formatCurrency(financialStats.valorAlerta)}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-rose-600 border-0 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-2">
            <CardTitle className="text-sm font-medium opacity-90">Valor Critico</CardTitle>
            <div className="p-1 bg-white/20 rounded-lg">
              <TrendingUp className="h-3 w-3" />
            </div>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="text-lg font-bold leading-tight">{formatCurrency(financialStats.valorCritico)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Botoes de Alternancia de Modo */}
      {selectedTipoDeposito === 'PES' && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant={viewMode === 'geral' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              onViewModeChange?.('geral');
              onCriticalityChange?.(null);
            }}
          >
            Visao Geral
          </Button>
          <Button
            variant={viewMode === 'ajustes' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              onViewModeChange?.('ajustes');
              onCriticalityChange?.(null);
            }}
          >
            Ajustes (PES/S)
          </Button>
        </div>
      )}

      {/* Graficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Valor por Criticidade</span>
              <Badge variant="outline" className="text-xs font-normal">
                Clique para filtrar
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ReactECharts
              option={getCriticalityPieOption()}
              style={{ height: '250px' }}
              opts={{ renderer: 'svg' }}
              onEvents={{
                click: (params: any) => {
                  const criticality = params.name as 'Normal' | 'Alerta' | 'Crítico';
                  onCriticalityChange?.(selectedCriticality === criticality ? null : criticality);
                },
              }}
            />

            {/* Estatisticas detalhadas */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t">
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
                      className={`p-2 rounded-lg border-2 transition-all cursor-pointer ${
                        selectedCriticality === stat.label
                          ? 'border-current ring-2 ring-offset-2 ring-current'
                          : 'border-gray-200 dark:border-gray-700'
                      } ${stat.textColor}`}
                      onClick={() => onCriticalityChange?.(selectedCriticality === stat.label as any ? null : stat.label as any)}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className={`w-2 h-2 rounded-full ${stat.color}`} />
                        <span className="font-semibold text-xs">{stat.label}</span>
                      </div>
                      <div className="space-y-0.5">
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
          <CardContent className="pt-4">
            {selectedCriticality && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCriticalityChange?.(null)}
                className="absolute top-4 right-4 z-10"
              >
                Limpar Filtro
              </Button>
            )}
            <ReactECharts
              option={getDetailedAnalysisOption()}
              style={{ height: '320px' }}
              opts={{ renderer: 'svg' }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
