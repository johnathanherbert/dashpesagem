'use client';

import { useMemo } from 'react';
import { AgingData } from '@/types/aging';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Calendar, TrendingUp, AlertCircle } from 'lucide-react';

interface AgingStatsProps {
  data: AgingData[];
}

export function AgingStats({ data }: AgingStatsProps) {
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

    return {
      totalItens,
      mediaAging,
      itensCriticos,
      itensAlerta,
      maxAging,
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 border-0 text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium opacity-90">Total de Itens</CardTitle>
          <div className="p-2 bg-white/20 rounded-lg">
            <Package className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{formatNumber(stats.totalItens)}</div>
          <p className="text-xs opacity-80 mt-1">
            Registros no estoque
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-500 to-teal-600 border-0 text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium opacity-90">Média de Aging</CardTitle>
          <div className="p-2 bg-white/20 rounded-lg">
            <Calendar className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{Math.round(stats.mediaAging)} dias</div>
          <div className="mt-2">
            {getCriticalityBadge(Math.round(stats.mediaAging))}
          </div>
          <p className="text-xs opacity-80 mt-1">
            Tempo médio no estoque
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-yellow-500 to-orange-600 border-0 text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium opacity-90">Itens em Alerta</CardTitle>
          <div className="p-2 bg-white/20 rounded-lg">
            <AlertCircle className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{formatNumber(stats.itensAlerta)}</div>
          <div className="mt-2">
            <Badge className="bg-white/20 hover:bg-white/30">
              10-20 dias
            </Badge>
          </div>
          <p className="text-xs opacity-80 mt-1">
            Requerem atenção
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-orange-500 to-red-600 border-0 text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium opacity-90">Itens Críticos</CardTitle>
          <div className="p-2 bg-white/20 rounded-lg">
            <TrendingUp className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{formatNumber(stats.itensCriticos)}</div>
          <div className="mt-2 flex items-center gap-2">
            <Badge className="bg-white/20 hover:bg-white/30">
              Máx: {stats.maxAging}d
            </Badge>
          </div>
          <p className="text-xs opacity-80 mt-1">
            Aging &gt; 20 dias
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
