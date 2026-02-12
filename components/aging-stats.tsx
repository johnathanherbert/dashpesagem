'use client';

import { useMemo } from 'react';
import { AgingData } from '@/types/aging';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Calendar, TrendingUp, AlertCircle, Flame, Thermometer, CalendarClock } from 'lucide-react';
import { isMaterialEspecial, getMateriaisEspeciaisData } from '@/lib/materiais-especiais';

interface AgingStatsProps {
  data: AgingData[];
  onMaterialEspecialClick?: (tipo: 'inf' | 'cfa' | null) => void;
  selectedMaterialEspecial?: 'inf' | 'cfa' | null;
  onVencimentoClick?: (tipo: 'vencidos' | 'proximos30' | null) => void;
  selectedVencimento?: 'vencidos' | 'proximos30' | null;
}

export function AgingStats({ data, onMaterialEspecialClick, selectedMaterialEspecial, onVencimentoClick, selectedVencimento }: AgingStatsProps) {
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
    <div className="flex gap-2 w-full pb-1">
      <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 border-0 text-white flex-1">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Package className="h-4 w-4 flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] opacity-90 leading-none whitespace-nowrap">Total</span>
            <span className="text-base font-bold leading-none mt-0.5">{formatNumber(stats.totalItens)}</span>
          </div>
        </div>
      </Card>

      <Card className="bg-gradient-to-br from-green-500 to-teal-600 border-0 text-white flex-1">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Calendar className="h-4 w-4 flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] opacity-90 leading-none whitespace-nowrap">Aging</span>
            <span className="text-base font-bold leading-none mt-0.5">{Math.round(stats.mediaAging)}d</span>
          </div>
        </div>
      </Card>

      <Card className="bg-gradient-to-br from-yellow-500 to-orange-600 border-0 text-white flex-1">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] opacity-90 leading-none whitespace-nowrap">Alerta</span>
            <span className="text-base font-bold leading-none mt-0.5">{formatNumber(stats.itensAlerta)}</span>
          </div>
        </div>
      </Card>

      <Card className="bg-gradient-to-br from-orange-500 to-red-600 border-0 text-white flex-1">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <TrendingUp className="h-4 w-4 flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] opacity-90 leading-none whitespace-nowrap">Críticos</span>
            <span className="text-base font-bold leading-none mt-0.5">{formatNumber(stats.itensCriticos)}</span>
          </div>
        </div>
      </Card>

      {stats.materiaisInf > 0 && (
        <Card
          className={`bg-gradient-to-br from-red-500 to-rose-600 border-0 text-white cursor-pointer transition-all hover:scale-105 flex-1 ${
            selectedMaterialEspecial === 'inf' ? 'ring-2 ring-white shadow-lg' : ''
          }`}
          onClick={() => onMaterialEspecialClick?.(selectedMaterialEspecial === 'inf' ? null : 'inf')}
        >
          <div className="flex items-center gap-2 px-3 py-1.5">
            <Flame className="h-4 w-4 flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] opacity-90 leading-none whitespace-nowrap">INF</span>
              <span className="text-base font-bold leading-none mt-0.5">{formatNumber(stats.materiaisInf)}</span>
            </div>
          </div>
        </Card>
      )}

      {stats.materiaisCfa > 0 && (
        <Card
          className={`bg-gradient-to-br from-blue-500 to-cyan-600 border-0 text-white cursor-pointer transition-all hover:scale-105 flex-1 ${
            selectedMaterialEspecial === 'cfa' ? 'ring-2 ring-white shadow-lg' : ''
          }`}
          onClick={() => onMaterialEspecialClick?.(selectedMaterialEspecial === 'cfa' ? null : 'cfa')}
        >
          <div className="flex items-center gap-2 px-3 py-1.5">
            <Thermometer className="h-4 w-4 flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] opacity-90 leading-none whitespace-nowrap">CFA</span>
              <span className="text-base font-bold leading-none mt-0.5">{formatNumber(stats.materiaisCfa)}</span>
            </div>
          </div>
        </Card>
      )}

      {stats.vencidos > 0 && (
        <Card
          className={`bg-gradient-to-br from-red-600 to-rose-700 border-0 text-white cursor-pointer transition-all hover:scale-105 flex-1 ${
            selectedVencimento === 'vencidos' ? 'ring-2 ring-white shadow-lg' : ''
          }`}
          onClick={() => onVencimentoClick?.(selectedVencimento === 'vencidos' ? null : 'vencidos')}
        >
          <div className="flex items-center gap-2 px-3 py-1.5">
            <CalendarClock className="h-4 w-4 flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] opacity-90 leading-none whitespace-nowrap">Vencidos</span>
              <span className="text-base font-bold leading-none mt-0.5">{formatNumber(stats.vencidos)}</span>
            </div>
          </div>
        </Card>
      )}

      {stats.vencimentoEm30Dias > 0 && (
        <Card
          className={`bg-gradient-to-br from-amber-500 to-orange-600 border-0 text-white cursor-pointer transition-all hover:scale-105 flex-1 ${
            selectedVencimento === 'proximos30' ? 'ring-2 ring-white shadow-lg' : ''
          }`}
          onClick={() => onVencimentoClick?.(selectedVencimento === 'proximos30' ? null : 'proximos30')}
        >
          <div className="flex items-center gap-2 px-3 py-1.5">
            <CalendarClock className="h-4 w-4 flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] opacity-90 leading-none whitespace-nowrap">Próx 30d</span>
              <span className="text-base font-bold leading-none mt-0.5">{formatNumber(stats.vencimentoEm30Dias)}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
