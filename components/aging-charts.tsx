'use client';

import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { AgingData } from '@/types/aging';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AgingChartsProps {
  data: AgingData[];
}

export function AgingCharts({ data }: AgingChartsProps) {
  const [topLimit, setTopLimit] = useState<number>(3);

  // Obter tipos de depósito únicos
  const tiposDeposito = useMemo(() => {
    const tipos = new Set(data.map(item => item.tipo_deposito).filter(Boolean));
    return Array.from(tipos).sort();
  }, [data]);

  // Aging por Tipo de Depósito - Gráfico de Barras Empilhadas
  const agingPorTipoData = useMemo(() => {
    const ranges = ['0-30 dias', '31-60 dias', '61-90 dias', '91-180 dias', '180+ dias'];
    
    const seriesData = ranges.map(range => {
      const rangeData = tiposDeposito.map(tipo => {
        const items = data.filter(d => d.tipo_deposito === tipo);
        let total = 0;
        
        items.forEach(item => {
          const dias = item.dias_aging || 0;
          const estoque = item.estoque_disponivel || 0;
          
          if (range === '0-30 dias' && dias <= 30) total += estoque;
          else if (range === '31-60 dias' && dias > 30 && dias <= 60) total += estoque;
          else if (range === '61-90 dias' && dias > 60 && dias <= 90) total += estoque;
          else if (range === '91-180 dias' && dias > 90 && dias <= 180) total += estoque;
          else if (range === '180+ dias' && dias > 180) total += estoque;
        });
        
        return Math.round(total * 100) / 100;
      });
      
      return { name: range, data: rangeData };
    });
    
    return { tipos: tiposDeposito, series: seriesData };
  }, [data, tiposDeposito]);

  // Aging Individual por Tipo de Depósito - Um gráfico para cada tipo
  const agingIndividualData = useMemo(() => {
    return tiposDeposito.map(tipo => {
      const items = data.filter(d => d.tipo_deposito === tipo);
      const ranges: Record<string, { total: number; items: AgingData[] }> = {
        'Normal': { total: 0, items: [] },
        'Alerta': { total: 0, items: [] },
        'Crítico': { total: 0, items: [] },
      };
      
      items.forEach(item => {
        const dias = item.dias_aging || 0;
        const estoque = item.estoque_disponivel || 0;
        
        if (dias < 10) {
          ranges['Normal'].total += estoque;
          ranges['Normal'].items.push(item);
        } else if (dias >= 10 && dias <= 20) {
          ranges['Alerta'].total += estoque;
          ranges['Alerta'].items.push(item);
        } else {
          ranges['Crítico'].total += estoque;
          ranges['Crítico'].items.push(item);
        }
      });
      
      return {
        tipo,
        data: Object.entries(ranges).map(([name, value]) => ({
          name: name,
          value: Math.round(value.total * 100) / 100,
          items: value.items,
        })),
        total: items.reduce((sum, item) => sum + (item.estoque_disponivel || 0), 0),
      };
    });
  }, [data, tiposDeposito]);

  // Top materiais por aging de cada tipo de depósito (filtrado por seleção)
  const topAgingData = useMemo(() => {
    const result: Array<{
      material: string;
      descricao: string;
      estoque: number;
      aging: number;
      tipo_deposito: string;
    }> = [];
    
    // Para cada tipo de depósito, pega os top N (baseado em topLimit)
    tiposDeposito.forEach(tipo => {
      const itemsTipo = data
        .filter(item => item.tipo_deposito === tipo && (item.dias_aging || 0) > 0)
        .sort((a, b) => {
          const agingDiff = (b.dias_aging || 0) - (a.dias_aging || 0);
          if (agingDiff !== 0) return agingDiff;
          return (b.estoque_disponivel || 0) - (a.estoque_disponivel || 0);
        })
        .slice(0, topLimit);
      
      itemsTipo.forEach(item => {
        result.push({
          material: `${item.material || 'N/A'} (${tipo})`,
          descricao: item.texto_breve_material || 'Sem descrição',
          estoque: item.estoque_disponivel || 0,
          aging: item.dias_aging || 0,
          tipo_deposito: tipo,
        });
      });
    });
    
    return result;
  }, [data, tiposDeposito, topLimit]);

  // Distribuição Geral de Aging
  const agingGeralData = useMemo(() => {
    const ranges = {
      '0-30 dias': 0,
      '31-60 dias': 0,
      '61-90 dias': 0,
      '91-180 dias': 0,
      '180+ dias': 0,
    };

    data.forEach(item => {
      const dias = item.dias_aging || 0;
      const estoque = item.estoque_disponivel || 0;
      if (dias <= 30) ranges['0-30 dias'] += estoque;
      else if (dias <= 60) ranges['31-60 dias'] += estoque;
      else if (dias <= 90) ranges['61-90 dias'] += estoque;
      else if (dias <= 180) ranges['91-180 dias'] += estoque;
      else ranges['180+ dias'] += estoque;
    });

    return Object.entries(ranges).map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100,
    }));
  }, [data]);

  // Configuração comum para gráficos de pizza
  const getPieOption = (title: string, chartData: Array<{ name: string; value: number }>) => ({
    title: {
      text: title,
      left: 'center',
      textStyle: {
        fontSize: 14,
        fontWeight: 'normal',
      },
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(17, 24, 39, 0.95)',
      borderColor: 'transparent',
      borderRadius: 8,
      padding: 12,
      textStyle: {
        color: '#F3F4F6',
        fontSize: 12,
      },
      formatter: (params: any) => {
        return `<strong style="color: #fff;">${params.name}</strong><br/>
                <strong style="color: #fff;">${params.value} kg</strong> 
                <span style="color: #9CA3AF;">(${params.percent}%)</span>`;
      },
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'middle',
      textStyle: {
        fontSize: 11,
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
          },
        },
        labelLine: {
          show: false,
        },
        data: chartData,
      },
    ],
  });

  // Configuração para gráfico de barras empilhadas (Aging por Tipo)
  const getStackedBarOption = () => {
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
    
    return {
      title: {
        text: 'Aging por Tipo de Depósito',
        left: 'center',
        textStyle: {
          fontSize: 14,
          fontWeight: 'normal',
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: 'transparent',
        borderRadius: 8,
        padding: 12,
        textStyle: {
          color: '#F3F4F6',
          fontSize: 12,
        },
        formatter: (params: any) => {
          let result = `<strong style="color: #fff; font-size: 13px;">${params[0].axisValue}</strong><br/>`;
          params.forEach((param: any) => {
            result += `${param.marker} <span style="color: #E5E7EB;">${param.seriesName}:</span> <strong style="color: #fff;">${param.value} kg</strong><br/>`;
          });
          return result;
        },
      },
      legend: {
        data: agingPorTipoData.series.map(s => s.name),
        bottom: 0,
        textStyle: {
          fontSize: 11,
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: agingPorTipoData.tipos,
        axisLabel: {
          fontSize: 11,
        },
      },
      yAxis: {
        type: 'value',
        name: 'Peso (kg)',
      },
      series: agingPorTipoData.series.map((s, idx) => ({
        name: s.name,
        type: 'bar',
        stack: 'total',
        emphasis: {
          focus: 'series',
        },
        itemStyle: {
          color: colors[idx % colors.length],
        },
        data: s.data,
      })),
    };
  };

  // Configuração para gráfico de pizza individual por tipo de depósito
  const getIndividualPieOption = (tipo: string, chartData: Array<{ name: string; value: number; items: AgingData[] }>, total: number) => {
    // Cores específicas para cada categoria: Normal (verde), Alerta (amarelo), Crítico (vermelho)
    const getCategoryColor = (name: string) => {
      if (name === 'Normal') return '#10b981';
      if (name === 'Alerta') return '#f59e0b';
      if (name === 'Crítico') return '#ef4444';
      return '#8b5cf6';
    };
    
    return {
      title: {
        text: `${tipo}`,
        subtext: `${Math.round(total * 100) / 100} kg`,
        left: 'center',
        textStyle: {
          fontSize: 12,
          fontWeight: 'bold',
        },
        subtextStyle: {
          fontSize: 10,
        },
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: 'transparent',
        borderRadius: 8,
        padding: 12,
        textStyle: {
          color: '#F3F4F6',
          fontSize: 12,
        },
        formatter: (params: any) => {
          const dataIndex = params.dataIndex;
          const rangeData = chartData[dataIndex];
          const items = rangeData.items || [];
          
          // Ordena por estoque disponível e pega top 10
          const top10 = items
            .sort((a, b) => (b.estoque_disponivel || 0) - (a.estoque_disponivel || 0))
            .slice(0, 10);
          
          let tooltip = `<div style="max-width: 350px;">`;
          tooltip += `<strong style="color: #fff; font-size: 13px;">${params.name}</strong><br/>`;
          tooltip += `<strong style="color: #fff;">${params.value} kg</strong> <span style="color: #9CA3AF;">(${params.percent}%)</span><br/>`;
          tooltip += `<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">`;
          tooltip += `<strong style="color: #E5E7EB;">Top 10 Materiais:</strong><br/>`;
          
          top10.forEach((item, idx) => {
            const desc = item.texto_breve_material || 'Sem descrição';
            const descTrunc = desc.length > 25 ? desc.substring(0, 25) + '...' : desc;
            const peso = Math.round((item.estoque_disponivel || 0) * 100) / 100;
            tooltip += `<span style="color: #D1D5DB;">${idx + 1}. ${item.material} - ${descTrunc}</span><br/>`;
            tooltip += `&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #9CA3AF;">${peso} kg, ${item.dias_aging || 0} dias</span><br/>`;
          });
          
          if (items.length > 10) {
            tooltip += `<em style="color: #9CA3AF;">... e mais ${items.length - 10} itens</em>`;
          }
          
          tooltip += `</div></div>`;
          return tooltip;
        },
      },
      legend: {
        orient: 'horizontal',
        bottom: 0,
        textStyle: {
          fontSize: 8,
        },
        itemWidth: 8,
        itemHeight: 8,
      },
      series: [
        {
          type: 'pie',
          radius: ['30%', '60%'],
          center: ['50%', '40%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 4,
            borderColor: '#fff',
            borderWidth: 1,
            color: (params: any) => getCategoryColor(chartData[params.dataIndex].name),
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 10,
              fontWeight: 'bold',
            },
          },
          labelLine: {
            show: false,
          },
          data: chartData,
        },
      ],
    };
  };

  // Configuração para gráfico de barras - Top 3 por Tipo de Depósito
  const getTopAgingBarOption = () => ({
    title: {
      text: 'Top 3 Materiais por Aging em Cada Tipo de Depósito',
      left: 'center',
      textStyle: {
        fontSize: 14,
        fontWeight: 'normal',
      },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
      formatter: (params: any) => {
        const item = topAgingData[params[0].dataIndex];
        const descTrunc = item.descricao.length > 40 ? item.descricao.substring(0, 40) + '...' : item.descricao;
        return `
          <strong>${item.material}</strong><br/>
          ${descTrunc}<br/>
          <strong>Estoque:</strong> ${Math.round(item.estoque * 100) / 100} kg<br/>
          <strong>Aging:</strong> ${item.aging} dias<br/>
          <strong>Tipo Depósito:</strong> ${item.tipo_deposito}
        `;
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '8%',
      top: '12%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: topAgingData.map(item => item.material),
      axisLabel: {
        rotate: 45,
        fontSize: 9,
        interval: 0,
      },
    },
    yAxis: {
      type: 'value',
      name: 'Aging (dias)',
    },
    series: [
      {
        data: topAgingData.map(item => ({
          value: item.aging,
          itemStyle: {
            color: item.aging > 20 ? '#ef4444' :   // 🔴 Vermelho: > 20 dias (crítico)
                   item.aging >= 10 ? '#eab308' :  // 🟡 Amarelo: 10-20 dias (atenção)
                   '#10b981',                       // 🟢 Verde: < 10 dias (ok)
          },
        })),
        type: 'bar',
        barWidth: '60%',
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  });

  return (
    <div className="space-y-4">
      {/* Grid com 2 gráficos principais lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico Geral de Aging - Top N por Tipo de Depósito */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm mb-3">
              Top {topLimit} Materiais por Aging
            </CardTitle>
            
            {/* Filtros e Controles */}
            <div className="flex flex-col gap-3 border-t pt-3">
              {/* Controle de Top N */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Quantidade
                </label>
                <div className="flex gap-2">
                  {[3, 5, 10].map(num => (
                    <Button
                      key={num}
                      variant={topLimit === num ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTopLimit(num)}
                      className="h-7 px-3 text-xs"
                    >
                      Top {num}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ReactECharts 
              option={getTopAgingBarOption()} 
              style={{ height: '320px' }}
              opts={{ renderer: 'svg' }}
            />
          </CardContent>
        </Card>

        {/* Gráfico de Barras Empilhadas - Aging por Tipo de Depósito */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Aging Segmentado por Tipo de Depósito</CardTitle>
          </CardHeader>
          <CardContent>
            <ReactECharts 
              option={getStackedBarOption()} 
              style={{ height: '320px' }}
              opts={{ renderer: 'svg' }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Grid de Gráficos Individuais por Tipo de Depósito - mais compacto */}
      <div>
        <h3 className="text-base font-semibold mb-3">Aging Detalhado por Tipo de Depósito</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {agingIndividualData.map(({ tipo, data: chartData, total }) => (
            <Card key={tipo}>
              <CardContent className="pt-4 pb-2">
                <ReactECharts 
                  option={getIndividualPieOption(tipo, chartData, total)} 
                  style={{ height: '200px' }}
                  opts={{ renderer: 'svg' }}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Nova seção: Distribuição por Tipo de Depósito com Barras de Progresso */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribuição de Peso por Tipo de Depósito</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tiposDeposito.map(tipo => {
              const tipoItems = data.filter(d => d.tipo_deposito === tipo);
              const tipoTotal = tipoItems.reduce((sum, item) => sum + (item.estoque_disponivel || 0), 0);
              const totalGeral = data.reduce((sum, item) => sum + (item.estoque_disponivel || 0), 0);
              const percentage = totalGeral > 0 ? (tipoTotal / totalGeral) * 100 : 0;
              
              // Calcula média de aging para o tipo
              const totalDias = tipoItems.reduce((sum, item) => sum + (item.dias_aging || 0), 0);
              const avgDias = tipoItems.length > 0 ? Math.round(totalDias / tipoItems.length) : 0;
              
              return (
                <div key={tipo} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{tipo}</span>
                      <Badge 
                        className={
                          avgDias >= 20 
                            ? 'bg-red-500 hover:bg-red-600' 
                            : avgDias >= 10 
                            ? 'bg-yellow-500 hover:bg-yellow-600' 
                            : 'bg-green-500 hover:bg-green-600'
                        }
                      >
                        Média: {avgDias}d
                      </Badge>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {Math.round(tipoTotal * 100) / 100} kg ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full transition-all ${
                        avgDias >= 20 
                          ? 'bg-red-600 dark:bg-red-500' 
                          : avgDias >= 10 
                          ? 'bg-yellow-600 dark:bg-yellow-500' 
                          : 'bg-green-600 dark:bg-green-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-muted-foreground">
              Distribuição do peso total de estoque por tipo de depósito
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
