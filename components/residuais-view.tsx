'use client';

import { useMemo, useState } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Package,
  ArrowRightLeft,
  Loader2,
  Play,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { AgingData, RemessaData, ConfiguracaoResiduais, AgingTableRow, NivelResidual } from '@/types/aging';
import { enriquecerAgingComAnalise } from '@/lib/residuais-analyzer';
import { cn, copyToClipboard } from '@/lib/utils';

// Helper para gerar o VBScript dinâmico de bloqueio MIGO (Y84) para o SAP GUI em documento único
export interface BloquearItemParam {
  material: string;
  lote: string;
  quantidade: string;
  unidade: string;
  descricao?: string;
}

export function generateBloquearMigoVbs(items: BloquearItemParam[]): string {
  if (items.length === 0) return '';

  const vbsHeader = `If Not IsObject(application) Then
   Set SapGuiAuto  = GetObject("SAPGUI")
   Set application = SapGuiAuto.GetScriptingEngine
End If
If Not IsObject(connection) Then
   Set connection = application.Children(0)
End If
If Not IsObject(session) Then
   Set session    = connection.Children(0)
End If
If IsObject(WScript) Then
   WScript.ConnectObject session,     "on"
   WScript.ConnectObject application, "on"
End If
session.findById("wnd[0]").maximize
session.findById("wnd[0]/tbar[0]/okcd").text = "/nmigo"
session.findById("wnd[0]").sendVKey 0
`;

  // Preenche Código do Material (MAKTX)
  const maktxLines = items.map((item, idx) => {
    const mat = item.material.trim();
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-MAKTX[1,${idx}]").text = "${mat}"`;
  }).join('\n');

  // Preenche Quantidade (ERFMG)
  const erfmgLines = items.map((item, idx) => {
    const qtd = item.quantidade.trim();
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/txtGOITEM-ERFMG[3,${idx}]").text = "${qtd}"`;
  }).join('\n');

  // Preenche Unidade de Medida (ERFME)
  const erfmeLines = items.map((item, idx) => {
    const unit = (item.unidade.trim() || 'KG').toUpperCase();
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-ERFME[5,${idx}]").text = "${unit}"`;
  }).join('\n');

  // Preenche Depósito Origem (LGOBE) = "PES"
  const lgobeLines = items.map((_, idx) => {
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-LGOBE[12,${idx}]").text = "PES"`;
  }).join('\n');

  // Preenche Centro (NAME1) = "600"
  const name1Lines = items.map((_, idx) => {
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-NAME1[9,${idx}]").text = "600"`;
  }).join('\n');

  // Preenche Depósito Destino (UMLGOBE) = "PES"
  const umlgobeLines = items.map((_, idx) => {
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-UMLGOBE[14,${idx}]").text = "PES"`;
  }).join('\n');

  // Preenche Motivo (GRUND) = "9000"
  const grundLines = items.map((_, idx) => {
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-GRUND[15,${idx}]").text = "9000"`;
  }).join('\n');

  // Validação da Grade via Enter no primeiro item
  const validateGrid = `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-MAKTX[1,0]").setFocus
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-MAKTX[1,0]").caretPosition = 0
session.findById("wnd[0]").sendVKey 0
`;

  // Preenche Lotes (CHARG)
  const chargLines = items.map((item, idx) => {
    const lote = item.lote.trim();
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-CHARG[2,${idx}]").text = "${lote}"`;
  }).join('\n');

  // Gravação, Transfer Order (/nlt06, btn[44]) e retorno (/n)
  const vbsFooter = `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-CHARG[2,0]").setFocus
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-CHARG[2,0]").caretPosition = 0
session.findById("wnd[0]/tbar[1]/btn[7]").press
session.findById("wnd[0]/tbar[1]/btn[23]").press
session.findById("wnd[0]/tbar[0]/okcd").text = "/nlt06"
session.findById("wnd[0]").sendVKey 0
session.findById("wnd[0]").sendVKey 0
session.findById("wnd[0]/tbar[1]/btn[44]").press
session.findById("wnd[0]/tbar[0]/okcd").text = "/n"
session.findById("wnd[0]").sendVKey 0
`;

  return [
    vbsHeader,
    maktxLines,
    erfmgLines,
    erfmeLines,
    lgobeLines,
    name1Lines,
    umlgobeLines,
    grundLines,
    validateGrid,
    chargLines,
    vbsFooter,
  ].filter(Boolean).join('\n');
}

// Custom filter for numeric range [min, max]
const numberRangeFilter: FilterFn<AgingTableRow> = (row, columnId, filterValue) => {
  const val = row.getValue<number>(columnId);
  const [min, max] = filterValue as [number | undefined, number | undefined];
  if (min !== undefined && val < min) return false;
  if (max !== undefined && val > max) return false;
  return true;
};

// Custom filter for single select
const exactSelectFilter: FilterFn<AgingTableRow> = (row, columnId, filterValue) => {
  if (filterValue === undefined || filterValue === '__all__') return true;
  const val = row.getValue<any>(columnId);
  const normalized = val != null ? String(val).trim().toUpperCase() : '';

  if (filterValue === '__empty__') {
    return normalized === '';
  }

  return normalized === String(filterValue).trim().toUpperCase();
};

import { LoteInvestigacao, addLoteInvestigacao, removeLoteInvestigacao, triggerSapAutomation, checkSapAutomationStatus } from '@/lib/api';
import toast from 'react-hot-toast';

// Helper para resolver o status de aging/residual de um item (Normal < 7d, Alerta 7-19d, Crítico >= 20d)
function getItemStatusLabel(item: AgingTableRow, config?: ConfiguracaoResiduais, isAnalysis = false): string {
  const diasAlerta = config?.dias_alerta ?? 7;
  const diasCritico = config?.dias_critico ?? 20;

  // Quando o modo de análise de residuais estiver explicitamente ativo, utiliza a criticidade residual do lote
  if (isAnalysis && item.is_residual && item.nivel) {
    const nivelLabelMap: Record<string, string> = {
      verde: 'Normal',
      amarelo: 'Alerta',
      vermelho: 'Crítico',
    };
    return nivelLabelMap[item.nivel] || 'Normal';
  }

  // Na tabela geral, obedece estritamente à faixa de dias de aging
  const dias = item.dias_aging ?? 0;
  if (dias >= diasCritico) return 'Crítico';
  if (dias >= diasAlerta) return 'Alerta';
  return 'Normal';
}

// Custom filter for aging status
const statusAgingFilter: FilterFn<AgingTableRow> = (row, columnId, filterValue) => {
  if (!filterValue || filterValue === '__all__') return true;
  const item = row.original;
  const status = getItemStatusLabel(item);
  return status === filterValue;
};

const tipoEstoqueFilter: FilterFn<AgingTableRow> = (row, columnId, filterValue) => {
  if (!filterValue || filterValue === '__all__') return true;

  const raw = row.getValue<string | null | undefined>(columnId);
  const normalized = (raw ?? '').trim().toUpperCase();

  if (filterValue === '__empty__') {
    return normalized === '';
  }

  return normalized === String(filterValue).trim().toUpperCase();
};

interface ResiduaisViewProps {
  agingData: AgingData[];
  allData?: AgingData[];
  valores: Record<string, number>;
  remessas: RemessaData[];
  configResiduais: ConfiguracaoResiduais;
  onNavigateToRemessas?: (material: string) => void;
  lotesInvestigacao?: LoteInvestigacao[];
  onInvestigacaoChange?: () => void;
  currentUserEmail?: string;
  selectedCriticality?: string | null;
  onCriticalityChange?: (crit: string | null) => void;
  onAtualizarDb?: () => void;
  isAtualizandoDb?: boolean;
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

    if (column.id === 'tipo_estoque') {
      return (
        <Select
          value={(column.getFilterValue() as string) ?? '__all__'}
          onValueChange={(v) => {
            if (v === '__all__') {
              column.setFilterValue(undefined);
              return;
            }
            column.setFilterValue(v);
          }}
        >
          <SelectTrigger className="h-7 text-xs min-w-[70px]" size="sm">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="S">S</SelectItem>
            <SelectItem value="__empty__">Vazio</SelectItem>
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

export function ResiduaisView({
  agingData,
  allData,
  valores,
  remessas,
  configResiduais,
  onNavigateToRemessas,
  lotesInvestigacao = [],
  onInvestigacaoChange,
  currentUserEmail,
  selectedCriticality,
  onCriticalityChange,
  onAtualizarDb,
  isAtualizandoDb,
}: ResiduaisViewProps) {
  const [analysisMode, setAnalysisMode] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });
  const [copied, setCopied] = useState(false);
  const [copiedMIGO, setCopiedMIGO] = useState(false);
  const [copiedLote, setCopiedLote] = useState(false);
  const [copiedDevolver, setCopiedDevolver] = useState(false);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [nivelFilter, setNivelFilter] = useState<NivelResidual | null>(null);
  const [devolverOpen, setDevolverOpen] = useState(false);
  const [devolverMaterial, setDevolverMaterial] = useState('');
  const [devolverLote, setDevolverLote] = useState('');
  const [devolverQuantidade, setDevolverQuantidade] = useState('1');
  const [devolverItemCount, setDevolverItemCount] = useState('1');
  const [isApplyingInvestigacao, setIsApplyingInvestigacao] = useState(false);
  const [isMoverAjusteRunning, setIsMoverAjusteRunning] = useState(false);
  const [moverAjusteConfirmOpen, setMoverAjusteConfirmOpen] = useState(false);
  const [bloquearMigoOpen, setBloquearMigoOpen] = useState(false);
  const [bloquearSelectedItems, setBloquearSelectedItems] = useState<BloquearItemParam[]>([]);
  const [isBloquearMigoRunning, setIsBloquearMigoRunning] = useState(false);

  const lotesInvestigacaoSet = useMemo(() => {
    return new Set(lotesInvestigacao.map((item) => item.lote.trim().toUpperCase()));
  }, [lotesInvestigacao]);

  // Função para copiar texto ao clicar
  const handleCopyText = async (text: string, cellId: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedCell(cellId);
      setTimeout(() => setCopiedCell(null), 1500);
    }
  };

  // Enriched data
  const tableData: AgingTableRow[] = useMemo(() => {
    const isTrZoneActive = selectedCriticality && (
      selectedCriticality.toLowerCase() === 'tr-zone' ||
      selectedCriticality.toLowerCase() === 'trzone' ||
      selectedCriticality.toLowerCase() === 'negativo' ||
      selectedCriticality.toLowerCase() === 'tr-zone negativo'
    );
    const sourceData = (isTrZoneActive && allData && allData.length > 0) ? allData : agingData;
    return enriquecerAgingComAnalise(sourceData, configResiduais, valores, remessas);
  }, [agingData, allData, selectedCriticality, configResiduais, valores, remessas]);

  // Filtered data based on analysis mode, local nivel filter, and top card selectedCriticality
  const displayData: AgingTableRow[] = useMemo(() => {
    let filtered = tableData;
    
    // Filtrar por modo de análise (apenas residuais)
    if (analysisMode) {
      filtered = filtered.filter(item => item.is_residual);
    }
    
    // Filtrar por nível (se houver filtro ativo na barra de ferramentas)
    if (nivelFilter) {
      filtered = filtered.filter(item => item.nivel === nivelFilter);
    }

    // Filtrar por criticidade / nível vindo dos cards do topo
    if (selectedCriticality) {
      const diasAlerta = configResiduais?.dias_alerta ?? 7;
      const diasCritico = configResiduais?.dias_critico ?? 20;

      const crit = selectedCriticality.toLowerCase();
      if (crit === 'tr-zone' || crit === 'trzone' || crit === 'negativo' || crit === 'tr-zone negativo') {
        filtered = filtered.filter(item => {
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
        });
      } else if (crit === 'normal' || crit === 'verde') {
        filtered = filtered.filter(item => {
          if (analysisMode && item.is_residual) {
            return item.nivel === 'verde';
          }
          const dias = item.dias_aging || 0;
          return dias < diasAlerta;
        });
      } else if (crit === 'alerta' || crit === 'amarelo') {
        filtered = filtered.filter(item => {
          if (analysisMode && item.is_residual) {
            return item.nivel === 'amarelo';
          }
          const dias = item.dias_aging || 0;
          return dias >= diasAlerta && dias < diasCritico;
        });
      } else if (crit === 'critico' || crit === 'crítico' || crit === 'vermelho') {
        filtered = filtered.filter(item => {
          if (analysisMode && item.is_residual) {
            return item.nivel === 'vermelho';
          }
          const dias = item.dias_aging || 0;
          return dias >= diasCritico;
        });
      }
    }
    
    return filtered;
  }, [tableData, analysisMode, nivelFilter, selectedCriticality, configResiduais]);

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
        header: 'Descrição',
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
          const isInvestigando = lotesInvestigacaoSet.has(lote.trim().toUpperCase());
          return (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleCopyText(lote, cellId)}
                className={cn(
                  "font-mono text-xs px-2 py-1 rounded transition-all cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 text-left",
                  isCopied && "bg-green-100 dark:bg-green-900/30"
                )}
                title="Clique para copiar"
              >
                {lote}
                {isCopied && <Copy className="inline-block ml-1 h-3 w-3 text-green-600" />}
              </button>
              {isInvestigando && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20 whitespace-nowrap" title="Lote sob investigação">
                  Inv.
                </span>
              )}
            </div>
          );
        },
        size: 130,
      },
      {
        accessorKey: 'centro',
        header: 'Centro',
        cell: ({ getValue }) => {
          const val = getValue<string>();
          return val ? String(val).replace(/\.0$/, '') : '-';
        },
        size: 70,
      },
      {
        accessorKey: 'deposito',
        header: 'Depósito',
        size: 80,
      },
      {
        accessorKey: 'tipo_deposito',
        header: 'Tipo Dep.',
        size: 80,
      },
      {
        accessorKey: 'posicao_deposito',
        header: 'Posição',
        size: 90,
      },
      {
        accessorKey: 'estoque_disponivel',
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
            <span className="text-right block font-semibold text-emerald-600 dark:text-emerald-400">
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
          const dias = getValue<number | null>();
          if (dias === null) return <span className="text-muted-foreground text-right block">-</span>;
          return (
            <span className={cn(
              "text-right block font-medium",
              dias > 365 ? "text-red-600 dark:text-red-400" :
              dias > 180 ? "text-yellow-600 dark:text-yellow-400" :
              "text-green-600 dark:text-green-400"
            )}>
              {dias}
            </span>
          );
        },
        filterFn: numberRangeFilter,
        size: 90,
      },
      {
        id: 'status_aging',
        header: 'Status',
        accessorFn: (row) => getItemStatusLabel(row, configResiduais, analysisMode),
        cell: ({ row }) => {
          const item = row.original;
          const status = getItemStatusLabel(item, configResiduais, analysisMode);

          if (status === 'Crítico') {
            return (
              <Badge className="bg-[#E75B5B]/15 text-[#E75B5B] border border-[#E75B5B]/30 hover:bg-[#E75B5B]/25 gap-1 font-bold text-[11px] px-2 py-0.5 rounded-lg whitespace-nowrap">
                <AlertCircle className="h-3 w-3" />
                Crítico
              </Badge>
            );
          } else if (status === 'Alerta') {
            return (
              <Badge className="bg-[#E29A36]/15 text-[#E29A36] border border-[#E29A36]/30 hover:bg-[#E29A36]/25 gap-1 font-bold text-[11px] px-2 py-0.5 rounded-lg whitespace-nowrap">
                <AlertTriangle className="h-3 w-3" />
                Alerta
              </Badge>
            );
          } else {
            return (
              <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 gap-1 font-bold text-[11px] px-2 py-0.5 rounded-lg whitespace-nowrap">
                <CheckCircle className="h-3 w-3" />
                Normal
              </Badge>
            );
          }
        },
        filterFn: (row, columnId, filterValue) => {
          if (!filterValue || filterValue === '__all__') return true;
          const status = getItemStatusLabel(row.original, configResiduais, analysisMode);
          return status === filterValue;
        },
        size: 105,
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
        filterFn: tipoEstoqueFilter,
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
            <div className="relative group inline-flex justify-center">
              <Badge
                className="bg-[#1B3550] hover:bg-[#234465] active:bg-[#2A4D6E] text-[#AEE4FF] hover:text-white border border-[#2A4D6E] hover:border-[#AEE4FF]/60 shadow-xs shadow-black/30 cursor-pointer transition-all duration-200 hover:scale-105 font-bold px-2.5 py-1 rounded-lg gap-1.5"
                onClick={() => onNavigateToRemessas?.(material)}
                title="Clique para ver remessas deste material"
              >
                <Package className="h-3.5 w-3.5 text-[#AEE4FF] group-hover:scale-110 transition-transform" />
                <span className="font-mono text-xs">{count}</span>
              </Badge>
              <div className="absolute inset-0 bg-[#AEE4FF] opacity-0 group-hover:opacity-10 blur-sm transition-opacity duration-200 rounded-lg pointer-events-none" />
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
      statusAging: statusAgingFilter,
      tipoEstoque: tipoEstoqueFilter,
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
    copyToClipboard(text).then((success) => {
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
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
    copyToClipboard(text).then((success) => {
      if (success) {
        setCopiedMIGO(true);
        setTimeout(() => setCopiedMIGO(false), 2000);
      }
    });
  };

  // Copy selected rows for Lote bloqueio transaction
  const handleCopyLote = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) return;

    const lotes = selectedRows.map((row) => row.original.lote);
    const text = lotes.join('\n');

    copyToClipboard(text).then((success) => {
      if (success) {
        setCopiedLote(true);
        setTimeout(() => setCopiedLote(false), 2000);
      }
    });
  };

  // Dispara a execução do script movermigo no SAP via Planilha Sync
  const handleConfirmMoverAjuste = async () => {
    setMoverAjusteConfirmOpen(false);
    setIsMoverAjusteRunning(true);
    const toastId = toast.loading('Enviando solicitação movermigo para o Planilha Sync...');

    try {
      const res = await triggerSapAutomation('movermigo', currentUserEmail || 'Dashboard');
      if (!res.success || !res.job) {
        toast.error(`Falha ao disparar automação: ${res.error || 'Erro desconhecido'}`, { id: toastId });
        setIsMoverAjusteRunning(false);
        return;
      }

      const jobId = res.job.id;
      toast.loading('Aguardando execução do script movermigo no SAP GUI...', { id: toastId });

      let attempts = 0;
      const maxAttempts = 30; // até 60s
      const interval = setInterval(async () => {
        attempts++;
        try {
          const statusJob = await checkSapAutomationStatus(jobId);
          if (statusJob?.status === 'completed') {
            clearInterval(interval);
            setIsMoverAjusteRunning(false);
            toast.success('Script movermigo executado com sucesso no SAP!', { id: toastId, icon: '🚀' });
          } else if (statusJob?.status === 'failed') {
            clearInterval(interval);
            setIsMoverAjusteRunning(false);
            toast.error(`Execução no SAP falhou: ${statusJob.result_message || 'Erro no script'}`, { id: toastId });
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            setIsMoverAjusteRunning(false);
            toast('Tempo limite aguardando o Planilha Sync. Verifique se o app está aberto.', { id: toastId, icon: '⚠️' });
          }
        } catch (e) {
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            setIsMoverAjusteRunning(false);
          }
        }
      }, 2000);
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`, { id: toastId });
      setIsMoverAjusteRunning(false);
    }
  };

  const handleOpenBloquearMigo = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) return;

    const items: BloquearItemParam[] = selectedRows.map((row) => {
      const selected = row.original;
      const quantidadeTabela = selected.estoque_disponivel.toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
        useGrouping: false,
      });
      return {
        material: selected.material,
        descricao: selected.texto_breve_material || '',
        lote: selected.lote,
        quantidade: quantidadeTabela,
        unidade: selected.unidade_medida?.toUpperCase() || 'KG',
      };
    });

    setBloquearSelectedItems(items);
    setBloquearMigoOpen(true);
  };

  const handleUpdateSingleBloquearItem = (field: keyof BloquearItemParam, value: string) => {
    setBloquearSelectedItems((prev) => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[0] = { ...updated[0], [field]: value };
      return updated;
    });
  };

  const handleConfirmBloquearMigo = async () => {
    if (bloquearSelectedItems.length === 0) return;

    const hasInvalid = bloquearSelectedItems.some(
      (it) => !it.material.trim() || !it.lote.trim() || !it.quantidade.trim()
    );
    if (hasInvalid) {
      toast.error('Preencha os campos obrigatórios (Material, Lote e Quantidade) de todos os itens');
      return;
    }

    setBloquearMigoOpen(false);
    setIsBloquearMigoRunning(true);
    const count = bloquearSelectedItems.length;
    const toastId = toast.loading(
      count === 1
        ? `Enviando bloqueio de ${bloquearSelectedItems[0].material} (Lote ${bloquearSelectedItems[0].lote}) para o Planilha Sync...`
        : `Enviando bloqueio sequencial de ${count} itens para o Planilha Sync...`
    );

    const vbsCode = generateBloquearMigoVbs(bloquearSelectedItems);

    try {
      const res = await triggerSapAutomation('bloquear_migo', currentUserEmail || 'Dashboard', vbsCode);
      if (!res.success || !res.job) {
        toast.error(`Falha ao disparar automação: ${res.error || 'Erro desconhecido'}`, { id: toastId });
        setIsBloquearMigoRunning(false);
        return;
      }

      const jobId = res.job.id;
      toast.loading(`Aguardando execução no SAP GUI (${count} item(ns))...`, { id: toastId });

      let attempts = 0;
      const maxAttempts = 60; // até 120s
      const interval = setInterval(async () => {
        attempts++;
        try {
          const statusJob = await checkSapAutomationStatus(jobId);
          if (statusJob?.status === 'completed') {
            clearInterval(interval);
            setIsBloquearMigoRunning(false);
            setRowSelection({});
            toast.success(
              count === 1
                ? `Bloqueio MIGO executado com sucesso no SAP para o lote ${bloquearSelectedItems[0].lote}!`
                : `Bloqueio MIGO de ${count} itens executado com sucesso no SAP!`,
              { id: toastId, icon: '🔒' }
            );
          } else if (statusJob?.status === 'failed') {
            clearInterval(interval);
            setIsBloquearMigoRunning(false);
            toast.error(`Execução no SAP falhou: ${statusJob.result_message || 'Erro no script'}`, { id: toastId });
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            setIsBloquearMigoRunning(false);
            toast('Tempo limite aguardando o Planilha Sync. Verifique se o app está aberto.', { id: toastId, icon: '⚠️' });
          }
        } catch (e) {
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            setIsBloquearMigoRunning(false);
          }
        }
      }, 2000);
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`, { id: toastId });
      setIsBloquearMigoRunning(false);
    }
  };

  const handleOpenDevolver = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length !== 1) return;

    const selected = selectedRows[0].original;
    const quantidadeTabela = selected.estoque_disponivel.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
      useGrouping: false,
    });

    setDevolverMaterial(selected.material);
    setDevolverLote(selected.lote);
    setDevolverQuantidade(quantidadeTabela);
    setDevolverItemCount('1');
    setDevolverOpen(true);
  };

  const handleConfirmDevolver = () => {
    const quantidade = devolverQuantidade.trim();
    const itemCount = devolverItemCount.trim();
    if (!quantidade || !itemCount) return;

    const text = [
      devolverMaterial,
      devolverLote,
      quantidade,
      itemCount,
      '1',
    ].join('\t');

    copyToClipboard(text).then((success) => {
      if (success) {
        setCopiedDevolver(true);
        setDevolverOpen(false);
        setTimeout(() => setCopiedDevolver(false), 2000);
      }
    });
  };

  // Toggle ou aplicar investigação nos lotes selecionados
  const handleToggleInvestigacaoSelected = async () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) return;

    setIsApplyingInvestigacao(true);
    try {
      // Se todos selecionados já estiverem em investigação, removemos. Caso contrário, adicionamos todos.
      const allAlreadyIn = selectedRows.every((r) =>
        lotesInvestigacaoSet.has(r.original.lote.trim().toUpperCase())
      );

      let successCount = 0;
      for (const row of selectedRows) {
        const lote = row.original.lote;
        const material = row.original.material;
        if (allAlreadyIn) {
          const ok = await removeLoteInvestigacao(lote);
          if (ok) successCount++;
        } else {
          const ok = await addLoteInvestigacao({
            lote,
            material,
            motivo: 'Marcado via tabela de Estoque/Residuais',
            created_by: currentUserEmail || 'user',
          });
          if (ok) successCount++;
        }
      }

      if (allAlreadyIn) {
        toast.success(`${successCount} lote(s) removido(s) de Investigação`);
      } else {
        toast.success(`${successCount} lote(s) definido(s) Em Investigação`);
      }

      setRowSelection({});
      onInvestigacaoChange?.();
    } catch (err) {
      console.error('Erro ao alternar investigação:', err);
      toast.error('Erro ao atualizar status de investigação');
    } finally {
      setIsApplyingInvestigacao(false);
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setColumnFilters([]);
    setGlobalFilter('');
    setRowSelection({});
    setNivelFilter(null);
    onCriticalityChange?.(null);
  };

  const hasActiveFilters = columnFilters.length > 0 || globalFilter !== '' || nivelFilter !== null || !!selectedCriticality;
  const selectedCount = Object.keys(rowSelection).length;
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const allSelectedAreInvestigando =
    selectedRows.length > 0 &&
    selectedRows.every((r) => lotesInvestigacaoSet.has(r.original.lote.trim().toUpperCase()));
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
          <Badge className="flex items-center gap-1 bg-[#1B3550] text-[#AEE4FF] border border-[#2A4D6E] text-xs font-semibold px-2.5 py-1 rounded-lg shadow-xs">
            Filtro: <span className="capitalize text-white font-bold">{nivelFilter}</span>
            <button
              onClick={() => setNivelFilter(null)}
              className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}

        {selectedCriticality && (
          <Badge className="flex items-center gap-1.5 bg-[#1B3550] text-[#AEE4FF] border border-[#2A4D6E] text-xs font-semibold px-2.5 py-1 rounded-lg shadow-xs">
            Status: <span className="capitalize text-white font-bold">{selectedCriticality}</span>
            <button
              onClick={() => onCriticalityChange?.(null)}
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
          className="bg-[#1B3550] border-[#2A4D6E] text-[#AEE4FF] hover:bg-[#234465] hover:text-white"
        >
          <Copy className="h-4 w-4 mr-2" />
          {copied ? 'Copiado!' : `Copiar ${selectedCount > 0 ? selectedCount : ''} selecionados`}
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={handleCopyMIGO}
          disabled={selectedCount === 0}
          className="bg-[#1B3550] border border-[#2A4D6E] hover:bg-[#234465] text-[#AEE4FF] hover:text-white shadow-md transition-all duration-300 font-bold"
        >
          <Copy className="h-4 w-4 mr-2" />
          {copiedMIGO ? 'Copiado MIGO!' : 'MIGO'}
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={handleCopyLote}
          disabled={selectedCount === 0}
          className="bg-[#1B3550] border border-[#2A4D6E] hover:bg-[#234465] text-[#AEE4FF] hover:text-white shadow-md transition-all duration-300 font-bold"
        >
          <Copy className="h-4 w-4 mr-2" />
          {copiedLote ? 'Copiado Lote!' : 'Lote'}
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={() => setMoverAjusteConfirmOpen(true)}
          disabled={isMoverAjusteRunning}
          className="bg-[#1B3550] border border-[#2A4D6E] hover:bg-[#234465] text-[#AEE4FF] hover:text-white shadow-md transition-all duration-300 font-bold gap-1.5"
          title="Executar script movermigo no SAP via Planilha Sync para transferir itens tipo S para 999/AJUSTE"
        >
          {isMoverAjusteRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-[#AEE4FF]" />
              <span>Executando SAP...</span>
            </>
          ) : (
            <>
              <ArrowRightLeft className="h-4 w-4 text-[#AEE4FF]" />
              <span>Mover/Ajuste</span>
            </>
          )}
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={handleOpenBloquearMigo}
          disabled={selectedCount === 0 || isBloquearMigoRunning}
          className="bg-[#1B3550] border border-[#2A4D6E] hover:bg-[#234465] text-[#AEE4FF] hover:text-white shadow-md transition-all duration-300 font-bold gap-1.5"
          title={selectedCount === 0 ? 'Selecione ao menos 1 item para Bloquear/MIGO' : `Executar bloqueio MIGO (Y84) de ${selectedCount} item(ns) no SAP via Planilha Sync`}
        >
          {isBloquearMigoRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-[#AEE4FF]" />
              <span>Bloqueando SAP...</span>
            </>
          ) : (
            <>
              <Lock className="h-4 w-4 text-[#AEE4FF]" />
              <span>Bloquear/MIGO{selectedCount > 1 ? ` (${selectedCount})` : ''}</span>
            </>
          )}
        </Button>

        {/* Botão discreto para Investigação dos selecionados */}
        <Button
          variant={allSelectedAreInvestigando ? 'destructive' : 'outline'}
          size="sm"
          onClick={handleToggleInvestigacaoSelected}
          disabled={selectedCount === 0 || isApplyingInvestigacao}
          className={cn(
            "transition-all duration-200 border-dashed text-xs",
            selectedCount > 0 && !allSelectedAreInvestigando && "border-[#E29A36]/60 bg-[#E29A36]/10 text-[#E29A36] hover:bg-[#E29A36] hover:text-[#13283E] font-bold",
            allSelectedAreInvestigando && "bg-[#E75B5B] text-white hover:bg-[#E75B5B]/80 border-0"
          )}
          title="Alternar status de investigação dos lotes selecionados"
        >
          {isApplyingInvestigacao ? (
            <span>Processando...</span>
          ) : allSelectedAreInvestigando ? (
            <span>Remover Investigação ({selectedCount})</span>
          ) : (
            <span>+ Investigação ({selectedCount > 0 ? selectedCount : ''})</span>
          )}
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={handleOpenDevolver}
          disabled={selectedCount !== 1}
          className="bg-[#E29A36] hover:bg-[#d48c2a] text-[#13283E] font-bold border-0 shadow-md transition-all duration-300"
          title="Selecione exatamente 1 item"
        >
          <Copy className="h-4 w-4 mr-2" />
          {copiedDevolver ? 'Copiado Devolver!' : 'Devolver'}
        </Button>

        {onAtualizarDb && (
          <Button
            variant="default"
            size="sm"
            onClick={onAtualizarDb}
            disabled={isAtualizandoDb}
            className="bg-[#1B3550] border border-[#2A4D6E] hover:bg-[#234465] text-[#AEE4FF] hover:text-white shadow-md transition-all duration-300 font-bold gap-1.5"
            title="Solicitar extração de relatório e atualização do banco de dados ao Planilha Sync"
          >
            {isAtualizandoDb ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-[#AEE4FF]" />
                <span>Atualizando DB...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 text-[#AEE4FF]" />
                <span>Atualizar DB</span>
              </>
            )}
          </Button>
        )}

        <Badge variant="outline" className="shrink-0 bg-[#1B3550] text-[#AEE4FF] border-[#2A4D6E] text-xs font-mono font-bold px-2.5 py-1 rounded-lg">
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
            Mostrando {table.getFilteredRowModel().rows.length === 0 ? 0 : table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} a{' '}
            {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} de {table.getFilteredRowModel().rows.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            Página {table.getPageCount() === 0 ? 0 : table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
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

      <Dialog open={devolverOpen} onOpenChange={setDevolverOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Devolver</DialogTitle>
            <DialogDescription>
              Confirme os dados para copiar a linha tabulada para o SAP. O ultimo campo sempre sera 1.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1">
              <span className="text-sm font-medium">Material</span>
              <Input value={devolverMaterial} readOnly className="font-mono" />
            </div>

            <div className="grid gap-1">
              <span className="text-sm font-medium">Lote</span>
              <Input value={devolverLote} readOnly className="font-mono" />
            </div>

            <div className="grid gap-1">
              <span className="text-sm font-medium">Quantidade</span>
              <Input
                value={devolverQuantidade}
                onChange={(e) => setDevolverQuantidade(e.target.value)}
                placeholder="Ex: 1"
                className="font-mono"
              />
            </div>

            <div className="grid gap-1">
              <span className="text-sm font-medium">Primeiro 1 (editavel)</span>
              <Input
                value={devolverItemCount}
                onChange={(e) => setDevolverItemCount(e.target.value)}
                placeholder="Ex: 1 ou 2"
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDevolverOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmDevolver} disabled={!devolverQuantidade.trim() || !devolverItemCount.trim()}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação para Mover/Ajuste (SAP movermigo) */}
      <Dialog open={moverAjusteConfirmOpen} onOpenChange={setMoverAjusteConfirmOpen}>
        <DialogContent className="sm:max-w-md bg-[#13283E] border-[#2A4D6E] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#AEE4FF] text-base font-bold">
              <ArrowRightLeft className="h-5 w-5 text-[#AEE4FF]" />
              <span>Executar Mover/Ajuste no SAP (movermigo)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-300 pt-1">
              Esta ação solicitará ao <strong>Planilha Sync</strong> a execução da automação <code>movermigo</code> na sua sessão aberta do SAP GUI.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3.5 rounded-xl bg-[#1B3550]/80 border border-[#2A4D6E] space-y-2 text-xs">
            <p className="font-semibold text-[#AEE4FF] flex items-center gap-1.5">
              <span>Etapas automáticas no SAP (/nlt10):</span>
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px] font-mono">
              <li>Transação: <code>/nlt10</code> (Depósito <strong>PES</strong>, Posição <strong>PESAGEM</strong>)</li>
              <li>Filtro: Tipo de estoque <strong>S</strong> (Bloqueado/Ajuste)</li>
              <li>Destino: Tipo de depósito <strong>999</strong>, Posição <strong>AJUSTE</strong></li>
              <li>Confirmação automática da transferência (SQUIT = true)</li>
            </ul>
            <p className="text-[10px] text-amber-300 pt-1">
              ⚠️ Certifique-se de que o SAP GUI está aberto e o Planilha Sync em execução na sua máquina.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMoverAjusteConfirmOpen(false)}
              className="bg-[#1B3550] border-[#2A4D6E] text-slate-300 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmMoverAjuste}
              className="bg-[#AEE4FF] hover:bg-[#86d4fa] text-[#13283E] font-bold gap-1.5"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Executar no SAP</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para Bloquear/MIGO no SAP (Movimento Y84) */}
      <Dialog open={bloquearMigoOpen} onOpenChange={setBloquearMigoOpen}>
        <DialogContent className={cn("bg-[#13283E] border-[#2A4D6E] text-white", bloquearSelectedItems.length > 1 ? "sm:max-w-2xl" : "sm:max-w-md")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#AEE4FF] text-base font-bold">
              <Lock className="h-5 w-5 text-[#AEE4FF]" />
              <span>
                Bloquear / MIGO no SAP (Y84)
                {bloquearSelectedItems.length > 1 && ` — ${bloquearSelectedItems.length} Itens`}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-300 pt-1">
              {bloquearSelectedItems.length > 1
                ? `Revise os ${bloquearSelectedItems.length} itens selecionados que serão bloqueados sequencialmente via Planilha Sync.`
                : 'Confirme os dados da matéria-prima selecionada para envio e execução do script de bloqueio na sua sessão SAP via Planilha Sync.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {bloquearSelectedItems.length === 1 ? (
              <>
                <div className="p-2.5 rounded-lg bg-[#1B3550]/80 border border-[#2A4D6E] space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Material:</span>
                    <span className="font-mono font-bold text-[#AEE4FF]">{bloquearSelectedItems[0]?.material}</span>
                  </div>
                  {bloquearSelectedItems[0]?.descricao && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Descrição:</span>
                      <span className="text-slate-200 truncate max-w-[240px]" title={bloquearSelectedItems[0]?.descricao}>
                        {bloquearSelectedItems[0]?.descricao}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">Lote:</span>
                    <span className="font-mono font-bold text-amber-300">{bloquearSelectedItems[0]?.lote}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 font-medium mb-1 block">
                      Quantidade:
                    </label>
                    <Input
                      value={bloquearSelectedItems[0]?.quantidade ?? ''}
                      onChange={(e) => handleUpdateSingleBloquearItem('quantidade', e.target.value)}
                      placeholder="Ex: 0,081"
                      className="bg-[#1B3550] border-[#2A4D6E] text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300 font-medium mb-1 block">
                      Unidade (UMB):
                    </label>
                    <Input
                      value={bloquearSelectedItems[0]?.unidade ?? ''}
                      onChange={(e) => handleUpdateSingleBloquearItem('unidade', e.target.value.toUpperCase())}
                      placeholder="KG, L, G, UN..."
                      className="bg-[#1B3550] border-[#2A4D6E] text-white text-sm uppercase"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="max-h-60 overflow-y-auto rounded-lg border border-[#2A4D6E] bg-[#0E1D2D]">
                <table className="w-full text-xs text-left">
                  <thead className="text-[11px] text-slate-400 uppercase bg-[#1B3550]/80 sticky top-0 border-b border-[#2A4D6E]">
                    <tr>
                      <th className="px-3 py-2">Material</th>
                      <th className="px-3 py-2">Descrição</th>
                      <th className="px-3 py-2">Lote</th>
                      <th className="px-3 py-2 text-right">Qtd</th>
                      <th className="px-3 py-2 text-center">UMB</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A4D6E]/40 font-mono">
                    {bloquearSelectedItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#1B3550]/40">
                        <td className="px-3 py-1.5 font-bold text-[#AEE4FF]">{item.material}</td>
                        <td className="px-3 py-1.5 font-sans text-slate-300 text-[11px] max-w-[150px] truncate" title={item.descricao}>
                          {item.descricao || '-'}
                        </td>
                        <td className="px-3 py-1.5 text-amber-300 font-bold">{item.lote}</td>
                        <td className="px-3 py-1.5 text-right text-white">{item.quantidade}</td>
                        <td className="px-3 py-1.5 text-center text-slate-300">{item.unidade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="p-3 rounded-lg bg-[#0E1D2D] border border-[#2A4D6E]/60 text-[11px] space-y-1 text-slate-300 font-mono">
              <p className="text-[#AEE4FF] font-sans font-semibold">Parâmetros automáticos por item:</p>
              <div>• Transação: <span className="text-white">/nmigo</span> (Movimento: <span className="text-amber-300">Y84</span>)</div>
              <div>• Centro: <span className="text-white">600</span> | Depósito: <span className="text-white">PES &rarr; PES</span></div>
              <div>• Motivo: <span className="text-amber-300">9000</span> | Pós-gravação: <span className="text-white">/nlt06</span></div>
            </div>

            <p className="text-[10px] text-amber-300">
              ⚠️ Certifique-se de que o SAP GUI está aberto e o Planilha Sync em execução.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBloquearMigoOpen(false)}
              className="bg-[#1B3550] border-[#2A4D6E] text-slate-300 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmBloquearMigo}
              disabled={
                bloquearSelectedItems.length === 0 ||
                bloquearSelectedItems.some((it) => !it.material || !it.lote || !it.quantidade)
              }
              className="bg-[#AEE4FF] hover:bg-[#86d4fa] text-[#13283E] font-bold gap-1.5"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>
                {bloquearSelectedItems.length > 1
                  ? `Executar Bloqueio (${bloquearSelectedItems.length} Itens) no SAP`
                  : 'Executar Bloqueio no SAP'}
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
