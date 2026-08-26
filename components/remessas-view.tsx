'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type RowSelectionState,
  type PaginationState,
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
  Copy,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Package,
} from 'lucide-react';
import { RemessaData } from '@/types/aging';
import { cn, copyToClipboard } from '@/lib/utils';

// Custom filter for numeric range [min, max]
const numberRangeFilter: FilterFn<RemessaData> = (row, columnId, filterValue) => {
  const val = row.getValue<number>(columnId);
  const [min, max] = filterValue as [number | undefined, number | undefined];
  if (min !== undefined && val < min) return false;
  if (max !== undefined && val > max) return false;
  return true;
};

// Custom filter for date range [start, end]
const dateRangeFilter: FilterFn<RemessaData> = (row, columnId, filterValue) => {
  const dateStr = row.getValue<string>(columnId);
  if (!dateStr) return false;

  const [startDate, endDate] = filterValue as [string | undefined, string | undefined];
  if (!startDate && !endDate) return true;

  // Parse date in DD/MM/YYYY format
  const parseDateStr = (str: string): Date | null => {
    const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const [, day, month, year] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  };

  const rowDate = parseDateStr(dateStr);
  if (!rowDate) return false;

  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    if (rowDate < start) return false;
  }

  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    if (rowDate > end) return false;
  }

  return true;
};

interface RemessasViewProps {
  remessas: RemessaData[];
  materialFilter?: string;
}

// Column filter widget
function ColumnFilterWidget({
  column,
  table,
  filterType,
}: {
  column: Column<RemessaData, unknown>;
  table: TanstackTable<RemessaData>;
  filterType: 'text' | 'select' | 'range' | 'date';
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

  if (filterType === 'date') {
    const currentFilter = column.getFilterValue() as [string | undefined, string | undefined] | undefined;
    return (
      <div className="flex gap-1">
        <Input
          type="date"
          placeholder="De"
          className="h-7 text-xs w-[110px]"
          value={currentFilter?.[0] ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            column.setFilterValue((old: [string | undefined, string | undefined] | undefined) => [
              val || undefined,
              old?.[1],
            ]);
          }}
        />
        <Input
          type="date"
          placeholder="Até"
          className="h-7 text-xs w-[110px]"
          value={currentFilter?.[1] ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            column.setFilterValue((old: [string | undefined, string | undefined] | undefined) => [
              old?.[0],
              val || undefined,
            ]);
          }}
        />
      </div>
    );
  }

  return null;
}

// Sort icon
function SortIcon({ column }: { column: Column<RemessaData, unknown> }) {
  const sorted = column.getIsSorted();
  if (sorted === 'asc') return <ArrowUp className="h-3 w-3" />;
  if (sorted === 'desc') return <ArrowDown className="h-3 w-3" />;
  return <ArrowUpDown className="h-3 w-3 opacity-30" />;
}

// Filter type map per column
type FilterType = 'text' | 'select' | 'range' | 'date' | 'none';

const COLUMN_FILTER_TYPES: Record<string, FilterType> = {
  select: 'none',
  numero_remessa: 'text',
  item: 'text',
  material: 'text',
  descricao_material: 'text',
  centro: 'select',
  deposito: 'select',
  quantidade: 'range',
  unidade_medida: 'select',
  data_disponibilidade: 'date',
  data_picking: 'date',
  peso_total_remessa: 'range',
};

export function RemessasView({ remessas, materialFilter }: RemessasViewProps) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });
  const [copied, setCopied] = useState(false);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);

  // Aplicar filtro de material se fornecido
  useEffect(() => {
    if (materialFilter) {
      setColumnFilters([{ id: 'material', value: materialFilter }]);
    } else {
      setColumnFilters([]);
    }
  }, [materialFilter]);

  // Função para copiar texto ao clicar
  const handleCopyText = async (text: string, cellId: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedCell(cellId);
      setTimeout(() => setCopiedCell(null), 1500);
    }
  };

  // Column definitions
  const columns: ColumnDef<RemessaData, unknown>[] = useMemo(
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
        accessorKey: 'numero_remessa',
        header: 'Nº Remessa',
        cell: ({ getValue, row }) => {
          const numero = getValue<string>();
          const cellId = `remessa-${row.id}`;
          const isCopied = copiedCell === cellId;
          return (
            <button
              onClick={() => handleCopyText(numero, cellId)}
              className={cn(
                "font-mono text-xs px-2 py-1 rounded transition-all cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 text-left w-full",
                isCopied && "bg-green-100 dark:bg-green-900/30"
              )}
              title="Clique para copiar"
            >
              {numero}
              {isCopied && <Copy className="inline-block ml-1 h-3 w-3 text-green-600" />}
            </button>
          );
        },
        size: 130,
      },
      {
        accessorKey: 'item',
        header: 'Item',
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<string>()}</span>
        ),
        size: 60,
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
        accessorKey: 'descricao_material',
        header: 'Descrição',
        cell: ({ getValue }) => (
          <span className="truncate block max-w-[200px]" title={getValue<string>()}>
            {getValue<string>()}
          </span>
        ),
        size: 200,
      },
      {
        accessorKey: 'quantidade',
        header: 'Quantidade',
        cell: ({ getValue }) => {
          const raw = getValue<number | string>();
          const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.')) || 0;
          return (
            <span className="text-right block font-semibold font-mono">
              {num.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 3,
              })}
            </span>
          );
        },
        filterFn: numberRangeFilter,
        size: 110,
      },
      {
        accessorKey: 'unidade_medida',
        header: 'UMB',
        size: 60,
      },
      {
        accessorKey: 'centro',
        header: 'Centro',
        size: 70,
      },
      {
        accessorKey: 'deposito',
        header: 'Depósito',
        size: 80,
      },
      {
        accessorKey: 'data_disponibilidade',
        header: 'Data Disponib.',
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">{getValue<string>()}</span>
        ),
        filterFn: dateRangeFilter,
        size: 110,
      },
      {
        accessorKey: 'data_picking',
        header: 'Data Picking',
        cell: ({ getValue }) => {
          const data = getValue<string | undefined>();
          if (!data) return <span className="text-muted-foreground text-center block">-</span>;
          return <span className="text-xs text-muted-foreground">{data}</span>;
        },
        filterFn: dateRangeFilter,
        size: 110,
      },
      {
        accessorKey: 'peso_total_remessa',
        header: 'Peso Total',
        cell: ({ getValue }) => {
          const raw = getValue<number | string | undefined>();
          if (raw === undefined || raw === null || raw === '') return <span className="text-muted-foreground text-center block">-</span>;
          const peso = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
          if (isNaN(peso)) return <span className="text-muted-foreground text-center block">-</span>;
          return (
            <span className="text-right block font-mono">
              {peso.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
            </span>
          );
        },
        filterFn: numberRangeFilter,
        size: 110,
      },
    ],
    [copiedCell]
  );

  const table = useReactTable({
    data: remessas,
    columns,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
    filterFns: {
      numberRange: numberRangeFilter,
      dateRange: dateRangeFilter,
    },
  });

  // Copy selected rows as tab-separated values
  const handleCopySelected = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) return;

    const headers = table.getAllColumns()
      .filter(col => col.id !== 'select' && col.getIsVisible())
      .map(col => col.columnDef.header)
      .join('\t');

    const rows = selectedRows.map(row => {
      return table.getAllColumns()
        .filter(col => col.id !== 'select' && col.getIsVisible())
        .map(col => {
          const cellValue = row.getValue(col.id);
          if (typeof cellValue === 'number') {
            return cellValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
          }
          return cellValue != null ? String(cellValue) : '';
        })
        .join('\t');
    }).join('\n');

    const text = `${headers}\n${rows}`;
    copyToClipboard(text).then((success) => {
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
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
  const totalPages = table.getPageCount();
  const currentPage = table.getState().pagination.pageIndex + 1;

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-background shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-[#1B3550] border border-[#2A4D6E] text-[#AEE4FF]">
            <Package className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Remessas Abertas</h2>
        </div>

        {materialFilter && (
          <Badge className="flex items-center gap-1.5 bg-[#1B3550] hover:bg-[#234465] text-[#AEE4FF] border border-[#2A4D6E] text-xs font-semibold px-2.5 py-1 rounded-lg shadow-xs">
            Material: <span className="font-mono font-bold text-white">{materialFilter}</span>
            <button
              onClick={() => setColumnFilters(columnFilters.filter(f => f.id !== 'material'))}
              className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors"
              title="Remover filtro"
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
          className="bg-[#1B3550] border-[#2A4D6E] text-[#AEE4FF] hover:bg-[#234465] hover:text-white font-bold"
        >
          <Copy className="h-4 w-4 mr-2" />
          {copied ? 'Copiado!' : `Copiar ${selectedCount > 0 ? selectedCount : ''} selecionados`}
        </Button>

        <Badge variant="outline" className="shrink-0 bg-[#1B3550] text-[#AEE4FF] border-[#2A4D6E] text-xs font-mono font-bold px-2.5 py-1 rounded-lg">
          {filteredCount} de {remessas.length} registros
        </Badge>
      </div>

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
                  className="h-24 text-center text-muted-foreground"
                >
                  Nenhuma remessa encontrada.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-2 py-1.5 text-xs">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-background shrink-0 text-xs gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>Linhas por página:</span>
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(val) => {
              table.setPageSize(Number(val));
            }}
          >
            <SelectTrigger className="h-7 w-[70px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="250">250</SelectItem>
              <SelectItem value="500">500</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-2">
            Mostrando {filteredCount === 0 ? 0 : table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} a{' '}
            {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredCount)} de {filteredCount}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            Página {totalPages === 0 ? 0 : currentPage} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              title="Primeira página"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              title="Página anterior"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              title="Próxima página"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              title="Última página"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
