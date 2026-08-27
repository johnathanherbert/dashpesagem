'use client';

import { useMemo, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { AgingData } from '@/types/aging';
import { DashboardSnapshot } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  RefreshCw,
  ArrowUpRight,
  Minus,
  X,
} from 'lucide-react';

function TrendBadge({
  current,
  previous,
  lowerIsBetter = true,
}: {
  current: number;
  previous: number | null | undefined;
  lowerIsBetter?: boolean;
}) {
  if (previous === null || previous === undefined || previous === 0) return null;
  const delta = current - previous;
  const pct = Math.abs((delta / previous) * 100);
  if (pct < 0.5) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-white/60">
        <Minus className="h-2.5 w-2.5" /> estável
      </span>
    );
  }
  const isUp = delta > 0;
  const isGood = lowerIsBetter ? !isUp : isUp;
  const color = isGood ? 'text-green-200' : 'text-red-200';
  const label = pct >= 100
    ? `${Math.abs(Math.round(delta / 1000))}k`
    : `${pct.toFixed(1)}%`;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold ${color}`}>
      {isUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {label}
    </span>
  );
}

interface AgingFinancialProps {
  data: AgingData[];
  allData?: AgingData[];
  valores: Record<string, number>;
  selectedTipoDeposito?: string;
  selectedMaterialEspecial?: 'inf' | 'cfa' | null;
  selectedCriticality?: string | null;
  onCriticalityChange?: (value: string | null) => void;
  selectedMaterial?: string;
  onMaterialChange?: (value: string | undefined) => void;
  viewMode?: 'geral' | 'ajustes';
  onViewModeChange?: (value: 'geral' | 'ajustes') => void;
  previousSnapshot?: DashboardSnapshot | null;
}

export function AgingFinancial({
  data,
  allData,
  valores,
  selectedTipoDeposito = 'all',
  selectedMaterialEspecial = null,
  selectedCriticality = null,
  onCriticalityChange,
  selectedMaterial,
  onMaterialChange,
  viewMode = 'geral',
  onViewModeChange,
  previousSnapshot = null,
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
        if (dias >= 20) {
          valorCritico += valorTotal;
        } else if (dias >= 7) {
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
    };
  }, [filteredDataByMode, valores]);

  const depositoStats = useMemo(() => {
    let valorAjuste = 0;
    let itensAjuste = 0;
    let valorAjuSaida = 0;
    let itensAjuSaida = 0;

    const source = allData ?? data;

    source.forEach(item => {
      const valor = valores[item.material];
      if (!valor) return;
      if (item.tipo_deposito !== '999') return;

      const posicao = item.posicao_deposito?.toUpperCase() ?? '';
      const valorTotal = (item.estoque_disponivel || 0) * valor;

      if (posicao === 'AJUSTE') {
        valorAjuste += valorTotal;
        itensAjuste++;
      } else if (posicao === 'AJU-SAIDA') {
        valorAjuSaida += valorTotal;
        itensAjuSaida++;
      }
    });

    return { valorAjuste, itensAjuste, valorAjuSaida, itensAjuSaida };
  }, [allData, data, valores]);

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
          if (dias < 7) valorNormal += valorTotal;
          else if (dias < 20) valorAlerta += valorTotal;
          else valorCritico += valorTotal;

          return {
            material: item.material,
            descricao: item.texto_breve_material,
            lote: item.lote,
            tipo_deposito: item.tipo_deposito,
            posicao_deposito: item.posicao_deposito,
            peso: item.estoque_disponivel,
            unidade: item.unidade_medida,
            dias: item.dias_aging,
            valorUnitario: valor,
            valorTotal,
            criticidade: dias >= 20 ? 'Crítico' : dias >= 7 ? 'Alerta' : 'Normal',
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
        itemStyle: { color: '#AEE4FF' },
        lotes: normalLotes,
        materiais: normalMaterials.length,
      },
      {
        name: 'Alerta',
        value: financialByTipo.reduce((sum, t) => sum + t.valorAlerta, 0),
        itemStyle: { color: '#E29A36' },
        lotes: alertaLotes,
        materiais: alertaMaterials.length,
      },
      {
        name: 'Crítico',
        value: financialByTipo.reduce((sum, t) => sum + t.valorCritico, 0),
        itemStyle: { color: '#E75B5B' },
        lotes: criticoLotes,
        materiais: criticoMaterials.length,
      },
    ];

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#13283E',
        borderColor: '#2A4D6E',
        borderRadius: 8,
        padding: 12,
        formatter: (params: any) => {
          const fullName = params.name === 'Normal' ? 'Normal (< 7 dias)' :
                          params.name === 'Alerta' ? 'Alerta (7-19 dias)' :
                          'Crítico (≥ 20 dias)';
          const dataItem = chartData.find(d => d.name === params.name);
          return `<strong style="color: #AEE4FF;">${fullName}</strong><br/>
                  <strong style="color: #fff;">${formatCurrency(params.value)}</strong>
                  <span style="color: #608BA6;">(${params.percent}%)</span><br/>
                  <span style="color: #608BA6;">${dataItem?.materiais || 0} materiais em ${dataItem?.lotes || 0} lotes</span>`;
        },
      },
      legend: {
        bottom: 5,
        textStyle: { color: '#608BA6', fontSize: 10 },
        formatter: (name: string) => {
          const dataItem = chartData.find(d => d.name === name);
          const label = name === 'Normal' ? 'Normal (< 7d)' :
                        name === 'Alerta' ? 'Alerta (7-19d)' :
                        'Crítico (≥ 20d)';
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
            label: { show: true, fontSize: 12, fontWeight: 'bold', color: '#AEE4FF' },
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
          textStyle: { fontSize: 14, color: '#AEE4FF', fontWeight: 'bold' },
          subtext: selectedMaterial
            ? `Filtrando por material: ${selectedMaterial} (clique para remover)`
            : 'Clique em um material para filtrar a tabela abaixo',
          subtextStyle: { fontSize: 11, color: selectedMaterial ? '#38bdf8' : '#608BA6' },
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#13283E',
          borderColor: '#2A4D6E',
          borderRadius: 8,
          padding: 12,
          formatter: (params: any) => {
            const item = topMaterials[params[0].dataIndex];
            const qtdStr = Number(item?.peso || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return `<strong style="color: #AEE4FF;">${item?.material}</strong><br/>
                    <span style="color: #cbd5e1;">${item?.descricao?.substring(0, 40)}...</span><br/>
                    <strong style="color: #4ade80;">Valor Total: ${formatCurrency(item?.valorTotal || 0)}</strong><br/>
                    <span style="color: #608BA6;">Estoque: ${qtdStr} ${item?.unidade || 'kg'}</span><br/>
                    <span style="color: #608BA6;">Posição: <strong style="color: #AEE4FF;">${item?.posicao_deposito || 'N/A'}</strong> · Lote: ${item?.lote || 'N/A'}</span><br/>
                    <span style="color: #608BA6;">Aging: ${item?.dias} dias · ${item?.tipo_deposito}</span>`;
          },
        },
        grid: { bottom: 80 },
        xAxis: {
          type: 'category',
          data: topMaterials.map(m => m?.material),
          axisLine: { lineStyle: { color: '#2A4D6E' } },
          axisLabel: { rotate: 45, fontSize: 10, color: '#608BA6' },
        },
        yAxis: {
          type: 'value',
          name: 'Valor (R$)',
          nameTextStyle: { color: '#608BA6' },
          axisLine: { show: false },
          splitLine: { lineStyle: { color: '#2A4D6E' } },
          axisLabel: { color: '#608BA6', formatter: (value: number) => formatCurrency(value) },
        },
        series: [
          {
            type: 'bar',
            data: topMaterials.map(m => {
              const isSelected = selectedMaterial === m?.material;
              return {
                value: m?.valorTotal,
                material: m?.material,
                itemStyle: {
                  color: isSelected
                    ? '#38bdf8'
                    : m?.criticidade === 'Crítico'
                    ? '#E75B5B'
                    : m?.criticidade === 'Alerta'
                    ? '#E29A36'
                    : '#AEE4FF',
                  borderRadius: [4, 4, 0, 0],
                  borderWidth: isSelected ? 2 : 0,
                  borderColor: '#ffffff',
                },
              };
            }),
          },
        ],
      };
    }

    const filteredMaterials = allMaterials
      .filter(m => m?.criticidade === selectedCriticality)
      .sort((a, b) => (b?.valorTotal || 0) - (a?.valorTotal || 0))
      .slice(0, 15);

    const chartColor = selectedCriticality === 'Crítico' ? '#E75B5B' :
                       selectedCriticality === 'Alerta' ? '#E29A36' : '#AEE4FF';

    const criticalityLabel = selectedCriticality === 'Normal' ? '< 7 dias' :
                            selectedCriticality === 'Alerta' ? '7-19 dias' : '≥ 20 dias';

    const totalValue = filteredMaterials.reduce((s, m) => s + (m?.valorTotal || 0), 0);

    return {
      title: {
        text: `Top 15 Materiais: ${selectedCriticality}`,
        left: 'center',
        textStyle: { fontSize: 14, color: '#AEE4FF', fontWeight: 'bold' },
        subtext: selectedMaterial
          ? `Filtrando por material: ${selectedMaterial} (clique para remover)`
          : `${criticalityLabel} · ${formatCurrency(totalValue)}`,
        subtextStyle: { fontSize: 11, color: selectedMaterial ? '#38bdf8' : '#608BA6' },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#13283E',
        borderColor: '#2A4D6E',
        borderRadius: 8,
        padding: 12,
        formatter: (params: any) => {
          const item = filteredMaterials[params[0].dataIndex];
          const qtdStr = Number(item?.peso || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          return `<strong style="color: #AEE4FF;">${item?.material}</strong><br/>
                  <span style="color: #cbd5e1;">${item?.descricao?.substring(0, 40)}...</span><br/>
                  <strong style="color: #4ade80;">Valor Total: ${formatCurrency(item?.valorTotal || 0)}</strong><br/>
                  <span style="color: #608BA6;">Estoque: ${qtdStr} ${item?.unidade || 'kg'}</span><br/>
                  <span style="color: #608BA6;">Posição: <strong style="color: #AEE4FF;">${item?.posicao_deposito || 'N/A'}</strong> · Lote: ${item?.lote || 'N/A'}</span><br/>
                  <span style="color: #608BA6;">Aging: ${item?.dias} dias · ${item?.tipo_deposito}</span>`;
        },
      },
      grid: { bottom: 80 },
      xAxis: {
        type: 'category',
        data: filteredMaterials.map(m => m?.material),
        axisLine: { lineStyle: { color: '#2A4D6E' } },
        axisLabel: { rotate: 45, fontSize: 9, interval: 0, color: '#608BA6' },
      },
      yAxis: {
        type: 'value',
        name: 'Valor (R$)',
        nameTextStyle: { color: '#608BA6' },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#2A4D6E' } },
        axisLabel: { color: '#608BA6', formatter: (value: number) => formatCurrency(value) },
      },
      series: [
        {
          type: 'bar',
          data: filteredMaterials.map(m => {
            const isSelected = selectedMaterial === m?.material;
            return {
              value: m?.valorTotal,
              material: m?.material,
              itemStyle: {
                color: isSelected ? '#38bdf8' : chartColor,
                borderRadius: [4, 4, 0, 0],
                borderWidth: isSelected ? 2 : 0,
                borderColor: '#ffffff',
              },
            };
          }),
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="bg-ems-card border border-ems-border text-white shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-2.5 px-3">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-ems-ice">Valor Total</CardTitle>
            <div className="p-1.5 bg-ems-navy rounded-lg border border-ems-border text-ems-ice">
              <DollarSign className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="pb-2.5 px-3">
            <div className="text-lg font-black text-white font-mono leading-tight">{formatCurrency(financialStats.totalValorizado)}</div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-ems-steel">
                {financialStats.itensComValor} de {financialStats.totalItens} valorados
              </p>
              <TrendBadge current={financialStats.totalValorizado} previous={previousSnapshot?.total_valorizado} lowerIsBetter={false} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-ems-card border border-ems-border text-white shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-2.5 px-3">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-ems-ice">Valorização AJUSTE</CardTitle>
            <div className="p-1.5 bg-ems-navy rounded-lg border border-ems-border text-ems-alerta">
              <RefreshCw className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="pb-2.5 px-3">
            <div className="text-lg font-black text-ems-ice font-mono leading-tight">{formatCurrency(depositoStats.valorAjuste)}</div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-ems-steel">
                {depositoStats.itensAjuste} iten{depositoStats.itensAjuste !== 1 ? 's' : ''} valorado{depositoStats.itensAjuste !== 1 ? 's' : ''}
              </p>
              <TrendBadge current={depositoStats.valorAjuste} previous={previousSnapshot?.valor_ajuste} lowerIsBetter={true} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-ems-card border border-ems-border text-white shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-2.5 px-3">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-ems-ice">Valorização AJU-SAIDA</CardTitle>
            <div className="p-1.5 bg-ems-navy rounded-lg border border-ems-border text-ems-ice">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="pb-2.5 px-3">
            <div className="text-lg font-black text-ems-ice font-mono leading-tight">{formatCurrency(depositoStats.valorAjuSaida)}</div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-ems-steel">
                {depositoStats.itensAjuSaida} iten{depositoStats.itensAjuSaida !== 1 ? 's' : ''} valorado{depositoStats.itensAjuSaida !== 1 ? 's' : ''}
              </p>
              <TrendBadge current={depositoStats.valorAjuSaida} previous={previousSnapshot?.valor_aju_saida} lowerIsBetter={true} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-ems-card border border-ems-border text-white shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-2.5 px-3">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-ems-alerta">Valor em Alerta</CardTitle>
            <div className="p-1.5 bg-ems-navy rounded-lg border border-ems-border text-ems-alerta">
              <AlertCircle className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="pb-2.5 px-3">
            <div className="text-lg font-black text-ems-alerta font-mono leading-tight">{formatCurrency(financialStats.valorAlerta)}</div>
            <div className="mt-1">
              <TrendBadge current={financialStats.valorAlerta} previous={previousSnapshot?.valor_alerta} lowerIsBetter={true} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-ems-card border border-ems-border text-white shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-2.5 px-3">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-ems-critico">Valor Crítico</CardTitle>
            <div className="p-1.5 bg-ems-navy rounded-lg border border-ems-border text-ems-critico">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="pb-2.5 px-3">
            <div className="text-lg font-black text-ems-critico font-mono leading-tight">{formatCurrency(financialStats.valorCritico)}</div>
            <div className="mt-1">
              <TrendBadge current={financialStats.valorCritico} previous={previousSnapshot?.valor_critico} lowerIsBetter={true} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="bg-ems-card border border-ems-border shadow-lg cursor-pointer hover:border-ems-steel transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between text-ems-ice">
              <span className="font-bold">Valor por Criticidade</span>
              <Badge variant="outline" className="text-xs font-normal bg-ems-navy text-ems-steel border-ems-border">
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
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-ems-border">
              {(() => {
                const allMaterials = financialByTipo.flatMap(t => t.materiaisAll);
                const stats = [
                  {
                    label: 'Normal',
                    color: 'bg-ems-ice',
                    textColor: 'text-ems-ice',
                    materials: allMaterials.filter(m => m?.criticidade === 'Normal'),
                  },
                  {
                    label: 'Alerta',
                    color: 'bg-ems-alerta',
                    textColor: 'text-ems-alerta',
                    materials: allMaterials.filter(m => m?.criticidade === 'Alerta'),
                  },
                  {
                    label: 'Crítico',
                    color: 'bg-ems-critico',
                    textColor: 'text-ems-critico',
                    materials: allMaterials.filter(m => m?.criticidade === 'Crítico'),
                  },
                ];

                return stats.map(stat => {
                  const lotes = new Set(stat.materials.map(m => m?.lote)).size;
                  const materiais = stat.materials.length;

                  return (
                    <div
                      key={stat.label}
                      className={`p-2 rounded-lg border transition-all cursor-pointer bg-ems-navy/70 ${
                        selectedCriticality === stat.label
                          ? 'border-ems-ice ring-1 ring-ems-ice shadow-md'
                          : 'border-ems-border hover:border-ems-steel'
                      } ${stat.textColor}`}
                      onClick={() => onCriticalityChange?.(selectedCriticality === stat.label as any ? null : stat.label as any)}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className={`w-2 h-2 rounded-full ${stat.color}`} />
                        <span className="font-semibold text-xs">{stat.label}</span>
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-ems-steel">Materiais:</span>
                          <span className="font-bold text-white font-mono">{materiais}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-ems-steel">Lotes:</span>
                          <span className="font-bold text-white font-mono">{lotes}</span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-ems-card border border-ems-border shadow-lg relative">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 absolute top-4 right-4 z-10">
              {selectedMaterial && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onMaterialChange?.(undefined)}
                  className="bg-ems-navy border-ems-border text-sky-300 hover:bg-ems-card hover:text-white text-xs h-7 gap-1 shadow-xs"
                  title="Limpar filtro de material"
                >
                  <span>Mat: {selectedMaterial}</span>
                  <X className="h-3 w-3" />
                </Button>
              )}
              {selectedCriticality && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCriticalityChange?.(null)}
                  className="bg-ems-navy border-ems-border text-ems-ice hover:bg-ems-card hover:text-white text-xs h-7 shadow-xs"
                >
                  Limpar Criticidade
                </Button>
              )}
            </div>
            <ReactECharts
              option={getDetailedAnalysisOption()}
              style={{ height: '320px' }}
              opts={{ renderer: 'svg' }}
              onEvents={{
                click: (params: any) => {
                  const materialCode = params.name || params.data?.material;
                  if (materialCode) {
                    onMaterialChange?.(selectedMaterial === materialCode ? undefined : materialCode);
                  }
                },
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
