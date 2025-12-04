'use client';

import { useState, useMemo } from 'react';
import { AgingData } from '@/types/aging';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowUpDown, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AgingTableProps {
  data: AgingData[];
}

type SortField = keyof AgingData;
type SortOrder = 'asc' | 'desc';

export function AgingTable({ data }: AgingTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('dias_aging');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [tipoDepositoFilter, setTipoDepositoFilter] = useState<string>('all');
  const [centroFilter, setCentroFilter] = useState<string>('all');
  const [unidadeFilter, setUnidadeFilter] = useState<string>('all');

  // Função para alternar ordenação
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Obter valores únicos para filtros
  const tiposDeposito = useMemo(() => {
    const tipos = new Set(data.map(item => item.tipo_deposito).filter(Boolean));
    return Array.from(tipos).sort();
  }, [data]);

  const centros = useMemo(() => {
    const centrosSet = new Set(data.map(item => item.centro).filter(Boolean));
    return Array.from(centrosSet).sort();
  }, [data]);

  const unidades = useMemo(() => {
    const unidadesSet = new Set(data.map(item => item.unidade_medida).filter(Boolean));
    return Array.from(unidadesSet).sort();
  }, [data]);

  // Filtrar e ordenar dados
  const filteredAndSortedData = useMemo(() => {
    let filtered = data;

    // Aplicar filtro por tipo de depósito
    if (tipoDepositoFilter !== 'all') {
      filtered = filtered.filter(item => item.tipo_deposito === tipoDepositoFilter);
    }

    // Aplicar filtro por centro
    if (centroFilter !== 'all') {
      filtered = filtered.filter(item => item.centro === centroFilter);
    }

    // Aplicar filtro por unidade de medida
    if (unidadeFilter !== 'all') {
      filtered = filtered.filter(item => item.unidade_medida === unidadeFilter);
    }

    // Aplicar busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.material?.toLowerCase().includes(term) ||
        item.texto_breve_material?.toLowerCase().includes(term) ||
        item.lote?.toLowerCase().includes(term) ||
        item.deposito?.toLowerCase().includes(term) ||
        item.tipo_estoque?.toLowerCase().includes(term)
      );
    }

    // Aplicar ordenação
    return [...filtered].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (sortOrder === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }, [data, searchTerm, sortField, sortOrder, tipoDepositoFilter, centroFilter, unidadeFilter]);

  // Função para limpar todos os filtros
  const clearFilters = () => {
    setSearchTerm('');
    setTipoDepositoFilter('all');
    setCentroFilter('all');
    setUnidadeFilter('all');
  };

  const hasActiveFilters = searchTerm || tipoDepositoFilter !== 'all' || centroFilter !== 'all' || unidadeFilter !== 'all';

  // Função para obter cor do badge baseado no aging
  const getAgingBadgeVariant = (dias: number | undefined) => {
    if (!dias) return 'secondary';
    if (dias <= 30) return 'default';
    if (dias <= 60) return 'secondary';
    if (dias <= 90) return 'default';
    return 'destructive';
  };

  // Função para formatar peso
  const formatPeso = (peso: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(peso);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Dados de Estoque</span>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 px-2"
              >
                <X className="h-4 w-4 mr-1" />
                Limpar filtros
              </Button>
            )}
            <Badge variant="outline">
              {filteredAndSortedData.length} registros
            </Badge>
          </div>
        </CardTitle>
        
        {/* Barra de Filtros */}
        <div className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por material, lote, depósito..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <Select value={tipoDepositoFilter} onValueChange={setTipoDepositoFilter}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Tipo de Depósito" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Tipos</SelectItem>
                  {tiposDeposito.map(tipo => (
                    <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <Select value={centroFilter} onValueChange={setCentroFilter}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Centro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Centros</SelectItem>
                  {centros.map(centro => (
                    <SelectItem key={centro} value={centro}>{centro}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Unidades</SelectItem>
                  {unidades.map(unidade => (
                    <SelectItem key={unidade} value={unidade}>{unidade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('material')}
                    className="h-8 px-2"
                  >
                    Material
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('texto_breve_material')}
                    className="h-8 px-2"
                  >
                    Descrição
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('lote')}
                    className="h-8 px-2"
                  >
                    Lote
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('estoque_disponivel')}
                    className="h-8 px-2"
                  >
                    Estoque
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('unidade_medida')}
                    className="h-8 px-2"
                  >
                    UMB
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('deposito')}
                    className="h-8 px-2"
                  >
                    Depósito
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('tipo_deposito')}
                    className="h-8 px-2"
                  >
                    Tipo Dep.
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('centro')}
                    className="h-8 px-2"
                  >
                    Centro
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('ultimo_movimento')}
                    className="h-8 px-2"
                  >
                    Último Movimento
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('tipo_estoque')}
                    className="h-8 px-2"
                  >
                    Tipo
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('dias_aging')}
                    className="h-8 px-2"
                  >
                    Aging (dias)
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center h-24 text-muted-foreground">
                    Nenhum resultado encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedData.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.material}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={item.texto_breve_material}>
                      {item.texto_breve_material}
                    </TableCell>
                    <TableCell>{item.lote}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatPeso(item.estoque_disponivel || 0)}
                    </TableCell>
                    <TableCell>{item.unidade_medida}</TableCell>
                    <TableCell>{item.deposito || '-'}</TableCell>
                    <TableCell>{item.tipo_deposito || '-'}</TableCell>
                    <TableCell>{item.centro || '-'}</TableCell>
                    <TableCell className="text-sm">{item.ultimo_movimento || '-'}</TableCell>
                    <TableCell>
                      {item.tipo_estoque ? (
                        <Badge variant="outline">{item.tipo_estoque}</Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={getAgingBadgeVariant(item.dias_aging)}>
                        {item.dias_aging || 0} dias
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
