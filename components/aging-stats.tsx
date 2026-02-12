'use client';

import { useMemo } from 'react';
import { AgingData } from '@/types/aging';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Calendar, TrendingUp, AlertCircle, Flame, Thermometer } from 'lucide-react';
import { isMaterialEspecial, getMateriaisEspeciaisData } from '@/lib/materiais-especiais';

interface AgingStatsProps {
  data: AgingData[];
  onMaterialEspecialClick?: (tipo: 'inf' | 'cfa' | null) => void;
  selectedMaterialEspecial?: 'inf' | 'cfa' | null;
}

export function AgingStats({ data, onMaterialEspecialClick, selectedMaterialEspecial }: AgingStatsProps) {
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

    return {
      totalItens,
      mediaAging,
      itensCriticos,
      itensAlerta,
      maxAging,
      materiaisInf,
      materiaisCfa,
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
      <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 border-0 text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-2">
          <CardTitle className="text-sm font-medium opacity-90">Total de Itens</CardTitle>
          <div className="p-1 bg-white/20 rounded-lg">
            <Package className="h-3 w-3" />
          </div>
        </CardHeader>
        <CardContent className="pb-2">
          <div className="text-lg font-bold leading-tight">{formatNumber(stats.totalItens)}</div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-500 to-teal-600 border-0 text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-2">
          <CardTitle className="text-sm font-medium opacity-90">Média de Aging</CardTitle>
          <div className="p-1 bg-white/20 rounded-lg">
            <Calendar className="h-3 w-3" />
          </div>
        </CardHeader>
        <CardContent className="pb-2">
          <div className="text-lg font-bold leading-tight">{Math.round(stats.mediaAging)} dias</div>
          <div className="mt-0.5">
            {getCriticalityBadge(Math.round(stats.mediaAging))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-yellow-500 to-orange-600 border-0 text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-2">
          <CardTitle className="text-sm font-medium opacity-90">Itens em Alerta</CardTitle>
          <div className="p-1 bg-white/20 rounded-lg">
            <AlertCircle className="h-3 w-3" />
          </div>
        </CardHeader>
        <CardContent className="pb-2">
          <div className="text-lg font-bold leading-tight">{formatNumber(stats.itensAlerta)}</div>
          <div className="mt-0.5">
            <Badge className="bg-white/20 hover:bg-white/30 text-[10px] py-0 px-2">
              10-20 dias
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-orange-500 to-red-600 border-0 text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-2">
          <CardTitle className="text-sm font-medium opacity-90">Itens Críticos</CardTitle>
          <div className="p-1 bg-white/20 rounded-lg">
            <TrendingUp className="h-3 w-3" />
          </div>
        </CardHeader>
        <CardContent className="pb-2">
          <div className="text-lg font-bold leading-tight">{formatNumber(stats.itensCriticos)}</div>
          <div className="mt-0.5 flex items-center gap-2">
            <Badge className="bg-white/20 hover:bg-white/30 text-[10px] py-0 px-2">
              Máx: {stats.maxAging}d
            </Badge>
          </div>
        </CardContent>
      </Card>

      {stats.materiaisInf > 0 && (
        <Card 
          className={`bg-gradient-to-br from-red-500 to-rose-600 border-0 text-white cursor-pointer transition-all hover:scale-105 ${
            selectedMaterialEspecial === 'inf' ? 'ring-4 ring-white shadow-2xl' : ''
          }`}
          onClick={() => onMaterialEspecialClick?.(selectedMaterialEspecial === 'inf' ? null : 'inf')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-2">
            <CardTitle className="text-sm font-medium opacity-90">Inflamáveis (INF)</CardTitle>
            <div className="p-1 bg-white/20 rounded-lg">
              <Flame className="h-3 w-3" />
            </div>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="text-lg font-bold leading-tight">{formatNumber(stats.materiaisInf)}</div>
            <div className="mt-0.5">
              <Badge className="bg-white/20 hover:bg-white/30 text-[10px] py-0 px-2">
                {selectedMaterialEspecial === 'inf' ? 'Filtrado ✓' : 'Clique para filtrar'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {stats.materiaisCfa > 0 && (
        <Card 
          className={`bg-gradient-to-br from-blue-500 to-cyan-600 border-0 text-white cursor-pointer transition-all hover:scale-105 ${
            selectedMaterialEspecial === 'cfa' ? 'ring-4 ring-white shadow-2xl' : ''
          }`}
          onClick={() => onMaterialEspecialClick?.(selectedMaterialEspecial === 'cfa' ? null : 'cfa')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-2">
            <CardTitle className="text-sm font-medium opacity-90">Refrigerados (CFA 2-8°C)</CardTitle>
            <div className="p-1 bg-white/20 rounded-lg">
              <Thermometer className="h-3 w-3" />
            </div>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="text-lg font-bold leading-tight">{formatNumber(stats.materiaisCfa)}</div>
            <div className="mt-0.5">
              <Badge className="bg-white/20 hover:bg-white/30 text-[10px] py-0 px-2">
                {selectedMaterialEspecial === 'cfa' ? 'Filtrado ✓' : 'Clique para filtrar'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
