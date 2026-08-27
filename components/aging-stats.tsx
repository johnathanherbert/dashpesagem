'use client';

import { useMemo } from 'react';
import { AgingData, ConfiguracaoResiduais, RemessaData } from '@/types/aging';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Calendar, TrendingUp, AlertCircle, Flame, Thermometer, CalendarClock, TrendingDown, Minus, CheckCircle, AlertTriangle } from 'lucide-react';
import { isMaterialEspecial, getMateriaisEspeciaisData } from '@/lib/materiais-especiais';
import { DashboardSnapshot } from '@/lib/api';
import { enriquecerAgingComAnalise } from '@/lib/residuais-analyzer';

// Indica se subir é bom (true) ou ruim (false) para a métrica
type TrendDirection = 'up-good' | 'up-bad' | 'neutral';

function TrendBadge({
  current,
  previous,
  direction = 'up-bad',
  format = 'number',
}: {
  current: number;
  previous: number | null | undefined;
  direction?: TrendDirection;
  format?: 'number' | 'days' | 'percent';
}) {
  if (previous === null || previous === undefined || previous === 0) return null;

  const delta = current - previous;
  const pct = Math.abs((delta / previous) * 100);

  if (pct < 0.5) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-white/70">
        <Minus className="h-2.5 w-2.5" />
        estável
      </span>
    );
  }

  const isUp = delta > 0;
  const isGood = direction === 'up-good' ? isUp : direction === 'up-bad' ? !isUp : true;
  const color = isGood ? 'text-green-200' : 'text-red-200';
  const label = format === 'days'
    ? `${Math.abs(Math.round(delta))}d`
    : format === 'percent'
    ? `${pct.toFixed(1)}%`
    : `${Math.abs(Math.round(delta))}`;

  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-semibold ${color}`}>
      {isUp
        ? <TrendingUp className="h-2.5 w-2.5" />
        : <TrendingDown className="h-2.5 w-2.5" />}
      {label}
    </span>
  );
}

interface AgingStatsProps {
  data: AgingData[];
  allData?: AgingData[];
  activeTab?: string;
  configResiduais?: ConfiguracaoResiduais;
  valores?: Record<string, number>;
  remessas?: RemessaData[];
  selectedCriticality?: string | null;
  onCriticalityClick?: (crit: string | null) => void;
  onMaterialEspecialClick?: (tipo: 'inf' | 'cfa' | null) => void;
  selectedMaterialEspecial?: 'inf' | 'cfa' | null;
  onVencimentoClick?: (tipo: 'vencidos' | 'proximos30' | null) => void;
  selectedVencimento?: 'vencidos' | 'proximos30' | null;
  previousSnapshot?: DashboardSnapshot | null;
}

export function AgingStats({
  data,
  allData,
  activeTab = 'financial',
  configResiduais,
  valores = {},
  remessas = [],
  selectedCriticality,
  onCriticalityClick,
  onMaterialEspecialClick,
  selectedMaterialEspecial,
  onVencimentoClick,
  selectedVencimento,
  previousSnapshot,
}: AgingStatsProps) {
  const stats = useMemo(() => {
    const totalItens = data.length;

    const diasAlerta = configResiduais?.dias_alerta ?? 7;
    const diasCritico = configResiduais?.dias_critico ?? 20;

    // 1. Somatória de lotes Normal (< 7 dias)
    const lotesNormal = data.filter(item => {
      const dias = item.dias_aging || 0;
      return dias < diasAlerta;
    }).length;

    // 2. Somatória de lotes em Alerta (7 a 19 dias)
    const lotesAlerta = data.filter(item => {
      const dias = item.dias_aging || 0;
      return dias >= diasAlerta && dias < diasCritico;
    }).length;

    // 3. Somatória de lotes Críticos (>= 20 dias)
    const lotesCriticos = data.filter(item => {
      const dias = item.dias_aging || 0;
      return dias >= diasCritico;
    }).length;

    // 4. Somatória de lotes negativos em 922 TR-ZONE (base global independente de filtros)
    const baseParaTrZone = allData && allData.length > 0 ? allData : data;
    const lotesTrZoneNegativos = baseParaTrZone.filter(item => {
      const tipo = (item.tipo_deposito || '').trim().toUpperCase();
      const pos = (item.posicao_deposito || '').trim().toUpperCase();
      const is922OrTrZone =
        tipo === '922' ||
        tipo.includes('922') ||
        pos.includes('TR-ZONE') ||
        pos.includes('TR_ZONE') ||
        pos.includes('TRZONE') ||
        pos.includes('TR ZONE');
      const isNegativo = (item.estoque_disponivel || 0) < 0;
      return is922OrTrZone && isNegativo;
    }).length;

    // Conta materiais especiais
    const materiaisInf = data.filter(item => isMaterialEspecial(item.material) === 'inf').length;
    const materiaisCfa = data.filter(item => isMaterialEspecial(item.material) === 'cfa').length;

    // Função auxiliar para parsear datas de forma robusta
    const parseDate = (dateStr: string): Date | null => {
      if (!dateStr || dateStr.trim() === '') return null;

      const ddmmyyyyMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (ddmmyyyyMatch) {
        const [, day, month, year] = ddmmyyyyMatch;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        date.setHours(0, 0, 0, 0);
        return isNaN(date.getTime()) ? null : date;
      }

      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        date.setHours(0, 0, 0, 0);
        return date;
      }

      return null;
    };

    // Calcula vencimentos
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const em30Dias = new Date(hoje);
    em30Dias.setDate(hoje.getDate() + 30);

    const itensComVencimento = data.filter(item => item.data_vencimento);
    const vencidos = itensComVencimento.filter(item => {
      if (!item.data_vencimento) return false;
      const dataVencimento = parseDate(item.data_vencimento);
      if (!dataVencimento) return false;
      return dataVencimento < hoje;
    }).length;

    const vencimentoEm30Dias = itensComVencimento.filter(item => {
      if (!item.data_vencimento) return false;
      const dataVencimento = parseDate(item.data_vencimento);
      if (!dataVencimento) return false;
      return dataVencimento >= hoje && dataVencimento <= em30Dias;
    }).length;

    return {
      totalItens,
      diasAlerta,
      diasCritico,
      lotesNormal,
      lotesAlerta,
      lotesCriticos,
      lotesTrZoneNegativos,
      materiaisInf,
      materiaisCfa,
      vencidos,
      vencimentoEm30Dias,
      totalComVencimento: itensComVencimento.length,
    };
  }, [data, allData, configResiduais]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pt-BR').format(num);
  };

  return (
    <div className="flex gap-2 w-full pb-1 flex-wrap sm:flex-nowrap">
      {/* 1. Card Total de Lotes */}
      <Card className="bg-ems-card border border-ems-border text-white flex-1 min-w-[110px] shadow-md">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="p-1.5 rounded-lg bg-ems-navy border border-ems-border text-ems-ice">
            <Package className="h-3.5 w-3.5 flex-shrink-0" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ems-steel leading-none whitespace-nowrap">Total Lotes</span>
            <span className="text-base font-black text-white font-mono leading-none mt-1">{formatNumber(stats.totalItens)}</span>
            <div className="mt-0.5">
              <TrendBadge current={stats.totalItens} previous={previousSnapshot?.total_itens} direction="neutral" />
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Card: 922 TR-ZONE < 0 */}
      <Card
        className={`bg-ems-card border text-white flex-1 min-w-[110px] shadow-md cursor-pointer transition-all hover:border-sky-400 ${
          selectedCriticality === 'tr-zone' || selectedCriticality === 'TR-ZONE' || selectedCriticality === 'negativo'
            ? 'border-sky-400 ring-2 ring-sky-400/50 bg-sky-500/10'
            : 'border-ems-border hover:bg-ems-card/80'
        }`}
        onClick={() => {
          const next = (selectedCriticality === 'tr-zone' || selectedCriticality === 'TR-ZONE' || selectedCriticality === 'negativo') ? null : 'TR-ZONE';
          onCriticalityClick?.(next);
        }}
        title="Clique para filtrar lotes com saldo negativo na 922 TR-ZONE"
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="p-1.5 rounded-lg bg-ems-navy border border-ems-border text-sky-400">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300 leading-none whitespace-nowrap">922 TR-ZONE &lt; 0</span>
            <span className="text-base font-black text-sky-300 font-mono leading-none mt-1">{formatNumber(stats.lotesTrZoneNegativos)}</span>
          </div>
        </div>
      </Card>

      {/* 3. Card: Normal (< 7d) */}
      <Card
        className={`bg-ems-card border text-white flex-1 min-w-[110px] shadow-md cursor-pointer transition-all hover:border-emerald-400 ${
          selectedCriticality === 'Normal' || selectedCriticality === 'normal' || selectedCriticality === 'verde'
            ? 'border-emerald-400 ring-2 ring-emerald-400/50 bg-emerald-500/10'
            : 'border-ems-border hover:bg-ems-card/80'
        }`}
        onClick={() => {
          const next = (selectedCriticality === 'Normal' || selectedCriticality === 'normal' || selectedCriticality === 'verde') ? null : 'Normal';
          onCriticalityClick?.(next);
        }}
        title={`Clique para filtrar ${stats.lotesNormal} lotes Normais (< ${stats.diasAlerta} dias)`}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="p-1.5 rounded-lg bg-ems-navy border border-ems-border text-emerald-400">
            <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 leading-none whitespace-nowrap">
              Normal (&lt;{stats.diasAlerta}d)
            </span>
            <span className="text-base font-black text-emerald-400 font-mono leading-none mt-1">{formatNumber(stats.lotesNormal)}</span>
          </div>
        </div>
      </Card>

      {/* 4. Card: Alerta (7-19d) */}
      <Card
        className={`bg-ems-card border text-white flex-1 min-w-[110px] shadow-md cursor-pointer transition-all hover:border-ems-alerta ${
          selectedCriticality === 'Alerta' || selectedCriticality === 'alerta' || selectedCriticality === 'amarelo'
            ? 'border-ems-alerta ring-2 ring-ems-alerta/50 bg-ems-alerta/10'
            : 'border-ems-border hover:bg-ems-card/80'
        }`}
        onClick={() => {
          const next = (selectedCriticality === 'Alerta' || selectedCriticality === 'alerta' || selectedCriticality === 'amarelo') ? null : 'Alerta';
          onCriticalityClick?.(next);
        }}
        title={`Clique para filtrar ${stats.lotesAlerta} lotes em Alerta (${stats.diasAlerta}-${stats.diasCritico - 1} dias)`}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="p-1.5 rounded-lg bg-ems-navy border border-ems-border text-ems-alerta">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ems-alerta leading-none whitespace-nowrap">
              Alerta ({stats.diasAlerta}-{stats.diasCritico - 1}d)
            </span>
            <span className="text-base font-black text-ems-alerta font-mono leading-none mt-1">{formatNumber(stats.lotesAlerta)}</span>
            <div className="mt-0.5">
              <TrendBadge current={stats.lotesAlerta} previous={previousSnapshot?.itens_alerta} direction="up-bad" />
            </div>
          </div>
        </div>
      </Card>

      {/* 5. Card: Crítico (≥20d) */}
      <Card
        className={`bg-ems-card border text-white flex-1 min-w-[110px] shadow-md cursor-pointer transition-all hover:border-ems-critico ${
          selectedCriticality === 'Crítico' || selectedCriticality === 'critico' || selectedCriticality === 'vermelho'
            ? 'border-ems-critico ring-2 ring-ems-critico/50 bg-ems-critico/10'
            : 'border-ems-border hover:bg-ems-card/80'
        }`}
        onClick={() => {
          const next = (selectedCriticality === 'Crítico' || selectedCriticality === 'critico' || selectedCriticality === 'vermelho') ? null : 'Crítico';
          onCriticalityClick?.(next);
        }}
        title={`Clique para filtrar ${stats.lotesCriticos} lotes Críticos (≥ ${stats.diasCritico} dias)`}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="p-1.5 rounded-lg bg-ems-navy border border-ems-border text-ems-critico">
            <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ems-critico leading-none whitespace-nowrap">
              Crítico (≥{stats.diasCritico}d)
            </span>
            <span className="text-base font-black text-ems-critico font-mono leading-none mt-1">{formatNumber(stats.lotesCriticos)}</span>
            <div className="mt-0.5">
              <TrendBadge current={stats.lotesCriticos} previous={previousSnapshot?.itens_criticos} direction="up-bad" />
            </div>
          </div>
        </div>
      </Card>

      {stats.materiaisInf > 0 && (
        <Card
          className={`bg-ems-card border text-white cursor-pointer transition-all hover:border-ems-steel flex-1 min-w-[90px] shadow-md ${
            selectedMaterialEspecial === 'inf' ? 'border-ems-critico ring-1 ring-ems-critico' : 'border-ems-border'
          }`}
          onClick={() => onMaterialEspecialClick?.(selectedMaterialEspecial === 'inf' ? null : 'inf')}
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="p-1.5 rounded-lg bg-ems-navy border border-ems-border text-ems-critico">
              <Flame className="h-3.5 w-3.5 flex-shrink-0" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ems-steel leading-none whitespace-nowrap">INF</span>
              <span className="text-base font-black text-ems-critico font-mono leading-none mt-1">{formatNumber(stats.materiaisInf)}</span>
            </div>
          </div>
        </Card>
      )}

      {stats.materiaisCfa > 0 && (
        <Card
          className={`bg-ems-card border text-white cursor-pointer transition-all hover:border-ems-steel flex-1 min-w-[90px] shadow-md ${
            selectedMaterialEspecial === 'cfa' ? 'border-ems-ice ring-1 ring-ems-ice' : 'border-ems-border'
          }`}
          onClick={() => onMaterialEspecialClick?.(selectedMaterialEspecial === 'cfa' ? null : 'cfa')}
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="p-1.5 rounded-lg bg-ems-navy border border-ems-border text-ems-ice">
              <Thermometer className="h-3.5 w-3.5 flex-shrink-0" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ems-steel leading-none whitespace-nowrap">CFA</span>
              <span className="text-base font-black text-ems-ice font-mono leading-none mt-1">{formatNumber(stats.materiaisCfa)}</span>
            </div>
          </div>
        </Card>
      )}

      {stats.vencidos > 0 && (
        <Card
          className={`bg-ems-card border text-white cursor-pointer transition-all hover:border-ems-steel flex-1 min-w-[100px] shadow-md ${
            selectedVencimento === 'vencidos' ? 'border-ems-critico ring-1 ring-ems-critico' : 'border-ems-border'
          }`}
          onClick={() => onVencimentoClick?.(selectedVencimento === 'vencidos' ? null : 'vencidos')}
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="p-1.5 rounded-lg bg-ems-navy border border-ems-border text-ems-critico">
              <CalendarClock className="h-3.5 w-3.5 flex-shrink-0" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ems-critico leading-none whitespace-nowrap">Vencidos</span>
              <span className="text-base font-black text-ems-critico font-mono leading-none mt-1">{formatNumber(stats.vencidos)}</span>
            </div>
          </div>
        </Card>
      )}

      {stats.vencimentoEm30Dias > 0 && (
        <Card
          className={`bg-ems-card border text-white cursor-pointer transition-all hover:border-ems-steel flex-1 min-w-[120px] shadow-md ${
            selectedVencimento === 'proximos30' ? 'border-ems-alerta ring-1 ring-ems-alerta' : 'border-ems-border'
          }`}
          onClick={() => onVencimentoClick?.(selectedVencimento === 'proximos30' ? null : 'proximos30')}
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="p-1.5 rounded-lg bg-ems-navy border border-ems-border text-ems-alerta">
              <CalendarClock className="h-3.5 w-3.5 flex-shrink-0" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ems-steel leading-none whitespace-nowrap">Vence em 30d</span>
              <span className="text-base font-black text-ems-alerta font-mono leading-none mt-1">{formatNumber(stats.vencimentoEm30Dias)}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
