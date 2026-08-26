'use client';

import { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { AgingData } from '@/types/aging';
import { LoteInvestigacao } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import {
  Tag,
} from 'lucide-react';

interface OnepageViewProps {
  agingData: AgingData[];
  valores: Record<string, number>;
  lotesInvestigacao: LoteInvestigacao[];
  onInvestigacaoChange: () => void;
  currentUserEmail?: string;
}

export function OnepageView({
  agingData,
  valores,
  lotesInvestigacao,
  onInvestigacaoChange,
  currentUserEmail,
}: OnepageViewProps) {
  // Set de lotes em investigação para busca O(1)
  const lotesInvestigacaoSet = useMemo(() => {
    return new Set(lotesInvestigacao.map((item) => item.lote.trim().toUpperCase()));
  }, [lotesInvestigacao]);

  // Formatação monetária
  const formatCurrency = (val: number) =>
    'R$ ' +
    Number(val || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // ==========================================
  // SEGMENTAÇÃO DAS 3 POSIÇÕES PRINCIPAIS
  // ==========================================

  // 1. PESAGEM: depósito ou tipo_depósito 'PES' ou posição 'PESAGEM'
  const pesagemItems = useMemo(() => {
    return agingData.filter((item) => {
      const pos = item.posicao_deposito?.toUpperCase() || '';
      const tipo = item.tipo_deposito?.toUpperCase() || '';
      const dep = item.deposito?.toUpperCase() || '';
      return pos === 'PESAGEM' || (tipo === 'PES' && pos !== 'AJUSTE' && pos !== 'AJU-SAIDA') || dep === 'PES';
    });
  }, [agingData]);

  // 2. AJUSTE: posição 'AJUSTE'
  const ajusteItems = useMemo(() => {
    return agingData.filter((item) => {
      const pos = item.posicao_deposito?.toUpperCase() || '';
      return pos === 'AJUSTE';
    });
  }, [agingData]);

  // 3. AJU-SAÍDA: posição 'AJU-SAIDA' ou 'AJU-SAÍDA'
  const ajuSaidaItems = useMemo(() => {
    return agingData.filter((item) => {
      const pos = item.posicao_deposito?.toUpperCase() || '';
      return pos === 'AJU-SAIDA' || pos === 'AJU-SAÍDA';
    });
  }, [agingData]);

  // ==========================================
  // CÁLCULO DE ESTATÍSTICAS E TOP 3
  // ==========================================
  const getPositionMetrics = (items: AgingData[]) => {
    const materiaisSet = new Set(items.map((i) => i.material).filter(Boolean));
    const lotesCount = items.length;
    let totalValor = 0;

    items.forEach((item) => {
      const vUnit = valores[item.material] || 0;
      totalValor += (item.estoque_disponivel || 0) * vUnit;
    });

    // Ordenar itens mais antigos pelo dias_aging decrescente
    const sortedByAging = [...items].sort((a, b) => (b.dias_aging || 0) - (a.dias_aging || 0));

    // Agrupar por material para pegar TOP 3 materiais mais antigos com seus dados
    const top3MaterialsMap = new Map<
      string,
      {
        material: string;
        texto: string;
        maxDias: number;
        lotesCount: number;
        valorTotal: number;
      }
    >();

    sortedByAging.forEach((item) => {
      const mat = item.material;
      const vUnit = valores[mat] || 0;
      const itemVal = (item.estoque_disponivel || 0) * vUnit;
      const dias = item.dias_aging || 0;

      if (!top3MaterialsMap.has(mat)) {
        if (top3MaterialsMap.size < 3) {
          top3MaterialsMap.set(mat, {
            material: mat,
            texto: item.texto_breve_material || mat,
            maxDias: dias,
            lotesCount: 1,
            valorTotal: itemVal,
          });
        }
      } else {
        const entry = top3MaterialsMap.get(mat)!;
        entry.lotesCount += 1;
        entry.valorTotal += itemVal;
        if (dias > entry.maxDias) entry.maxDias = dias;
      }
    });

    return {
      materiaisCount: materiaisSet.size,
      lotesCount,
      totalValor,
      top3: Array.from(top3MaterialsMap.values()),
    };
  };

  const pesagemMetrics = useMemo(() => getPositionMetrics(pesagemItems), [pesagemItems, valores]);
  const ajusteMetrics = useMemo(() => getPositionMetrics(ajusteItems), [ajusteItems, valores]);
  const ajuSaidaMetrics = useMemo(() => getPositionMetrics(ajuSaidaItems), [ajuSaidaItems, valores]);

  // ==========================================
  // CLASSIFICAÇÃO DOS LOTES DE AJUSTE (INVESTIGAÇÃO VS CHAMADO)
  // ==========================================
  const { ajusteInvestigacao, ajusteChamado } = useMemo(() => {
    const investigacao: { item: AgingData; valor: number; dias: number }[] = [];
    const chamado: { item: AgingData; valor: number; dias: number }[] = [];

    ajusteItems.forEach((item) => {
      const vUnit = valores[item.material] || 0;
      const valorTotal = (item.estoque_disponivel || 0) * vUnit;
      const dias = item.dias_aging || 0;
      const isInvestigando = lotesInvestigacaoSet.has(item.lote.trim().toUpperCase());

      if (isInvestigando) {
        investigacao.push({ item, valor: valorTotal, dias });
      } else {
        chamado.push({ item, valor: valorTotal, dias });
      }
    });

    return { ajusteInvestigacao: investigacao, ajusteChamado: chamado };
  }, [ajusteItems, valores, lotesInvestigacaoSet]);

  // ==========================================
  // DADOS DOS GRÁFICOS (ECHARTS)
  // ==========================================

  // Gráfico 1: Pesagem por Faixa de Aging
  const chartPesagemOption = useMemo(() => {
    let normalVal = 0;
    let normalLotes = 0;
    let alertaVal = 0;
    let alertaLotes = 0;
    let criticoVal = 0;
    let criticoLotes = 0;

    pesagemItems.forEach((item) => {
      const vUnit = valores[item.material] || 0;
      const vt = (item.estoque_disponivel || 0) * vUnit;
      const dias = item.dias_aging || 0;
      if (dias >= 20) {
        criticoVal += vt;
        criticoLotes++;
      } else if (dias >= 7) {
        alertaVal += vt;
        alertaLotes++;
      } else {
        normalVal += vt;
        normalLotes++;
      }
    });

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => {
          const p = params[0];
          return `<div class="p-1 font-sans text-xs">
            <span class="font-bold text-sky-300">${p.name}</span><br/>
            Posição: <b class="text-white">PESAGEM</b><br/>
            Valor: <b>${formatCurrency(p.value)}</b>
          </div>`;
        },
      },
      grid: { top: 25, right: 15, bottom: 25, left: 65 },
      xAxis: {
        type: 'category',
        data: ['Normal (<7d)', 'Alerta (7–19d)', 'Crítico (≥20d)'],
        axisLine: { lineStyle: { color: '#2A4D6E' } },
        axisLabel: { color: '#608BA6', fontSize: 11, fontWeight: '600' },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#2A4D6E' } },
        axisLabel: {
          color: '#608BA6',
          fontSize: 10,
          formatter: (v: number) => {
            if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
            if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}k`;
            return `R$ ${v}`;
          },
        },
      },
      series: [
        {
          type: 'bar',
          barWidth: '40%',
          data: [
            {
              value: normalVal,
              itemStyle: { color: '#AEE4FF', borderRadius: [6, 6, 0, 0] },
              label: {
                show: normalLotes > 0,
                position: 'inside',
                formatter: `${normalLotes} lotes`,
                color: '#13283E',
                fontSize: 11,
                fontWeight: 'bold',
              },
            },
            {
              value: alertaVal,
              itemStyle: { color: '#E29A36', borderRadius: [6, 6, 0, 0] },
              label: {
                show: alertaLotes > 0,
                position: 'inside',
                formatter: `${alertaLotes} lotes`,
                color: '#13283E',
                fontSize: 11,
                fontWeight: 'bold',
              },
            },
            {
              value: criticoVal,
              itemStyle: { color: '#E75B5B', borderRadius: [6, 6, 0, 0] },
              label: {
                show: criticoLotes > 0,
                position: 'top',
                formatter: `${criticoLotes} lotes`,
                color: '#E75B5B',
                fontSize: 11,
                fontWeight: 'bold',
              },
            },
          ],
        },
      ],
    };
  }, [pesagemItems, valores]);

  // Gráfico 2: Ajuste Stacked Bar (Em Investigação vs Aguardando Próx. Chamado)
  const chartAjusteOption = useMemo(() => {
    // Totais Investigação
    let invNormal = 0;
    let invAlerta = 0;
    let invCritico = 0;
    ajusteInvestigacao.forEach((i) => {
      if (i.dias >= 20) invCritico += i.valor;
      else if (i.dias >= 7) invAlerta += i.valor;
      else invNormal += i.valor;
    });

    // Totais Chamado
    let chaNormal = 0;
    let chaAlerta = 0;
    let chaCritico = 0;
    ajusteChamado.forEach((i) => {
      if (i.dias >= 20) chaCritico += i.valor;
      else if (i.dias >= 7) chaAlerta += i.valor;
      else chaNormal += i.valor;
    });

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => {
          let str = `<div class="p-1 font-sans text-xs"><b class="block mb-1 text-sky-300">${params[0]?.name}</b>`;
          str += `<span class="text-slate-300">Posição: <b class="text-white">AJUSTE</b></span><br/>`;
          let total = 0;
          params.forEach((p) => {
            if (p.value > 0) {
              str += `<span style="display:inline-block;margin-right:4px;border-radius:10px;width:9px;height:9px;background-color:${p.color};"></span> ${p.seriesName}: <b>${formatCurrency(p.value)}</b><br/>`;
              total += p.value;
            }
          });
          str += `<div class="mt-1 pt-1 border-t border-slate-700 font-bold text-white">Total: ${formatCurrency(total)}</div></div>`;
          return str;
        },
      },
      legend: {
        orient: 'horizontal',
        top: 0,
        right: 0,
        textStyle: { color: '#AEE4FF', fontSize: 10 },
        itemWidth: 10,
        itemHeight: 10,
      },
      grid: { top: 35, right: 15, bottom: 25, left: 65 },
      xAxis: {
        type: 'category',
        data: ['Em Investigação', 'Aguardando Próx. Chamado'],
        axisLine: { lineStyle: { color: '#2A4D6E' } },
        axisLabel: { color: '#608BA6', fontSize: 10, fontWeight: '600' },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#2A4D6E' } },
        axisLabel: {
          color: '#608BA6',
          fontSize: 10,
          formatter: (v: number) => {
            if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
            if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}k`;
            return `R$ ${v}`;
          },
        },
      },
      series: [
        {
          name: 'Normal (<7d)',
          type: 'bar',
          stack: 'ajuste',
          barWidth: '40%',
          data: [invNormal, chaNormal],
          itemStyle: { color: '#AEE4FF' },
        },
        {
          name: 'Alerta (7–19d)',
          type: 'bar',
          stack: 'ajuste',
          barWidth: '40%',
          data: [invAlerta, chaAlerta],
          itemStyle: { color: '#E29A36' },
        },
        {
          name: 'Crítico (≥20d)',
          type: 'bar',
          stack: 'ajuste',
          barWidth: '40%',
          data: [invCritico, chaCritico],
          itemStyle: { color: '#E75B5B', borderRadius: [6, 6, 0, 0] },
        },
      ],
    };
  }, [ajusteInvestigacao, ajusteChamado]);

  // Gráfico 3: Top 5 Materiais — AJU-SAÍDA
  const { chartTopMateriaisOption, maiorValorAjuSaida } = useMemo(() => {
    // Agrupar itens de AJU-SAÍDA por material
    const matMap = new Map<
      string,
      {
        material: string;
        texto: string;
        totalValor: number;
        maxDias: number;
      }
    >();

    ajuSaidaItems.forEach((item) => {
      const vUnit = valores[item.material] || 0;
      const vt = (item.estoque_disponivel || 0) * vUnit;
      const dias = item.dias_aging || 0;
      const mat = item.material;

      if (!matMap.has(mat)) {
        matMap.set(mat, {
          material: mat,
          texto: item.texto_breve_material || mat,
          totalValor: vt,
          maxDias: dias,
        });
      } else {
        const obj = matMap.get(mat)!;
        obj.totalValor += vt;
        if (dias > obj.maxDias) obj.maxDias = dias;
      }
    });

    const sorted = Array.from(matMap.values())
      .sort((a, b) => b.totalValor - a.totalValor)
      .slice(0, 5)
      .reverse(); // reverter para o topo ficar em cima no horizontal bar

    const maiorValor = sorted.length > 0 ? Math.max(...sorted.map((s) => s.totalValor)) : 0;

    const names = sorted.map((s) => (s.texto.length > 22 ? s.texto.substring(0, 20) + '...' : s.texto));
    const values = sorted.map((s) => ({
      value: s.totalValor,
      itemStyle: {
        color: s.maxDias >= 20 ? '#E75B5B' : s.maxDias >= 7 ? '#E29A36' : '#AEE4FF',
        borderRadius: [0, 4, 4, 0],
      },
      materialCode: s.material,
      materialName: s.texto,
      dias: s.maxDias,
      posicao: 'AJU-SAIDA',
    }));

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => {
          return `<div class="p-1 font-sans text-xs">
            <b class="block mb-1 text-sky-300">${p.data.materialCode} - ${p.data.materialName}</b>
            Posição: <b class="text-white">${p.data.posicao}</b><br/>
            Valor Total: <b>${formatCurrency(p.value)}</b><br/>
            Aging Máximo: <b>${p.data.dias} dias</b>
          </div>`;
        },
      },
      grid: { top: 15, right: 25, bottom: 25, left: 140 },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#2A4D6E' } },
        axisLabel: {
          color: '#608BA6',
          fontSize: 10,
          formatter: (v: number) => {
            if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}k`;
            return `R$ ${v}`;
          },
        },
      },
      yAxis: {
        type: 'category',
        data: names,
        axisLine: { lineStyle: { color: '#2A4D6E' } },
        axisLabel: { color: '#608BA6', fontSize: 10, fontWeight: '600' },
      },
      series: [
        {
          type: 'bar',
          barWidth: '45%',
          data: values,
        },
      ],
    };

    return { chartTopMateriaisOption: option, maiorValorAjuSaida: maiorValor };
  }, [ajuSaidaItems, valores]);

  return (
    <div className="space-y-5">
      {/* Header com estilo elegante */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-ems-card border border-ems-border rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="flex items-center gap-4">
          <img
            src="https://izishared.blob.core.windows.net/assets/grupo-ems-lp/grupoems-logo.png"
            alt="Grupo EMS"
            className="h-10 sm:h-12 w-auto object-contain brightness-0 invert opacity-95 shrink-0"
          />
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-wide text-ems-ice uppercase">
              Controle de Estoque - Pesagem - Manaus
            </h2>
            <p className="text-xs text-ems-steel">
              Visão consolidada do estoque PES.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold text-ems-steel bg-ems-navy px-3.5 py-1.5 rounded-lg border border-ems-border shadow-inner">
            Base: <span className="text-ems-ice font-medium">Último Movimento</span>
          </div>
        </div>
      </div>

      {/* TOP KPI GRID - 3 Cards Principais */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card: PESAGEM */}
        <div className="bg-ems-card border border-ems-border rounded-xl p-5 shadow-lg flex flex-col justify-between hover:border-ems-steel transition duration-200">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ems-ice flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-ems-ice"></span>
                Posição: PESAGEM
              </h3>
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-ems-ice/10 text-ems-ice border-ems-ice/20">
                Ativa
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 pb-4 border-b border-ems-border">
              <div>
                <p className="text-[10px] uppercase font-bold text-ems-steel tracking-wider mb-1">Materiais</p>
                <p className="text-2xl font-black text-white font-mono">{pesagemMetrics.materiaisCount}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-ems-steel tracking-wider mb-1">Lotes</p>
                <p className="text-2xl font-black text-white font-mono">{pesagemMetrics.lotesCount}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-ems-steel tracking-wider mb-1">Valor Avaliado</p>
                <p className="text-lg font-black text-ems-ice truncate" title={formatCurrency(pesagemMetrics.totalValor)}>
                  {formatCurrency(pesagemMetrics.totalValor)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ems-steel mb-2.5">
              TOP 3 Mais Antigos
            </p>
            {pesagemMetrics.top3.length === 0 ? (
              <p className="text-xs text-ems-steel italic">Nenhum registro encontrado</p>
            ) : (
              <ul className="space-y-2.5 text-xs">
                {pesagemMetrics.top3.map((item, idx) => {
                  const statusColor =
                    item.maxDias >= 20 ? 'bg-ems-critico text-ems-critico' : item.maxDias >= 7 ? 'bg-ems-alerta text-ems-alerta' : 'bg-ems-ice text-ems-ice';
                  return (
                    <li key={idx} className="grid grid-cols-12 items-center gap-1.5 py-0.5">
                      <div className="col-span-6 flex items-center gap-1.5 min-w-0">
                        <span className={`h-2 w-2 rounded-full ${statusColor.split(' ')[0]} shrink-0`}></span>
                        <span className="truncate font-medium text-slate-200 text-xs" title={item.texto}>
                          {item.texto}
                        </span>
                      </div>
                      <div className={`col-span-3 text-center font-semibold text-[11px] ${statusColor.split(' ')[1]}`}>
                        {item.maxDias}d <span className="text-ems-steel font-normal text-[10px]">{item.lotesCount} {item.lotesCount > 1 ? 'lotes' : 'lote'}</span>
                      </div>
                      <div className="col-span-3 text-right font-bold text-slate-100 text-[11px] font-mono">
                        {formatCurrency(item.valorTotal)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Card: AJUSTE */}
        <div className="bg-ems-card border border-ems-border rounded-xl p-5 shadow-lg flex flex-col justify-between hover:border-ems-steel transition duration-200">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ems-ice flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-ems-alerta"></span>
                Posição: AJUSTE
              </h3>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-ems-alerta/10 text-ems-alerta border-ems-alerta/20">
                  {ajusteInvestigacao.length} Inv.
                </Badge>
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-ems-ice/10 text-ems-ice border-ems-ice/20">
                  {ajusteChamado.length} Cham.
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pb-4 border-b border-ems-border">
              <div>
                <p className="text-[10px] uppercase font-bold text-ems-steel tracking-wider mb-1">Materiais</p>
                <p className="text-2xl font-black text-white font-mono">{ajusteMetrics.materiaisCount}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-ems-steel tracking-wider mb-1">Lotes</p>
                <p className="text-2xl font-black text-white font-mono">{ajusteMetrics.lotesCount}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-ems-steel tracking-wider mb-1">Valor Avaliado</p>
                <p className="text-lg font-black text-ems-ice truncate" title={formatCurrency(ajusteMetrics.totalValor)}>
                  {formatCurrency(ajusteMetrics.totalValor)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ems-steel mb-2.5">
              TOP 3 Mais Antigos
            </p>
            {ajusteMetrics.top3.length === 0 ? (
              <p className="text-xs text-ems-steel italic">Nenhum registro encontrado</p>
            ) : (
              <ul className="space-y-2.5 text-xs">
                {ajusteMetrics.top3.map((item, idx) => {
                  const statusColor =
                    item.maxDias >= 20 ? 'bg-ems-critico text-ems-critico' : item.maxDias >= 7 ? 'bg-ems-alerta text-ems-alerta' : 'bg-ems-ice text-ems-ice';
                  return (
                    <li key={idx} className="grid grid-cols-12 items-center gap-1.5 py-0.5">
                      <div className="col-span-6 flex items-center gap-1.5 min-w-0">
                        <span className={`h-2 w-2 rounded-full ${statusColor.split(' ')[0]} shrink-0`}></span>
                        <span className="truncate font-medium text-slate-200 text-xs" title={item.texto}>
                          {item.texto}
                        </span>
                      </div>
                      <div className={`col-span-3 text-center font-semibold text-[11px] ${statusColor.split(' ')[1]}`}>
                        {item.maxDias}d <span className="text-ems-steel font-normal text-[10px]">{item.lotesCount} {item.lotesCount > 1 ? 'lotes' : 'lote'}</span>
                      </div>
                      <div className="col-span-3 text-right font-bold text-slate-100 text-[11px] font-mono">
                        {formatCurrency(item.valorTotal)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Card: AJU-SAÍDA */}
        <div className="bg-ems-card border border-ems-border rounded-xl p-5 shadow-lg flex flex-col justify-between hover:border-ems-steel transition duration-200">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ems-ice flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-ems-ice"></span>
                Posição: AJU-SAÍDA
              </h3>
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-ems-ice/10 text-ems-ice border-ems-ice/20">
                Saída
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 pb-4 border-b border-ems-border">
              <div>
                <p className="text-[10px] uppercase font-bold text-ems-steel tracking-wider mb-1">Materiais</p>
                <p className="text-2xl font-black text-white font-mono">{ajuSaidaMetrics.materiaisCount}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-ems-steel tracking-wider mb-1">Lotes</p>
                <p className="text-2xl font-black text-white font-mono">{ajuSaidaMetrics.lotesCount}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-ems-steel tracking-wider mb-1">Valor Avaliado</p>
                <p className="text-lg font-black text-ems-ice truncate" title={formatCurrency(ajuSaidaMetrics.totalValor)}>
                  {formatCurrency(ajuSaidaMetrics.totalValor)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ems-steel mb-2.5">
              TOP 3 Mais Antigos
            </p>
            {ajuSaidaMetrics.top3.length === 0 ? (
              <p className="text-xs text-ems-steel italic">Nenhum registro encontrado</p>
            ) : (
              <ul className="space-y-2.5 text-xs">
                {ajuSaidaMetrics.top3.map((item, idx) => {
                  const statusColor =
                    item.maxDias >= 20 ? 'bg-ems-critico text-ems-critico' : item.maxDias >= 7 ? 'bg-ems-alerta text-ems-alerta' : 'bg-ems-ice text-ems-ice';
                  return (
                    <li key={idx} className="grid grid-cols-12 items-center gap-1.5 py-0.5">
                      <div className="col-span-6 flex items-center gap-1.5 min-w-0">
                        <span className={`h-2 w-2 rounded-full ${statusColor.split(' ')[0]} shrink-0`}></span>
                        <span className="truncate font-medium text-slate-200 text-xs" title={item.texto}>
                          {item.texto}
                        </span>
                      </div>
                      <div className={`col-span-3 text-center font-semibold text-[11px] ${statusColor.split(' ')[1]}`}>
                        {item.maxDias}d <span className="text-ems-steel font-normal text-[10px]">{item.lotesCount} {item.lotesCount > 1 ? 'lotes' : 'lote'}</span>
                      </div>
                      <div className="col-span-3 text-right font-bold text-slate-100 text-[11px] font-mono">
                        {formatCurrency(item.valorTotal)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="border-t border-ems-border pt-4 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-ems-ice">
          VALOR TOTAL POR STATUS DE AGING & POSIÇÃO
        </h3>
        <span className="text-[11px] text-ems-steel">
          Normal (&lt;7d) • Alerta (7-19d) • Crítico (≥20d)
        </span>
      </div>

      {/* BOTTOM ANALYTICS GRID - 3 Gráficos alinhados */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Chart 1: Pesagem */}
        <div className="bg-ems-card border border-ems-border rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase text-ems-ice">PESAGEM</h4>
            <p className="text-[11px] text-ems-steel mb-4">Total por status • nº de lotes dentro da barra</p>
          </div>
          <div className="relative h-64 w-full">
            <ReactECharts option={chartPesagemOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* Chart 2: Ajuste Stacked */}
        <div className="bg-ems-card border border-ems-border rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase text-ems-ice">AJUSTE - Investigação vs Chamado</h4>
            <p className="text-[11px] text-ems-steel mb-4">Base: Último Movimento | Valor por status de aging</p>
          </div>
          <div className="relative h-64 w-full">
            <ReactECharts option={chartAjusteOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* Chart 3: Top 5 Materiais AJU-SAÍDA */}
        <div className="bg-ems-card border border-ems-border rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase text-ems-ice">Top 5 Materiais — AJU-SAÍDA</h4>
            <p className="text-[11px] text-ems-steel mb-4">Por valor imobilizado • cor = status de aging</p>
          </div>
          <div className="relative h-64 w-full">
            <ReactECharts option={chartTopMateriaisOption} style={{ height: '100%', width: '100%' }} />
          </div>
          <div className="mt-2 text-right">
            <span className="text-xs font-bold text-ems-ice">
              Maior valor: {formatCurrency(maiorValorAjuSaida)}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
