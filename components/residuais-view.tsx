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

interface ResiduaisViewProps {
  agingData: AgingData[];
  valores: Record<string, number>;
  remessas: RemessaData[];
  configResiduais: ConfiguracaoResiduais;
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
  ultimo_movimento: 'text',
  tipo_estoque: 'select',
  remessas_abertas: 'range',
  nivel: 'select',
  eh_lote_unico: 'select',
};

export function ResiduaisView({ agingData, valores, remessas, configResiduais }: ResiduaisViewProps) {
  const [analysisMode, setAnalysisMode] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [copied, setCopied] = useState(false);

  // Enriched data
  const tableData: AgingTableRow[] = useMemo(() => {
    return enriquecerAgingComAnalise(agingData, configResiduais, valores, remessas);
  }, [agingData, configResiduais, valores, remessas]);

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
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<string>()}</span>
        ),
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
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<string>()}</span>
        ),
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
          if (dias > 90) badgeClass = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
          else if (dias > 60) badgeClass = 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
          else if (dias > 30) badgeClass = 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
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
        cell: ({ getValue }) => {
          const count = getValue<number>();
          if (count === 0) return <span className="text-muted-foreground text-center block">-</span>;
          return (
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              <Package className="h-3 w-3 mr-1" />
              {count}
            </Badge>
          );
        },
        filterFn: numberRangeFilter,
        size: 90,
      },
      // Analysis-only columns
      {
        accessorKey: 'nivel',
        header: 'Nivel',
        cell: ({ getValue }) => {
          const nivel = getValue<NivelResidual | undefined>();
          if (!nivel) return <span className="text-muted-foreground text-center block">-</span>;
          const nivelConfig: Record<NivelResidual, { bg: string; icon: React.ReactNode }> = {
            verde: { bg: 'bg-green-500 hover:bg-green-600', icon: <CheckCircle className="h-3 w-3" /> },
            amarelo: { bg: 'bg-yellow-500 hover:bg-yellow-600', icon: <AlertTriangle className="h-3 w-3" /> },
            vermelho: { bg: 'bg-red-500 hover:bg-red-600', icon: <AlertCircle className="h-3 w-3" /> },
          };
          const c = nivelConfig[nivel];
          return (
            <Badge className={cn(c.bg, 'text-white gap-1')}>
              {c.icon}
              {nivel}
            </Badge>
          );
        },
        size: 100,
      },
      {
        accessorKey: 'eh_lote_unico',
        header: 'Lote Unico',
        cell: ({ getValue, row }) => {
          if (row.original.deposito !== 'PES') return <span className="text-muted-foreground text-center block">-</span>;
          const val = getValue<boolean>();
          if (val) {
            return (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                Unico
              </Badge>
            );
          }
          return <span className="text-muted-foreground text-center block">-</span>;
        },
        filterFn: (row, columnId, filterValue) => {
          if (filterValue === undefined) return true;
          const val = row.getValue<boolean>(columnId);
          return filterValue === 'true' ? val === true : val === false;
        },
        size: 90,
      },
    ],
    []
  );

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      globalFilter,
      columnVisibility: {
        nivel: analysisMode,
        eh_lote_unico: analysisMode,
      },
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

  // Clear all filters
  const handleClearFilters = () => {
    setColumnFilters([]);
    setGlobalFilter('');
    setRowSelection({});
  };

  const hasActiveFilters = columnFilters.length > 0 || globalFilter !== '';
  const selectedCount = Object.keys(rowSelection).length;
  const filteredCount = table.getFilteredRowModel().rows.length;

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-background shrink-0 flex-wrap">
        <Button
          variant={analysisMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => setAnalysisMode(!analysisMode)}
          className={cn(analysisMode && 'bg-orange-500 hover:bg-orange-600 text-white')}
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          Analisar Residuais
        </Button>

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

        <Badge variant="outline" className="shrink-0">
          {filteredCount} de {tableData.length} registros
        </Badge>
      </div>

      {/* Analysis stats bar */}
      {analysisMode && (
        <div className="flex items-center gap-4 px-4 py-1.5 border-b bg-muted/30 text-xs shrink-0 flex-wrap">
          <span className="font-medium">Residuais PES:</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Verdes: <strong>{analysisStats.verdes}</strong>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            Amarelos: <strong>{analysisStats.amarelos}</strong>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Vermelhos: <strong>{analysisStats.vermelhos}</strong>
          </span>
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
