'use client';

import { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { AgingData } from '@/types/aging';
import { LoteInvestigacao, addLoteInvestigacao, removeLoteInvestigacao } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Plus,
  Trash2,
  FileSpreadsheet,
  Clock,
  Layers,
  DollarSign,
  ShieldCheck,
  SearchCode,
  Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';

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
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [selectedLoteToAdd, setSelectedLoteToAdd] = useState<AgingData | null>(null);
  const [motivoInput, setMotivoInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
            <span class="font-bold">${p.name}</span><br/>
            Valor: <b>${formatCurrency(p.value)}</b>
          </div>`;
        },
      },
      grid: { top: 25, right: 15, bottom: 25, left: 65 },
      xAxis: {
        type: 'category',
        data: ['Normal (<7d)', 'Alerta (7–19d)', 'Crítico (≥20d)'],
        axisLine: { lineStyle: { color: 'var(--border)' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.1)' } },
        axisLabel: {
          color: '#94a3b8',
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
              itemStyle: { color: '#0ea5e9', borderRadius: [4, 4, 0, 0] },
              label: {
                show: normalLotes > 0,
                position: 'inside',
                formatter: `${normalLotes} lotes`,
                color: '#fff',
                fontSize: 11,
                fontWeight: 'bold',
              },
            },
            {
              value: alertaVal,
              itemStyle: { color: '#f59e0b', borderRadius: [4, 4, 0, 0] },
              label: {
                show: alertaLotes > 0,
                position: 'inside',
                formatter: `${alertaLotes} lotes`,
                color: '#fff',
                fontSize: 11,
                fontWeight: 'bold',
              },
            },
            {
              value: criticoVal,
              itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] },
              label: {
                show: criticoLotes > 0,
                position: 'top',
                formatter: `${criticoLotes} lotes`,
                color: '#ef4444',
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
          let str = `<div class="p-1 font-sans text-xs"><b class="block mb-1">${params[0]?.name}</b>`;
          let total = 0;
          params.forEach((p) => {
            if (p.value > 0) {
              str += `<span style="display:inline-block;margin-right:4px;border-radius:10px;width:9px;height:9px;background-color:${p.color};"></span> ${p.seriesName}: <b>${formatCurrency(p.value)}</b><br/>`;
              total += p.value;
            }
          });
          str += `<div class="mt-1 pt-1 border-t border-slate-700 font-bold">Total: ${formatCurrency(total)}</div></div>`;
          return str;
        },
      },
      legend: {
        orient: 'horizontal',
        top: 0,
        right: 0,
        textStyle: { color: '#94a3b8', fontSize: 11 },
        itemWidth: 12,
        itemHeight: 10,
      },
      grid: { top: 35, right: 15, bottom: 25, left: 65 },
      xAxis: {
        type: 'category',
        data: ['Em Investigação', 'Aguardando Próx. Chamado'],
        axisLine: { lineStyle: { color: 'var(--border)' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.1)' } },
        axisLabel: {
          color: '#94a3b8',
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
          stack: 'total',
          barWidth: '40%',
          itemStyle: { color: '#0ea5e9' },
          data: [invNormal, chaNormal],
        },
        {
          name: 'Alerta (7-19d)',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#f59e0b' },
          data: [invAlerta, chaAlerta],
        },
        {
          name: 'Crítico (≥20d)',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#ef4444' },
          data: [invCritico, chaCritico],
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
        color: s.maxDias >= 20 ? '#ef4444' : s.maxDias >= 7 ? '#f59e0b' : '#0ea5e9',
        borderRadius: [0, 4, 4, 0],
      },
      materialName: s.texto,
      dias: s.maxDias,
    }));

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => {
          return `<div class="p-1 font-sans text-xs">
            <b class="block mb-1">${p.data.materialName}</b>
            Valor: <b>${formatCurrency(p.value)}</b><br/>
            Aging Máximo: <b>${p.data.dias} dias</b>
          </div>`;
        },
      },
      grid: { top: 15, right: 25, bottom: 25, left: 140 },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.1)' } },
        axisLabel: {
          color: '#94a3b8',
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
        axisLine: { lineStyle: { color: 'var(--border)' } },
        axisLabel: { color: '#94a3b8', fontSize: 10 },
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

  // ==========================================
  // GERENCIAMENTO DE INVESTIGAÇÃO (MODAL)
  // ==========================================
  const filteredAjusteForModal = useMemo(() => {
    return ajusteItems.filter((item) => {
      const q = modalSearch.toLowerCase();
      return (
        item.lote.toLowerCase().includes(q) ||
        item.material.toLowerCase().includes(q) ||
        (item.texto_breve_material && item.texto_breve_material.toLowerCase().includes(q))
      );
    });
  }, [ajusteItems, modalSearch]);

  const handleToggleInvestigacao = async (lote: string, material?: string) => {
    const isCurrentlyIn = lotesInvestigacaoSet.has(lote.trim().toUpperCase());
    setIsSubmitting(true);

    try {
      if (isCurrentlyIn) {
        const ok = await removeLoteInvestigacao(lote);
        if (ok) {
          toast.success(`Lote ${lote} removido de Investigação`);
          onInvestigacaoChange();
        } else {
          toast.error('Erro ao remover lote');
        }
      } else {
        const ok = await addLoteInvestigacao({
          lote,
          material,
          motivo: motivoInput || 'Lote sob investigação de estoque',
          created_by: currentUserEmail || 'user',
        });
        if (ok) {
          toast.success(`Lote ${lote} classificado como Em Investigação`);
          setSelectedLoteToAdd(null);
          setMotivoInput('');
          onInvestigacaoChange();
        } else {
          toast.error('Erro ao salvar lote');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header com estilo elegante e botão discreto */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border border-border/80 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black border border-primary/20">
            EMS
          </div>
          <div>
            <h2 className="text-base font-black tracking-wide text-foreground uppercase">
              Controle de Estoque & Posições (Onepage)
            </h2>
            <p className="text-xs text-muted-foreground">
              Visão consolidada de Pesagem, Ajuste e Aju-Saída baseada em aging do último movimento
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão discreto para gerenciar investigação */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalOpen(true)}
            className="h-8 text-xs font-semibold gap-1.5 border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
            title="Gerenciar lotes marcados em investigação"
          >
            <SearchCode className="h-3.5 w-3.5" />
            <span>Investigação ({lotesInvestigacao.length})</span>
          </Button>

          <div className="text-[11px] font-semibold text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-lg border border-border/50">
            Base: <span className="text-foreground">Último Movimento</span>
          </div>
        </div>
      </div>

      {/* TOP KPI GRID - 3 Cards Principais */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card: PESAGEM */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-500"></span>
                Posição: PESAGEM
              </h3>
              <Badge variant="outline" className="text-[10px] bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20">
                Ativa
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 pb-4 border-b border-border">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Materiais</p>
                <p className="text-xl font-black text-foreground">{pesagemMetrics.materiaisCount}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Lotes</p>
                <p className="text-xl font-black text-foreground">{pesagemMetrics.lotesCount}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Valor Avaliado</p>
                <p className="text-sm font-black text-sky-600 dark:text-sky-400 truncate">
                  {formatCurrency(pesagemMetrics.totalValor)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              TOP 3 Mais Antigos
            </p>
            {pesagemMetrics.top3.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum registro encontrado</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {pesagemMetrics.top3.map((item, idx) => {
                  const statusColor =
                    item.maxDias >= 20 ? 'bg-rose-500 text-rose-500' : item.maxDias >= 7 ? 'bg-amber-500 text-amber-500' : 'bg-sky-500 text-sky-500';
                  return (
                    <li key={idx} className="flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1.5 truncate max-w-[150px] sm:max-w-[180px]">
                        <span className={`h-2 w-2 rounded-full ${statusColor.split(' ')[0]} shrink-0`}></span>
                        <span className="truncate font-medium text-foreground" title={item.texto}>
                          {item.texto}
                        </span>
                      </span>
                      <span className={`font-semibold text-[11px] ${statusColor.split(' ')[1]}`}>
                        {item.maxDias}d <span className="text-muted-foreground font-normal">{item.lotesCount} {item.lotesCount > 1 ? 'lotes' : 'lote'}</span>
                      </span>
                      <span className="font-bold text-foreground text-[11px]">
                        {formatCurrency(item.valorTotal)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Card: AJUSTE */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                Posição: AJUSTE
              </h3>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                  {ajusteInvestigacao.length} Inv.
                </Badge>
                <Badge variant="outline" className="text-[10px] bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20">
                  {ajusteChamado.length} Cham.
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pb-4 border-b border-border">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Materiais</p>
                <p className="text-xl font-black text-foreground">{ajusteMetrics.materiaisCount}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Lotes</p>
                <p className="text-xl font-black text-foreground">{ajusteMetrics.lotesCount}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Valor Avaliado</p>
                <p className="text-sm font-black text-amber-600 dark:text-amber-400 truncate">
                  {formatCurrency(ajusteMetrics.totalValor)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              TOP 3 Mais Antigos
            </p>
            {ajusteMetrics.top3.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum registro encontrado</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {ajusteMetrics.top3.map((item, idx) => {
                  const statusColor =
                    item.maxDias >= 20 ? 'bg-rose-500 text-rose-500' : item.maxDias >= 7 ? 'bg-amber-500 text-amber-500' : 'bg-sky-500 text-sky-500';
                  return (
                    <li key={idx} className="flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1.5 truncate max-w-[150px] sm:max-w-[180px]">
                        <span className={`h-2 w-2 rounded-full ${statusColor.split(' ')[0]} shrink-0`}></span>
                        <span className="truncate font-medium text-foreground" title={item.texto}>
                          {item.texto}
                        </span>
                      </span>
                      <span className={`font-semibold text-[11px] ${statusColor.split(' ')[1]}`}>
                        {item.maxDias}d <span className="text-muted-foreground font-normal">{item.lotesCount} {item.lotesCount > 1 ? 'lotes' : 'lote'}</span>
                      </span>
                      <span className="font-bold text-foreground text-[11px]">
                        {formatCurrency(item.valorTotal)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Card: AJU-SAÍDA */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                Posição: AJU-SAÍDA
              </h3>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                Saída
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 pb-4 border-b border-border">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Materiais</p>
                <p className="text-xl font-black text-foreground">{ajuSaidaMetrics.materiaisCount}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Lotes</p>
                <p className="text-xl font-black text-foreground">{ajuSaidaMetrics.lotesCount}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Valor Avaliado</p>
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 truncate">
                  {formatCurrency(ajuSaidaMetrics.totalValor)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              TOP 3 Mais Antigos
            </p>
            {ajuSaidaMetrics.top3.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum registro encontrado</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {ajuSaidaMetrics.top3.map((item, idx) => {
                  const statusColor =
                    item.maxDias >= 20 ? 'bg-rose-500 text-rose-500' : item.maxDias >= 7 ? 'bg-amber-500 text-amber-500' : 'bg-sky-500 text-sky-500';
                  return (
                    <li key={idx} className="flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1.5 truncate max-w-[150px] sm:max-w-[180px]">
                        <span className={`h-2 w-2 rounded-full ${statusColor.split(' ')[0]} shrink-0`}></span>
                        <span className="truncate font-medium text-foreground" title={item.texto}>
                          {item.texto}
                        </span>
                      </span>
                      <span className={`font-semibold text-[11px] ${statusColor.split(' ')[1]}`}>
                        {item.maxDias}d <span className="text-muted-foreground font-normal">{item.lotesCount} {item.lotesCount > 1 ? 'lotes' : 'lote'}</span>
                      </span>
                      <span className="font-bold text-foreground text-[11px]">
                        {formatCurrency(item.valorTotal)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="border-t border-border pt-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
          Valor Total por Status de Aging & Posição
        </h3>
        <span className="text-[11px] text-muted-foreground">
          Normal (&lt;7d) • Alerta (7-19d) • Crítico (≥20d)
        </span>
      </div>

      {/* BOTTOM ANALYTICS GRID - 3 Gráficos alinhados */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Chart 1: Pesagem */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase text-foreground">PESAGEM</h4>
            <p className="text-[11px] text-muted-foreground mb-2">Total por status • nº de lotes dentro da barra</p>
          </div>
          <div className="relative h-64 w-full">
            <ReactECharts option={chartPesagemOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* Chart 2: Ajuste Stacked */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase text-foreground">AJUSTE - Investigação vs Chamado</h4>
            <p className="text-[11px] text-muted-foreground mb-2">Base: Último Movimento | Valor por status</p>
          </div>
          <div className="relative h-64 w-full">
            <ReactECharts option={chartAjusteOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* Chart 3: Top 5 Materiais AJU-SAÍDA */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase text-foreground">Top 5 Materiais — AJU-SAÍDA</h4>
            <p className="text-[11px] text-muted-foreground mb-2">Por valor imobilizado • cor = status de aging</p>
          </div>
          <div className="relative h-64 w-full">
            <ReactECharts option={chartTopMateriaisOption} style={{ height: '100%', width: '100%' }} />
          </div>
          <div className="mt-1 text-right">
            <span className="text-[11px] font-bold text-muted-foreground">
              Maior valor: <span className="text-foreground">{formatCurrency(maiorValorAjuSaida)}</span>
            </span>
          </div>
        </div>
      </section>

      {/* MODAL DISCRETO PARA CLASSIFICAÇÃO DE LOTES EM INVESTIGAÇÃO */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <SearchCode className="h-5 w-5 text-primary" />
              Lotes da Posição AJUSTE — Investigação vs Chamado
            </DialogTitle>
            <DialogDescription className="text-xs">
              Marque os lotes que estão sob análise da equipe (Em Investigação). Os demais permanecem aguardando o próximo chamado de pesagem.
            </DialogDescription>
          </DialogHeader>

          {/* Barra de busca no modal */}
          <div className="relative my-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por lote, código ou nome do material..."
              value={modalSearch}
              onChange={(e) => setModalSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Lista de lotes */}
          <div className="flex-1 overflow-y-auto max-h-[380px] space-y-2 pr-1 divide-y divide-border/60">
            {filteredAjusteForModal.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Nenhum lote em posição AJUSTE encontrado.
              </div>
            ) : (
              filteredAjusteForModal.map((item) => {
                const isInvestigando = lotesInvestigacaoSet.has(item.lote.trim().toUpperCase());
                const vUnit = valores[item.material] || 0;
                const vt = (item.estoque_disponivel || 0) * vUnit;
                const dias = item.dias_aging || 0;

                return (
                  <div
                    key={item.lote}
                    className={`pt-2.5 pb-2 px-2 flex items-center justify-between gap-3 rounded-lg transition-colors ${
                      isInvestigando ? 'bg-amber-500/10 border border-amber-500/20' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-foreground font-mono">{item.lote}</span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 ${
                            dias >= 20
                              ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                              : dias >= 7
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                              : 'bg-sky-500/10 text-sky-500 border-sky-500/30'
                          }`}
                        >
                          {dias} dias
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{item.material}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate" title={item.texto_breve_material}>
                        {item.texto_breve_material}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5 font-medium">
                        <span>Qtd: {item.estoque_disponivel} {item.unidade_medida}</span>
                        <span>Total: <b className="text-foreground">{formatCurrency(vt)}</b></span>
                        {isInvestigando && (
                          <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-0.5">
                            <Tag className="w-3 h-3" /> Em Investigação
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <Button
                        size="sm"
                        variant={isInvestigando ? 'destructive' : 'outline'}
                        onClick={() => handleToggleInvestigacao(item.lote, item.material)}
                        disabled={isSubmitting}
                        className={`h-7 px-2.5 text-xs font-semibold transition-all ${
                          !isInvestigando
                            ? 'hover:bg-amber-500 hover:text-white hover:border-amber-500'
                            : ''
                        }`}
                      >
                        {isInvestigando ? (
                          <>
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Remover
                          </>
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Investigação
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-border flex justify-between items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              Total marcados: <b className="text-foreground">{lotesInvestigacao.length}</b> de {ajusteItems.length} lotes de ajuste
            </span>
            <Button variant="default" size="sm" onClick={() => setModalOpen(false)} className="h-8">
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
