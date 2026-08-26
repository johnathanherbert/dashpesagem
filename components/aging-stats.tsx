'use client';

import { useMemo } from 'react';
import { AgingData } from '@/types/aging';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Calendar, TrendingUp, AlertCircle, Flame, Thermometer, CalendarClock, TrendingDown, Minus } from 'lucide-react';
import { isMaterialEspecial, getMateriaisEspeciaisData } from '@/lib/materiais-especiais';
import { DashboardSnapshot } from '@/lib/api';

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
  onMaterialEspecialClick?: (tipo: 'inf' | 'cfa' | null) => void;
  selectedMaterialEspecial?: 'inf' | 'cfa' | null;
  onVencimentoClick?: (tipo: 'vencidos' | 'proximos30' | null) => void;
  selectedVencimento?: 'vencidos' | 'proximos30' | null;
  previousSnapshot?: DashboardSnapshot | null;
}

export function AgingStats({ data, onMaterialEspecialClick, selectedMaterialEspecial, onVencimentoClick, selectedVencimento, previousSnapshot }: AgingStatsProps) {
  const stats = useMemo(() => {
    const totalItens = data.length;

    // Calcula média de aging geral
    const totalDiasAging = data.reduce((sum, item) => sum + (item.dias_aging || 0), 0);
    const mediaAging = totalItens > 0 ? totalDiasAging / totalItens : 0;

    // Conta itens críticos (mais de 20 dias)
    const itensCriticos = data.filter(item => (item.dias_aging || 0) > 20).length;

    // Conta itens em alerta (10-20 dias)
    const itensAlerta = data.filter(item => {
      const dias = item.dias_aging || 0;
      return dias >= 10 && dias <= 20;
    }).length;

    // Calcula máximo de aging
    const maxAging = data.length > 0
      ? Math.max(...data.map(item => item.dias_aging || 0))
      : 0;

    // Conta materiais especiais
    const materiaisInf = data.filter(item => isMaterialEspecial(item.material) === 'inf').length;
    const materiaisCfa = data.filter(item => isMaterialEspecial(item.material) === 'cfa').length;

    // Função auxiliar para parsear datas de forma robusta
    const parseDate = (dateStr: string): Date | null => {
      if (!dateStr || dateStr.trim() === '') return null;

      // Tentar formato DD/MM/YYYY
      const ddmmyyyyMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (ddmmyyyyMatch) {
        const [, day, month, year] = ddmmyyyyMatch;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        date.setHours(0, 0, 0, 0);
        return isNaN(date.getTime()) ? null : date;
      }

      // Tentar ISO ou outros formatos nativos
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        date.setHours(0, 0, 0, 0);
        return date;
      }

      return null;
    };

    // Calcula vencimentos
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Zerar horas para comparar apenas datas

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
      mediaAging,
      itensCriticos,
      itensAlerta,
      maxAging,
      materiaisInf,
      materiaisCfa,
      vencidos,
      vencimentoEm30Dias,
      totalComVencimento: itensComVencimento.length,
    };
  }, [data]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pt-BR').format(num);
  };

  const getCriticalityBadge = (days: number) => {
    if (days >= 20) {
      return <Badge className="bg-red-500 hover:bg-red-600">Crítico</Badge>;
    } else if (days >= 10) {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Alerta</Badge>;
    } else {
      return <Badge className="bg-green-500 hover:bg-green-600">Normal</Badge>;
    }
  };

  return (
    <div className="flex gap-2 w-full pb-1 flex-wrap sm:flex-nowrap">
      <Card className="bg-ems-card border border-ems-border text-white flex-1 min-w-[110px] shadow-md">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="p-1.5 rounded-lg bg-ems-navy border border-ems-border text-ems-ice">
            <Package className="h-3.5 w-3.5 flex-shrink-0" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ems-steel leading-none whitespace-nowrap">Total</span>
            <span className="text-base font-black text-white font-mono leading-none mt-1">{formatNumber(stats.totalItens)}</span>
            <div className="mt-0.5">
              <TrendBadge current={stats.totalItens} previous={previousSnapshot?.total_itens} direction="neutral" />
            </div>
          </div>
        </div>
      </Card>

      <Card className="bg-ems-card border border-ems-border text-white flex-1 min-w-[110px] shadow-md">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="p-1.5 rounded-lg bg-ems-navy border border-ems-border text-ems-ice">
            <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ems-steel leading-none whitespace-nowrap">Aging Médio</span>
            <span className="text-base font-black text-ems-ice font-mono leading-none mt-1">{Math.round(stats.mediaAging)}d</span>
            <div className="mt-0.5">
              <TrendBadge current={stats.mediaAging} previous={previousSnapshot?.media_aging} direction="up-bad" format="days" />
            </div>
          </div>
        </div>
      </Card>

      <Card className="bg-ems-card border border-ems-border text-white flex-1 min-w-[110px] shadow-md">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="p-1.5 rounded-lg bg-ems-navy border border-ems-border text-ems-alerta">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ems-alerta leading-none whitespace-nowrap">Alerta (10-20d)</span>
            <span className="text-base font-black text-ems-alerta font-mono leading-none mt-1">{formatNumber(stats.itensAlerta)}</span>
            <div className="mt-0.5">
              <TrendBadge current={stats.itensAlerta} previous={previousSnapshot?.itens_alerta} direction="up-bad" />
            </div>
          </div>
        </div>
      </Card>

      <Card className="bg-ems-card border border-ems-border text-white flex-1 min-w-[110px] shadow-md">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="p-1.5 rounded-lg bg-ems-navy border border-ems-border text-ems-critico">
            <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ems-critico leading-none whitespace-nowrap">Críticos (&gt;20d)</span>
            <span className="text-base font-black text-ems-critico font-mono leading-none mt-1">{formatNumber(stats.itensCriticos)}</span>
            <div className="mt-0.5">
              <TrendBadge current={stats.itensCriticos} previous={previousSnapshot?.itens_criticos} direction="up-bad" />
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
