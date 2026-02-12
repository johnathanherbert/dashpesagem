'use client';

import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type RowSelectionState,
  type FilterFn,
  type Column,
  type Table as TanstackTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Copy,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Package,
} from 'lucide-react';
import { AgingData, RemessaData, ConfiguracaoResiduais, AgingTableRow, NivelResidual } from '@/types/aging';
import { enriquecerAgingComAnalise } from '@/lib/residuais-analyzer';
import { cn } from '@/lib/utils';

// Custom filter for numeric range [min, max]
const numberRangeFilter: FilterFn<AgingTableRow> = (row, columnId, filterValue) => {
  const val = row.getValue<number>(columnId);
  const [min, max] = filterValue as [number | undefined, number | undefined];
  if (min !== undefined && val < min) return false;
  if (max !== undefined && val > max) return false;
  return true;
};

// Custom filter for aging status
const statusAgingFilter: FilterFn<AgingTableRow> = (row, columnId, filterValue) => {
  if (!filterValue) return true;
  const dias = row.getValue<number>('dias_aging');
  
  const status = dias <= 10 ? 'Normal' : dias <= 19 ? 'Alerta' : 'Crítico';
  
  return status === filterValue;
};

interface ResiduaisViewProps {
  agingData: AgingData[];
  valores: Record<string, number>;
  remessas: RemessaData[];
  configResiduais: ConfiguracaoResiduais;
  onNavigateToRemessas?: (material: string) => void;
}

// Column filter widget
function ColumnFilterWidget({
  column,
  table,
  filterType,
}: {
  column: Column<AgingTableRow, unknown>;
  table: TanstackTable<AgingTableRow>;
  filterType: 'text' | 'select' | 'range';
}) {
  if (filterType === 'text') {
    return (
      <Input
        value={(column.getFilterValue() as string) ?? ''}
        onChange={(e) => column.setFilterValue(e.target.value || undefined)}
        placeholder="Filtrar..."
        className="h-7 text-xs min-w-[80px]"
      />
    );
  }

  if (filterType === 'select') {
    // Filtro customizado para status_aging com opções fixas
    if (column.id === 'status_aging') {
      return (
        <Select
          value={(column.getFilterValue() as string) ?? '__all__'}
          onValueChange={(v) => column.setFilterValue(v === '__all__' ? undefined : v)}
        >
          <SelectTrigger className="h-7 text-xs min-w-[70px]" size="sm">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="Normal">Normal</SelectItem>
            <SelectItem value="Alerta">Alerta</SelectItem>
            <SelectItem value="Crítico">Crítico</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    // Filtro padrão para outras colunas
    const uniqueValues = Array.from(
      new Set(
        table.getPreFilteredRowModel().rows
          .map((row) => {
            const val = row.getValue(column.id);
            return val != null ? String(val) : '';
          })
          .filter((v) => v !== '')
      )
    ).sort();

    return (
      <Select
        value={(column.getFilterValue() as string) ?? '__all__'}
        onValueChange={(v) => column.setFilterValue(v === '__all__' ? undefined : v)}
      >
        <SelectTrigger className="h-7 text-xs min-w-[70px]" size="sm">
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos</SelectItem>
          {uniqueValues.map((v) => (
            <SelectItem key={v} value={v}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (filterType === 'range') {
    const currentFilter = column.getFilterValue() as [number | undefined, number | undefined] | undefined;
    return (
      <div className="flex gap-1">
        <Input
          type="number"
          placeholder="Min"
          className="h-7 text-xs w-16"
          value={currentFilter?.[0] ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            column.setFilterValue((old: [number | undefined, number | undefined] | undefined) => [
              val ? Number(val) : undefined,
              old?.[1],
            ]);
          }}
        />
        <Input
          type="number"
          placeholder="Max"
          className="h-7 text-xs w-16"
          value={currentFilter?.[1] ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            column.setFilterValue((old: [number | undefined, number | undefined] | undefined) => [
              old?.[0],
              val ? Number(val) : undefined,
            ]);
          }}
        />
      </div>
    );
  }

  return null;
}

// Sort icon
function SortIcon({ column }: { column: Column<AgingTableRow, unknown> }) {
  const sorted = column.getIsSorted();
  if (sorted === 'asc') return <ArrowUp className="h-3 w-3" />;
  if (sorted === 'desc') return <ArrowDown className="h-3 w-3" />;
  return <ArrowUpDown className="h-3 w-3 opacity-30" />;
}

// Filter type map per column
type FilterType = 'text' | 'select' | 'range' | 'none';

const COLUMN_FILTER_TYPES: Record<string, FilterType> = {
  select: 'none',
  material: 'text',
  texto_breve_material: 'text',
  lote: 'text',
  centro: 'select',
  deposito: 'select',
  tipo_deposito: 'select',
  posicao_deposito: 'select',
  estoque_disponivel: 'range',
  unidade_medida: 'select',
  valor_unitario: 'range',
  valor_total: 'range',
  dias_aging: 'range',
  status_aging: 'select',
  ultimo_movimento: 'text',
  tipo_estoque: 'select',
  remessas_abertas: 'range',
};

export function ResiduaisView({ agingData, valores, remessas, configResiduais, onNavigateToRemessas }: ResiduaisViewProps) {
  const [analysisMode, setAnalysisMode] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedMIGO, setCopiedMIGO] = useState(false);
  const [copiedLote, setCopiedLote] = useState(false);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [nivelFilter, setNivelFilter] = useState<NivelResidual | null>(null);

  // Função para copiar texto ao clicar
  const handleCopyText = async (text: string, cellId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCell(cellId);
      setTimeout(() => setCopiedCell(null), 1500);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  // Enriched data
  const tableData: AgingTableRow[] = useMemo(() => {
    return enriquecerAgingComAnalise(agingData, configResiduais, valores, remessas);
  }, [agingData, configResiduais, valores, remessas]);

  // Filtered data based on analysis mode
  const displayData: AgingTableRow[] = useMemo(() => {
    let filtered = tableData;
    
    // Filtrar por modo de análise (apenas residuais)
    if (analysisMode) {
      filtered = filtered.filter((r) => r.is_residual);
    }
    
    // Filtrar por nível (se houver filtro ativo)
    if (nivelFilter) {
      filtered = filtered.filter((r) => r.nivel === nivelFilter);
    }
    
    return filtered;
  }, [tableData, analysisMode, nivelFilter]);

  // Analysis stats
  const analysisStats = useMemo(() => {
    const residuals = tableData.filter((r) => r.is_residual);
    return {
      total: residuals.length,
      verdes: residuals.filter((r) => r.nivel === 'verde').length,
      amarelos: residuals.filter((r) => r.nivel === 'amarelo').length,
      vermelhos: residuals.filter((r) => r.nivel === 'vermelho').length,
      valorTotal: residuals.reduce((sum, r) => sum + r.valor_total, 0),
    };
  }, [tableData]);

  // Column definitions
  const columns: ColumnDef<AgingTableRow, unknown>[] = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Selecionar todos"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Selecionar linha"
          />
        ),
        size: 40,
        enableSorting: false,
        enableColumnFilter: false,
      },
      {
        accessorKey: 'material',
        header: 'Material',
        cell: ({ getValue, row }) => {
          const material = getValue<string>();
          const cellId = `material-${row.id}`;
          const isCopied = copiedCell === cellId;
          return (
            <button
              onClick={() => handleCopyText(material, cellId)}
              className={cn(
                "font-mono text-xs px-2 py-1 rounded transition-all cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 text-left w-full",
                isCopied && "bg-green-100 dark:bg-green-900/30"
              )}
              title="Clique para copiar"
            >
              {material}
              {isCopied && <Copy className="inline-block ml-1 h-3 w-3 text-green-600" />}
            </button>
          );
        },
        size: 120,
      },
      {
        accessorKey: 'texto_breve_material',
        header: 'Descricao',
        cell: ({ getValue }) => (
          <span className="truncate block max-w-[200px]" title={getValue<string>()}>
            {getValue<string>()}
          </span>
        ),
        size: 200,
      },
      {
        accessorKey: 'lote',
        header: 'Lote',
        cell: ({ getValue, row }) => {
          const lote = getValue<string>();
          const cellId = `lote-${row.id}`;
          const isCopied = copiedCell === cellId;
          return (
            <button
              onClick={() => handleCopyText(lote, cellId)}
              className={cn(
                "font-mono text-xs px-2 py-1 rounded transition-all cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 text-left w-full",
                isCopied && "bg-green-100 dark:bg-green-900/30"
              )}
              title="Clique para copiar"
            >
              {lote}
              {isCopied && <Copy className="inline-block ml-1 h-3 w-3 text-green-600" />}
            </button>
          );
        },
        size: 120,
      },
      {
        accessorKey: 'centro',
        header: 'Centro',
        size: 70,
      },
      {
        accessorKey: 'deposito',
        header: 'Deposito',
        size: 80,
      },
      {
        accessorKey: 'tipo_deposito',
        header: 'Tipo Dep.',
        size: 80,
      },
      {
        accessorKey: 'posicao_deposito',
        header: 'Posicao',
        size: 80,
      },
      {
        accessorKey: 'estoque_disponivel',
        header: 'Quantidade',
        cell: ({ getValue }) => (
          <span className="text-right block font-semibold">
            {getValue<number>().toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 3,
            })}
          </span>
        ),
        filterFn: numberRangeFilter,
        size: 110,
      },
      {
        accessorKey: 'unidade_medida',
        header: 'UMB',
        size: 60,
      },
      {
        accessorKey: 'valor_unitario',
        header: 'Val. Unit.',
        cell: ({ getValue }) => {
          const val = getValue<number>();
          if (val === 0) return <span className="text-muted-foreground text-right block">-</span>;
          return (
            <span className="text-right block">
              {val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          );
        },
        filterFn: numberRangeFilter,
        size: 110,
      },
      {
        accessorKey: 'valor_total',
        header: 'Val. Total',
        cell: ({ getValue }) => {
          const val = getValue<number>();
          if (val === 0) return <span className="text-muted-foreground text-right block">-</span>;
          return (
            <span className="text-right block font-semibold text-purple-700 dark:text-purple-400">
              {val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          );
        },
        filterFn: numberRangeFilter,
        size: 120,
      },
      {
        accessorKey: 'dias_aging',
        header: 'Dias Aging',
        cell: ({ getValue }) => {
          const dias = getValue<number>();
          let badgeClass = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
          if (dias > 19) badgeClass = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
          else if (dias > 10) badgeClass = 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
          return (
            <span className={cn('px-2 py-0.5 rounded text-xs font-medium text-right block w-fit ml-auto', badgeClass)}>
              {dias}
            </span>
          );
        },
        filterFn: numberRangeFilter,
        size: 90,
      },
      {
        accessorKey: 'status_aging',
        header: 'Status',
        cell: ({ row }) => {
          const dias = row.getValue<number>('dias_aging');
          let statusConfig: { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode; className: string };
          
          if (dias <= 10) {
            statusConfig = {
              label: 'Normal',
              variant: 'default',
              icon: <CheckCircle className="h-3 w-3" />,
              className: 'bg-green-500 hover:bg-green-600 text-white'
            };
          } else if (dias <= 19) {
            statusConfig = {
              label: 'Alerta',
              variant: 'default',
              icon: <AlertTriangle className="h-3 w-3" />,
              className: 'bg-yellow-500 hover:bg-yellow-600 text-white'
            };
          } else {
            statusConfig = {
              label: 'Crítico',
              variant: 'destructive',
              icon: <AlertCircle className="h-3 w-3" />,
              className: 'bg-red-500 hover:bg-red-600 text-white'
            };
          }
          
          return (
            <Badge className={cn(statusConfig.className, 'gap-1 font-medium')}>
              {statusConfig.icon}
              {statusConfig.label}
            </Badge>
          );
        },
        filterFn: statusAgingFilter,
        size: 110,
      },
      {
        accessorKey: 'ultimo_movimento',
        header: 'Ult. Mov.',
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">{getValue<string>()}</span>
        ),
        size: 100,
      },
      {
        accessorKey: 'tipo_estoque',
        header: 'Tipo Est.',
        size: 70,
      },
      {
        accessorKey: 'remessas_abertas',
        header: 'Remessas',
        cell: ({ getValue, row }) => {
          const count = getValue<number>();
          const material = row.getValue<string>('material');
          if (count === 0) return <span className="text-muted-foreground text-center block">-</span>;
          return (
            <div className="relative group">
              <Badge
                variant="secondary"
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border-0 cursor-pointer transition-all duration-300 hover:scale-110 hover:shadow-lg font-semibold px-2.5 py-0.5"
                onClick={() => onNavigateToRemessas?.(material)}
                title="Clique para ver remessas deste material"
              >
                <Package className="h-3 w-3 mr-1 animate-pulse" />
                <span className="font-mono text-xs">{count}</span>
              </Badge>
              <div className="absolute inset-0 bg-blue-400 opacity-0 group-hover:opacity-30 blur-md transition-opacity duration-300 rounded pointer-events-none" />
            </div>
          );
        },
        filterFn: numberRangeFilter,
        size: 110,
      },
    ],
    [copiedCell, onNavigateToRemessas]
  );

  const table = useReactTable({
    data: displayData,
    columns,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
    filterFns: {
      numberRange: numberRangeFilter,
      statusAging: statusAgingFilter,
    },
  });

  // Copy selected rows as tab-separated values
  const handleCopySelected = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) return;

    const headers = [
      'Material', 'Descricao', 'Lote', 'Centro', 'Deposito',
      'Tipo Dep.', 'Posicao', 'Quantidade', 'UMB', 'Val.Unit.',
      'Val.Total', 'Dias Aging', 'Ult.Mov.', 'Tipo Est.', 'Remessas',
    ];

    const lines = selectedRows.map((row) => {
      const d = row.original;
      return [
        d.material,
        d.texto_breve_material,
        d.lote,
        d.centro,
        d.deposito,
        d.tipo_deposito,
        d.posicao_deposito,
        d.estoque_disponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        d.unidade_medida,
        d.valor_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        d.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        String(d.dias_aging),
        d.ultimo_movimento,
        d.tipo_estoque || '',
        String(d.remessas_abertas),
      ].join('\t');
    });

    const text = [headers.join('\t'), ...lines].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Copy selected rows for MIGO transaction
  const handleCopyMIGO = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) return;

    const lines = selectedRows.map((row) => {
      const d = row.original;
      // Sequência exata: codigo[2tabs]qtd[2tabs]umr[2tabs]Y84[1tab]centro[3tabs]pes[2tabs]pes[1tab]9000
      return [
        d.material,           // codigo
        '',                   // tab vazio
        d.estoque_disponivel.toLocaleString('pt-BR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 3,
          useGrouping: false  // Remove separador de milhares
        }),                   // qtd (quantidade com vírgula decimal)
        '',                   // tab vazio
        d.unidade_medida,     // umr (KG, G, etc)
        '',                   // tab vazio
        '',                   // tab vazio (Y84 já preenchido aqui)
        '600',                // centro
        '',                   // tab vazio
        '',                   // tab vazio
        'PES',                // pes
        '',                   // tab vazio
        'PES',                // pes
        '9000',               // 9000
      ].join('\t');
    });

    const text = lines.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedMIGO(true);
      setTimeout(() => setCopiedMIGO(false), 2000);
    });
  };

  // Copy selected rows for Lote bloqueio transaction
  const handleCopyLote = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) return;

    const lotes = selectedRows.map((row) => row.original.lote);
    const text = lotes.join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopiedLote(true);
      setTimeout(() => setCopiedLote(false), 2000);
    });
  };

  // Clear all filters
  const handleClearFilters = () => {
    setColumnFilters([]);
    setGlobalFilter('');
    setRowSelection({});
    setNivelFilter(null);
  };

  const hasActiveFilters = columnFilters.length > 0 || globalFilter !== '' || nivelFilter !== null;
  const selectedCount = Object.keys(rowSelection).length;
  const filteredCount = table.getFilteredRowModel().rows.length;

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-background shrink-0 flex-wrap">
        <Button
          variant={analysisMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setAnalysisMode(!analysisMode);
            if (analysisMode) setNivelFilter(null); // Resetar filtro ao sair do modo análise
          }}
          className={cn(analysisMode && 'bg-orange-500 hover:bg-orange-600 text-white')}
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          Analisar Residuais
        </Button>

        {nivelFilter && (
          <Badge variant="secondary" className="flex items-center gap-1">
            Filtro: {nivelFilter}
            <button
              onClick={() => setNivelFilter(null)}
              className="ml-1 hover:bg-black/10 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}

        <div className="flex-1 relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Busca global..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9 h-8"
          />
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            <X className="h-4 w-4 mr-1" />
            Limpar filtros
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleCopySelected}
          disabled={selectedCount === 0}
        >
          <Copy className="h-4 w-4 mr-2" />
          {copied ? 'Copiado!' : `Copiar ${selectedCount > 0 ? selectedCount : ''} selecionados`}
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={handleCopyMIGO}
          disabled={selectedCount === 0}
          className="bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white border-0 shadow-md hover:shadow-lg transition-all duration-300"
        >
          <Copy className="h-4 w-4 mr-2" />
          {copiedMIGO ? 'Copiado MIGO!' : 'MIGO'}
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={handleCopyLote}
          disabled={selectedCount === 0}
          className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white border-0 shadow-md hover:shadow-lg transition-all duration-300"
        >
          <Copy className="h-4 w-4 mr-2" />
          {copiedLote ? 'Copiado Lote!' : 'Lote'}
        </Button>

        <Badge variant="outline" className="shrink-0">
          {filteredCount} de {displayData.length} registros
        </Badge>
      </div>

      {/* Analysis stats bar */}
      {analysisMode && (
        <div className="flex items-center gap-4 px-4 py-1.5 border-b bg-muted/30 text-xs shrink-0 flex-wrap">
          <span className="font-medium">Residuais PES:</span>
          <button
            onClick={() => setNivelFilter(nivelFilter === 'verde' ? null : 'verde')}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors",
              nivelFilter === 'verde' && "bg-green-100 dark:bg-green-900/30 ring-1 ring-green-500"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Verdes: <strong>{analysisStats.verdes}</strong>
          </button>
          <button
            onClick={() => setNivelFilter(nivelFilter === 'amarelo' ? null : 'amarelo')}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors",
              nivelFilter === 'amarelo' && "bg-yellow-100 dark:bg-yellow-900/30 ring-1 ring-yellow-500"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            Amarelos: <strong>{analysisStats.amarelos}</strong>
          </button>
          <button
            onClick={() => setNivelFilter(nivelFilter === 'vermelho' ? null : 'vermelho')}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors",
              nivelFilter === 'vermelho' && "bg-red-100 dark:bg-red-900/30 ring-1 ring-red-500"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Vermelhos: <strong>{analysisStats.vermelhos}</strong>
          </button>
          <span className="border-l pl-4 ml-2">
            Total: <strong>{analysisStats.total}</strong>
          </span>
          <span className="border-l pl-4 ml-2 text-purple-700 dark:text-purple-400">
            Valor:{' '}
            <strong>
              {analysisStats.valorTotal.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </strong>
          </span>
        </div>
      )}

      {/* Table container */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-20">
            {/* Header row */}
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      'whitespace-nowrap text-xs px-2',
                      header.column.getCanSort() && 'cursor-pointer select-none hover:bg-muted/50'
                    )}
                    style={{ width: header.getSize() }}
                    onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <div className="flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && <SortIcon column={header.column} />}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
            {/* Filter row */}
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              {table.getHeaderGroups()[0]?.headers.map((header) => {
                const filterType = COLUMN_FILTER_TYPES[header.column.id] || 'none';
                return (
                  <TableHead key={`filter-${header.id}`} className="py-1 px-1">
                    {header.column.getCanFilter() && filterType !== 'none' ? (
                      <ColumnFilterWidget
                        column={header.column}
                        table={table}
                        filterType={filterType}
                      />
                    ) : null}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center text-muted-foreground py-12"
                >
                  Nenhum registro encontrado
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  className={cn(
                    'text-xs',
                    row.getIsSelected() && 'bg-blue-50 dark:bg-blue-950/30',
                    analysisMode && row.original.is_residual && 'border-l-4',
                    analysisMode && row.original.nivel === 'vermelho' && 'border-l-red-500 bg-red-50/30 dark:bg-red-950/10',
                    analysisMode && row.original.nivel === 'amarelo' && 'border-l-yellow-500 bg-yellow-50/30 dark:bg-yellow-950/10',
                    analysisMode && row.original.nivel === 'verde' && 'border-l-green-500 bg-green-50/30 dark:bg-green-950/10',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-2 py-1.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
