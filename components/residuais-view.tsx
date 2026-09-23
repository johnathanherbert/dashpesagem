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
  Undo2,
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
  Calculator,
  GripVertical,
  Layers,
  ChevronUp,
} from 'lucide-react';
import { AgingData, RemessaData, ConfiguracaoResiduais, AgingTableRow, NivelResidual } from '@/types/aging';
import { enriquecerAgingComAnalise } from '@/lib/residuais-analyzer';
import { cn, copyToClipboard } from '@/lib/utils';

// Helper para gerar o VBScript de Devolução Fracionada (/nzwm296) para o SAP GUI
export interface DevolverVolumeItem {
  id: string;
  quantidade: string;
  volume: string;
}

export function generateDevolverZwm296Vbs(
  material: string,
  lote: string,
  volumes: Array<{ quantidade: string; volume?: string }>
): string {
  if (volumes.length === 0) return '';

  const mat = material.trim();
  const lot = lote.trim();

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
session.findById("wnd[0]/tbar[0]/okcd").text = "/nzwm296"
session.findById("wnd[0]").sendVKey 0
session.findById("wnd[0]/usr/btnCTR_CREATE").press
session.findById("wnd[0]/usr/ctxtLTAK-BWLVS").text = "996"
session.findById("wnd[0]/usr/ctxtT001L-LGORT").text = "pes"
session.findById("wnd[0]/usr/ctxtT001W-WERKS").text = "600"
session.findById("wnd[0]/usr/ctxtT301-LGTYP").text = "pes"
session.findById("wnd[0]/usr/ctxtLTBK-VLPLA").text = "pesagem"
session.findById("wnd[0]/usr/txtW_DEP_DEPOSITO").text = "alm"
session.findById("wnd[0]/usr/txtLTAP-LETYP").text = "e1"
`;

  // 1. MATNR para todos os itens
  const matnrLines = volumes
    .map((_, idx) => `session.findById("wnd[0]/usr/tblSAPMZ_296TC_ITEM/txtT_ZWMTB296I-MATNR[0,${idx}]").text = "${mat}"`)
    .join('\n');

  // 2. CHARG para todos os itens
  const chargLines = volumes
    .map((_, idx) => `session.findById("wnd[0]/usr/tblSAPMZ_296TC_ITEM/ctxtT_ZWMTB296I-CHARG[1,${idx}]").text = "${lot}"`)
    .join('\n');

  // 3. MENGE para todos os itens
  const mengeLines = volumes
    .map((v, idx) => {
      const qtdStr = (v.quantidade || '').trim().replace('.', ',');
      return `session.findById("wnd[0]/usr/tblSAPMZ_296TC_ITEM/txtT_ZWMTB296I-MENGE[2,${idx}]").text = "${qtdStr}"`;
    })
    .join('\n');

  // 4. MENGE_VOL para todos os itens
  const mengeVolLines = volumes
    .map((v, idx) => {
      const volStr = (v.volume || '1').trim();
      return `session.findById("wnd[0]/usr/tblSAPMZ_296TC_ITEM/txtT_ZWMTB296I-MENGE_VOL[4,${idx}]").text = "${volStr}"`;
    })
    .join('\n');

  // 5. PALLET para todos os itens
  const palletLines = volumes
    .map((_, idx) => `session.findById("wnd[0]/usr/tblSAPMZ_296TC_ITEM/txtT_ZWMTB296I-PALLET[5,${idx}]").text = "1"`)
    .join('\n');

  // 6. Focus e gravação
  const lastIdx = volumes.length - 1;
  const vbsFooter = `session.findById("wnd[0]/usr/tblSAPMZ_296TC_ITEM/txtT_ZWMTB296I-PALLET[5,${lastIdx}]").setFocus
session.findById("wnd[0]/usr/tblSAPMZ_296TC_ITEM/txtT_ZWMTB296I-PALLET[5,${lastIdx}]").caretPosition = 1
session.findById("wnd[0]/tbar[1]/btn[13]").press
session.findById("wnd[0]/tbar[0]/okcd").text = "/n"
session.findById("wnd[0]").sendVKey 0
`;

  return [
    vbsHeader,
    matnrLines,
    chargLines,
    mengeLines,
    mengeVolLines,
    palletLines,
    vbsFooter,
  ].filter(Boolean).join('\n');
}

// Helper para gerar o VBScript dinâmico de bloqueio MIGO (Y84) para o SAP GUI em documento único com rolagem
export interface BloquearItemParam {
  material: string;
  lote: string;
  quantidade: string;
  unidade: string;
  descricao?: string;
}

export type MacroActionType = 'bloquear_migo' | 'mover_ajuste' | 'atualizar_db' | 'devolver';

export interface MacroActionItem {
  id: string;
  actionType: MacroActionType;
}

export const AVAILABLE_MACROS: Array<{
  type: MacroActionType;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  badgeBg: string;
}> = [
  {
    type: 'bloquear_migo',
    label: 'Bloquear no SAP (MIGO Y84)',
    shortLabel: 'Bloquear MIGO',
    description: 'Executa /nmigo (Y84) com scroll e confirmação de OT (/nlt06)',
    color: 'text-[#AEE4FF]',
    badgeBg: 'bg-[#AEE4FF]/10 border-[#AEE4FF]/30 text-[#AEE4FF]',
  },
  {
    type: 'mover_ajuste',
    label: 'Mover para Ajuste (999/AJUSTE)',
    shortLabel: 'Mover/Ajuste',
    description: 'Transfere saldo tipo S de PES para 999/AJUSTE via /nlt10',
    color: 'text-indigo-300',
    badgeBg: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
  },
  {
    type: 'atualizar_db',
    label: 'Atualizar Banco de Dados',
    shortLabel: 'Atualizar DB',
    description: 'Extrai relatório do SAP e sincroniza com o banco de dados',
    color: 'text-emerald-300',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  },
  {
    type: 'devolver',
    label: 'Devolver ao Almoxarifado',
    shortLabel: 'Devolver (/nzwm296)',
    description: 'Executa ordem de devolução via /nzwm296',
    color: 'text-amber-300',
    badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  },
];

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

  const tblPath = `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM")`;

  // Preenche dados de cada item rolando a grade para a posição necessária (linha visual [col, 0])
  const itemsLines = items.map((item, idx) => {
    const mat = item.material.trim();
    const qtd = item.quantidade.trim().replace('.', ',');
    const unit = (item.unidade.trim() || 'KG').toUpperCase();

    return `${tblPath}.verticalScrollbar.position = ${idx}
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-MAKTX[1,0]").text = "${mat}"
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/txtGOITEM-ERFMG[3,0]").text = "${qtd}"
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-ERFME[5,0]").text = "${unit}"
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-LGOBE[12,0]").text = "PES"
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-NAME1[9,0]").text = "600"
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-UMLGOBE[14,0]").text = "PES"
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-GRUND[15,0]").text = "9000"`;
  }).join('\n');

  // Validação da Grade via Enter no primeiro item (retorna scroll para o topo)
  const validateGrid = `${tblPath}.verticalScrollbar.position = 0
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-MAKTX[1,0]").setFocus
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-MAKTX[1,0]").caretPosition = 0
session.findById("wnd[0]").sendVKey 0
`;

  // Preenche Lotes (CHARG) com scroll para cada item
  const chargLines = items.map((item, idx) => {
    const lote = item.lote.trim();
    return `${tblPath}.verticalScrollbar.position = ${idx}
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-CHARG[2,0]").text = "${lote}"`;
  }).join('\n');

  // Gravação, Transfer Order (/nlt06, btn[44]) e retorno (/n)
  const vbsFooter = `${tblPath}.verticalScrollbar.position = 0
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-CHARG[2,0]").setFocus
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
    itemsLines,
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
  const [devolverDescricao, setDevolverDescricao] = useState('');
  const [devolverLote, setDevolverLote] = useState('');
  const [devolverUnidade, setDevolverUnidade] = useState('KG');
  const [devolverSaldoTotal, setDevolverSaldoTotal] = useState<number>(0);
  const [devolverVolumes, setDevolverVolumes] = useState<DevolverVolumeItem[]>([
    { id: '1', quantidade: '', volume: '1' },
  ]);
  const [isDevolverRunning, setIsDevolverRunning] = useState(false);
  const [isApplyingInvestigacao, setIsApplyingInvestigacao] = useState(false);
  const [isMoverAjusteRunning, setIsMoverAjusteRunning] = useState(false);
  const [moverAjusteConfirmOpen, setMoverAjusteConfirmOpen] = useState(false);
  const [bloquearMigoOpen, setBloquearMigoOpen] = useState(false);
  const [bloquearSelectedItems, setBloquearSelectedItems] = useState<BloquearItemParam[]>([]);
  const [isBloquearMigoRunning, setIsBloquearMigoRunning] = useState(false);
  const [macroPipeline, setMacroPipeline] = useState<MacroActionItem[]>([
    { id: 'step-1', actionType: 'bloquear_migo' },
  ]);
  const [draggedMacroIndex, setDraggedMacroIndex] = useState<number | null>(null);

  // Helper para conversão numérica de inputs
  const parseQtdNumber = (val: string): number => {
    if (!val) return 0;
    const cleaned = String(val).trim().replace(/\s/g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  };

  const totalDevolvendo = useMemo(() => {
    return (
      Math.round(
        devolverVolumes.reduce((acc, v) => acc + parseQtdNumber(v.quantidade), 0) * 1000
      ) / 1000
    );
  }, [devolverVolumes]);

  const saldoRestante = useMemo(() => {
    return Math.round((devolverSaldoTotal - totalDevolvendo) * 1000) / 1000;
  }, [devolverSaldoTotal, totalDevolvendo]);

  const isOverSaldo = saldoRestante < -0.0001;
  const isZeroRestante = Math.abs(saldoRestante) <= 0.0001 && totalDevolvendo > 0;

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

  const executeSapJobAndWait = (
    command: string,
    userEmail: string,
    scriptCode?: string,
    timeoutSeconds = 120
  ): Promise<{ success: boolean; message?: string }> => {
    return new Promise(async (resolve) => {
      try {
        const res = await triggerSapAutomation(command, userEmail, scriptCode);
        if (!res.success || !res.job) {
          return resolve({ success: false, message: res.error || 'Falha ao enfileirar automação' });
        }
        const jobId = res.job.id;
        let attempts = 0;
        const maxAttempts = Math.ceil(timeoutSeconds / 2);
        const interval = setInterval(async () => {
          attempts++;
          try {
            const statusJob = await checkSapAutomationStatus(jobId);
            if (statusJob?.status === 'completed') {
              clearInterval(interval);
              return resolve({ success: true, message: statusJob.result_message });
            } else if (statusJob?.status === 'failed') {
              clearInterval(interval);
              return resolve({
                success: false,
                message: statusJob.result_message || 'Erro durante a execução do script',
              });
            } else if (attempts >= maxAttempts) {
              clearInterval(interval);
              return resolve({
                success: false,
                message: 'Tempo limite excedido aguardando resposta do Planilha Sync',
              });
            }
          } catch (e: any) {
            if (attempts >= maxAttempts) {
              clearInterval(interval);
              return resolve({ success: false, message: e?.message || 'Erro de comunicação com a API' });
            }
          }
        }, 2000);
      } catch (err: any) {
        resolve({ success: false, message: err?.message || 'Erro inesperado' });
      }
    });
  };

  const handleAddMacroToPipeline = (actionType: MacroActionType) => {
    setMacroPipeline((prev) => [
      ...prev,
      { id: `${actionType}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, actionType },
    ]);
  };

  const handleRemoveMacroFromPipeline = (index: number) => {
    setMacroPipeline((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleMoveMacroInPipeline = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= macroPipeline.length) return;
    setMacroPipeline((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  };

  const handleApplyMacroPreset = (presetTypes: MacroActionType[]) => {
    setMacroPipeline(
      presetTypes.map((actionType, i) => ({
        id: `${actionType}-${Date.now()}-${i}`,
        actionType,
      }))
    );
  };

  const handleExecuteMacroPipeline = async () => {
    if (macroPipeline.length === 0) {
      toast.error('Adicione ao menos uma macro ao pipeline de execução.');
      return;
    }

    const hasBloquear = macroPipeline.some((m) => m.actionType === 'bloquear_migo');
    if (hasBloquear) {
      if (bloquearSelectedItems.length === 0) return;
      const hasInvalid = bloquearSelectedItems.some(
        (it) => !it.material.trim() || !it.lote.trim() || !it.quantidade.trim()
      );
      if (hasInvalid) {
        toast.error('Preencha os campos obrigatórios (Material, Lote e Quantidade) de todos os itens');
        return;
      }
    }

    setBloquearMigoOpen(false);
    setIsBloquearMigoRunning(true);
    const totalSteps = macroPipeline.length;
    const countItems = bloquearSelectedItems.length;
    const toastId = toast.loading(`Iniciando pipeline de ${totalSteps} etapa(s) no SAP...`);

    try {
      for (let stepIdx = 0; stepIdx < totalSteps; stepIdx++) {
        const step = macroPipeline[stepIdx];
        const stepNumber = stepIdx + 1;
        const macroDef = AVAILABLE_MACROS.find((m) => m.type === step.actionType);
        const label = macroDef?.shortLabel || step.actionType;

        toast.loading(`[${stepNumber}/${totalSteps}] Executando: ${label}...`, { id: toastId });

        let res: { success: boolean; message?: string };

        if (step.actionType === 'bloquear_migo') {
          const vbsCode = generateBloquearMigoVbs(bloquearSelectedItems);
          res = await executeSapJobAndWait(
            'bloquear_migo',
            currentUserEmail || 'Dashboard',
            vbsCode,
            Math.max(60, countItems * 25)
          );
        } else if (step.actionType === 'mover_ajuste') {
          res = await executeSapJobAndWait(
            'movermigo',
            currentUserEmail || 'Dashboard',
            undefined,
            60
          );
        } else if (step.actionType === 'atualizar_db') {
          res = await executeSapJobAndWait(
            'atualizar_db',
            currentUserEmail || 'Dashboard',
            undefined,
            180
          );
        } else if (step.actionType === 'devolver') {
          const firstMat = bloquearSelectedItems[0]?.material || '';
          const firstLot = bloquearSelectedItems[0]?.lote || '';
          const vbsCode = generateDevolverZwm296Vbs(
            firstMat,
            firstLot,
            bloquearSelectedItems.map((it, idx) => ({
              quantidade: it.quantidade,
              volume: String(idx + 1),
            }))
          );
          res = await executeSapJobAndWait(
            'devolver',
            currentUserEmail || 'Dashboard',
            vbsCode,
            90
          );
        } else {
          res = { success: true };
        }

        if (!res.success) {
          toast.error(
            `Falha na etapa [${stepNumber}/${totalSteps}] (${label}): ${res.message || 'Erro na execução'}`,
            { id: toastId, duration: 6000 }
          );
          setIsBloquearMigoRunning(false);
          return;
        }
      }

      toast.success(
        `Pipeline completo de ${totalSteps} etapa(s) executado com sucesso no SAP!`,
        { id: toastId, icon: '✨', duration: 5000 }
      );
      setRowSelection({});
    } catch (err: any) {
      toast.error(`Erro no pipeline: ${err?.message || err}`, { id: toastId });
    } finally {
      setIsBloquearMigoRunning(false);
    }
  };

  const handleOpenDevolver = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length !== 1) return;

    const selected = selectedRows[0].original;
    const rawEstoque = selected.estoque_disponivel;
    const numEstoque =
      typeof rawEstoque === 'number'
        ? rawEstoque
        : parseFloat(String(rawEstoque).replace(',', '.')) || 0;

    const quantidadeFormatada = numEstoque.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
      useGrouping: false,
    });

    setDevolverMaterial(selected.material);
    setDevolverDescricao(selected.texto_breve_material || '');
    setDevolverLote(selected.lote);
    setDevolverUnidade(selected.unidade_medida?.toUpperCase() || 'KG');
    setDevolverSaldoTotal(numEstoque);
    setDevolverVolumes([
      {
        id: '1',
        quantidade: quantidadeFormatada,
        volume: '1',
      },
    ]);
    setDevolverOpen(true);
  };

  const handleAddVolume = () => {
    const restante = Math.max(0, Math.round((devolverSaldoTotal - totalDevolvendo) * 1000) / 1000);
    const initialQtd =
      restante > 0.0001
        ? restante.toLocaleString('pt-BR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
            useGrouping: false,
          })
        : '';

    setDevolverVolumes((prev) => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        quantidade: initialQtd,
        volume: '1',
      },
    ]);
  };

  const handleRemoveVolume = (idx: number) => {
    if (devolverVolumes.length <= 1) return;
    setDevolverVolumes((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateVolume = (
    idx: number,
    field: 'quantidade' | 'volume',
    value: string
  ) => {
    setDevolverVolumes((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleFillRestante = () => {
    if (saldoRestante <= 0.0001) return;
    const restanteStr = saldoRestante.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
      useGrouping: false,
    });

    setDevolverVolumes((prev) => {
      // Se a última linha tiver quantidade vazia ou 0, preenche nela
      const lastIdx = prev.length - 1;
      if (lastIdx >= 0 && parseQtdNumber(prev[lastIdx].quantidade) === 0) {
        const updated = [...prev];
        updated[lastIdx] = { ...updated[lastIdx], quantidade: restanteStr };
        return updated;
      }
      // Caso contrário, adiciona nova linha com o restante
      return [
        ...prev,
        {
          id: String(Date.now() + Math.random()),
          quantidade: restanteStr,
          volume: '1',
        },
      ];
    });
  };

  const handleConfirmDevolver = async () => {
    const validVolumes = devolverVolumes.filter((v) => parseQtdNumber(v.quantidade) > 0);
    if (validVolumes.length === 0 || !devolverMaterial.trim() || !devolverLote.trim()) {
      toast.error('Preencha ao menos 1 volume com quantidade válida maior que 0');
      return;
    }

    if (isOverSaldo) {
      toast.error(
        `A soma das quantidades (${totalDevolvendo.toLocaleString('pt-BR')} ${devolverUnidade}) ultrapassa o saldo disponível (${devolverSaldoTotal.toLocaleString('pt-BR')} ${devolverUnidade})`
      );
      return;
    }

    setDevolverOpen(false);
    setIsDevolverRunning(true);
    const countVol = validVolumes.length;
    const toastId = toast.loading(
      `Enviando devolução (/nzwm296) de ${countVol} volume(s) do lote ${devolverLote} para o Planilha Sync...`
    );

    const vbsCode = generateDevolverZwm296Vbs(
      devolverMaterial,
      devolverLote,
      validVolumes.map((v) => ({
        quantidade: v.quantidade,
        volume: v.volume || '1',
      }))
    );

    try {
      const res = await triggerSapAutomation('devolver', currentUserEmail || 'Dashboard', vbsCode);
      if (!res.success || !res.job) {
        toast.error(`Falha ao disparar automação: ${res.error || 'Erro desconhecido'}`, { id: toastId });
        setIsDevolverRunning(false);
        return;
      }

      const jobId = res.job.id;
      toast.loading(`Aguardando execução da devolução /nzwm296 no SAP GUI (${countVol} vol)...`, { id: toastId });

      let attempts = 0;
      const maxAttempts = 40; // até 80s
      const interval = setInterval(async () => {
        attempts++;
        try {
          const statusJob = await checkSapAutomationStatus(jobId);
          if (statusJob?.status === 'completed') {
            clearInterval(interval);
            setIsDevolverRunning(false);
            setRowSelection({});
            toast.success(
              `Devolução (/nzwm296) de ${countVol} volume(s) executada com sucesso no SAP para o lote ${devolverLote}!`,
              { id: toastId, icon: '↩️' }
            );
          } else if (statusJob?.status === 'failed') {
            clearInterval(interval);
            setIsDevolverRunning(false);
            toast.error(`Execução no SAP falhou: ${statusJob.result_message || 'Erro no script'}`, { id: toastId });
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            setIsDevolverRunning(false);
            toast('Tempo limite aguardando o Planilha Sync. Verifique se o app está aberto.', { id: toastId, icon: '⚠️' });
          }
        } catch (e) {
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            setIsDevolverRunning(false);
          }
        }
      }, 2000);
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`, { id: toastId });
      setIsDevolverRunning(false);
    }
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
          disabled={selectedCount !== 1 || isDevolverRunning}
          className="bg-[#E29A36] hover:bg-[#d48c2a] text-[#13283E] font-bold border-0 shadow-md transition-all duration-300 gap-1.5"
          title={selectedCount !== 1 ? "Selecione exatamente 1 item para Devolver" : "Executar devolução no SAP (/nzwm296) via Planilha Sync"}
        >
          {isDevolverRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-[#13283E]" />
              <span>Devolvendo SAP...</span>
            </>
          ) : (
            <>
              <Undo2 className="h-4 w-4 text-[#13283E]" />
              <span>Devolver</span>
            </>
          )}
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
        <DialogContent className="sm:max-w-3xl lg:max-w-4xl bg-[#13283E] border-[#2A4D6E] text-white p-6 max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0 pb-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <DialogTitle className="flex items-center gap-2 text-[#AEE4FF] text-lg font-bold">
                <Undo2 className="h-5 w-5 text-[#E29A36]" />
                <span>Devolução Fracionada no SAP (/nzwm296)</span>
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-[#1B3550] text-[#AEE4FF] border-[#2A4D6E] font-mono text-xs px-2 py-0.5">
                  Material: <strong className="text-white ml-1">{devolverMaterial}</strong>
                </Badge>
                <Badge variant="outline" className="bg-[#1B3550] text-[#AEE4FF] border-[#2A4D6E] font-mono text-xs px-2 py-0.5">
                  Lote: <strong className="text-white ml-1">{devolverLote}</strong>
                </Badge>
              </div>
            </div>
            {devolverDescricao && (
              <p className="text-xs text-slate-300 truncate max-w-2xl">{devolverDescricao}</p>
            )}
            <DialogDescription className="text-slate-400 text-xs">
              Configure múltiplos volumes para devolução na transação <strong className="text-white font-mono">/nzwm296</strong>. O saldo restante é calculado automaticamente.
            </DialogDescription>
          </DialogHeader>

          {/* Cards de Feedback Visual e Saldo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2 shrink-0">
            {/* Card 1: Saldo Disponível */}
            <div className="p-3 rounded-xl bg-[#0D1D2D] border border-[#2A4D6E] flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Saldo em Estoque</span>
              <div className="mt-1">
                <span className="text-xl font-bold font-mono text-[#AEE4FF]">
                  {devolverSaldoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-semibold">{devolverUnidade}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1">Total disponível no lote selecionado</span>
            </div>

            {/* Card 2: Total Devolvendo */}
            <div className="p-3 rounded-xl bg-[#0D1D2D] border border-[#2A4D6E] flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total a Devolver</span>
              <div className="mt-1">
                <span className={cn(
                  "text-xl font-bold font-mono",
                  isOverSaldo ? "text-red-400" : isZeroRestante ? "text-emerald-400" : "text-white"
                )}>
                  {totalDevolvendo.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-semibold">{devolverUnidade}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1">
                Soma de {devolverVolumes.length} volume(s) configurado(s)
              </span>
            </div>

            {/* Card 3: Saldo Restante (Interativo / Auto-preenchimento) */}
            <div
              onClick={saldoRestante > 0.0001 ? handleFillRestante : undefined}
              className={cn(
                "p-3 rounded-xl border flex flex-col justify-between transition-all duration-200",
                isZeroRestante
                  ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
                  : isOverSaldo
                  ? "bg-red-950/40 border-red-500/50 text-red-300"
                  : "bg-[#E29A36]/15 hover:bg-[#E29A36]/25 border-[#E29A36]/60 text-[#E29A36] cursor-pointer hover:scale-[1.02] shadow-sm group"
              )}
              title={
                saldoRestante > 0.0001
                  ? "Clique para auto-preencher o saldo restante no próximo volume"
                  : undefined
              }
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  {isZeroRestante ? 'Devolução Completa' : isOverSaldo ? 'Saldo Excedido' : 'Saldo Restante'}
                </span>
                {isZeroRestante ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : isOverSaldo ? (
                  <AlertCircle className="h-4 w-4 text-red-400" />
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E29A36]/20 border border-[#E29A36]/40 text-[#E29A36] font-bold group-hover:bg-[#E29A36] group-hover:text-[#13283E] transition-colors">
                    Auto-preencher ↵
                  </span>
                )}
              </div>
              <div className="mt-1">
                <span className="text-xl font-bold font-mono">
                  {isOverSaldo ? '+' : ''}
                  {Math.abs(saldoRestante).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </span>
                <span className="text-xs ml-1.5 font-semibold">{devolverUnidade}</span>
              </div>
              <span className="text-[10px] mt-1 opacity-90 truncate">
                {isZeroRestante
                  ? "100% do saldo distribuído com sucesso"
                  : isOverSaldo
                  ? "Reduza a quantidade dos volumes"
                  : "👉 Clique aqui para auto-preencher"}
              </span>
            </div>
          </div>

          {/* Tabela de Volumes Fracionados (Scrollável) */}
          <div className="flex-1 overflow-y-auto border border-[#2A4D6E] rounded-xl bg-[#0D1D2D]/60 my-1">
            <Table>
              <TableHeader className="bg-[#1B3550] sticky top-0 z-10">
                <TableRow className="border-[#2A4D6E] hover:bg-transparent">
                  <TableHead className="w-12 text-[#AEE4FF] text-xs font-bold text-center">#</TableHead>
                  <TableHead className="w-28 text-[#AEE4FF] text-xs font-bold">Material</TableHead>
                  <TableHead className="w-24 text-[#AEE4FF] text-xs font-bold">Lote</TableHead>
                  <TableHead className="text-[#AEE4FF] text-xs font-bold">Qtd a Devolver (MENGE)</TableHead>
                  <TableHead className="w-28 text-[#AEE4FF] text-xs font-bold text-center">Qtd Vol (VOL)</TableHead>
                  <TableHead className="w-20 text-[#AEE4FF] text-xs font-bold text-center">Pallet</TableHead>
                  <TableHead className="w-14 text-[#AEE4FF] text-xs font-bold text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devolverVolumes.map((volItem, idx) => (
                  <TableRow key={volItem.id} className="border-[#2A4D6E]/50 hover:bg-[#1B3550]/40">
                    <TableCell className="font-mono text-xs text-center font-bold text-slate-400">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-white">
                      {devolverMaterial}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-white">
                      {devolverLote}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          value={volItem.quantidade}
                          onChange={(e) => handleUpdateVolume(idx, 'quantidade', e.target.value)}
                          placeholder="Ex: 4,985"
                          className="font-mono font-bold text-sm bg-[#13283E] border-[#2A4D6E] text-white focus-visible:ring-[#E29A36] h-8"
                        />
                        <span className="text-xs text-slate-400 font-semibold">{devolverUnidade}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={volItem.volume}
                        onChange={(e) => handleUpdateVolume(idx, 'volume', e.target.value)}
                        placeholder="1"
                        className="font-mono text-center text-xs bg-[#13283E] border-[#2A4D6E] text-white focus-visible:ring-[#E29A36] h-8 mx-auto w-20"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-center text-slate-400">
                      1
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveVolume(idx)}
                        disabled={devolverVolumes.length <= 1}
                        className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-950/40 disabled:opacity-30"
                        title="Remover volume"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Barra de Ações Rápidas de Volumes */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 shrink-0">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddVolume}
                className="border-[#2A4D6E] bg-[#1B3550] text-[#AEE4FF] hover:bg-[#234465] hover:text-white font-bold h-8 text-xs gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Adicionar Volume</span>
              </Button>

              {saldoRestante > 0.0001 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFillRestante}
                  className="border-[#E29A36]/60 bg-[#E29A36]/10 text-[#E29A36] hover:bg-[#E29A36] hover:text-[#13283E] font-bold h-8 text-xs gap-1.5 transition-all"
                  title="Auto-preencher o saldo restante em um novo volume"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Preencher Restante ({saldoRestante.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} {devolverUnidade})</span>
                </Button>
              )}
            </div>

            <span className="text-[11px] text-slate-400 font-mono">
              BWLVS: 996 | LGORT: pes | WERKS: 600 | LGTYP: pes | VLPLA: pesagem | DEP: alm | LETYP: e1
            </span>
          </div>

          <DialogFooter className="mt-2 pt-2 border-t border-[#2A4D6E] gap-2 sm:gap-0 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDevolverOpen(false)}
              className="border-[#2A4D6E] text-slate-300 hover:bg-[#1B3550] hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmDevolver}
              disabled={
                totalDevolvendo <= 0 ||
                isOverSaldo ||
                isDevolverRunning ||
                devolverVolumes.some((v) => parseQtdNumber(v.quantidade) <= 0)
              }
              className="bg-[#E29A36] hover:bg-[#d48c2a] text-[#13283E] font-bold gap-1.5 shadow-md px-4"
            >
              {isDevolverRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-[#13283E]" />
                  <span>Executando no SAP...</span>
                </>
              ) : (
                <>
                  <Undo2 className="h-4 w-4 text-[#13283E]" />
                  <span>
                    Executar Devolução SAP ({devolverVolumes.length} {devolverVolumes.length === 1 ? 'Volume' : 'Volumes'})
                  </span>
                </>
              )}
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

      {/* Dialog para Bloquear/MIGO e Pipeline de Macros no SAP */}
      <Dialog open={bloquearMigoOpen} onOpenChange={setBloquearMigoOpen}>
        <DialogContent className={cn("bg-[#13283E] border-[#2A4D6E] text-white", "sm:max-w-3xl max-h-[90vh] overflow-y-auto")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#AEE4FF] text-base font-bold">
              <Layers className="h-5 w-5 text-[#AEE4FF]" />
              <span>
                Execução SAP &amp; Pipeline de Macros
                {bloquearSelectedItems.length > 0 && ` (${bloquearSelectedItems.length} Item${bloquearSelectedItems.length > 1 ? 'ns' : ''})`}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-300 pt-1">
              Personalize a sequência de funções automáticas que o Planilha Sync executará no SAP para os itens selecionados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 1. Resumo dos Itens Selecionados */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-[#AEE4FF]" />
                <span>Itens Selecionados para Processamento:</span>
              </label>

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
                        <span className="text-slate-200 truncate max-w-[320px]" title={bloquearSelectedItems[0]?.descricao}>
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
                <div className="max-h-44 overflow-y-auto rounded-lg border border-[#2A4D6E] bg-[#0E1D2D]">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[11px] text-slate-400 uppercase bg-[#1B3550]/80 sticky top-0 border-b border-[#2A4D6E]">
                      <tr>
                        <th className="px-3 py-1.5">Material</th>
                        <th className="px-3 py-1.5">Descrição</th>
                        <th className="px-3 py-1.5">Lote</th>
                        <th className="px-3 py-1.5 text-right">Qtd</th>
                        <th className="px-3 py-1.5 text-center">UMB</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2A4D6E]/40 font-mono">
                      {bloquearSelectedItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-[#1B3550]/40">
                          <td className="px-3 py-1.5 font-bold text-[#AEE4FF]">{item.material}</td>
                          <td className="px-3 py-1.5 font-sans text-slate-300 text-[11px] max-w-[200px] truncate" title={item.descricao}>
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
            </div>

            {/* 2. Pipeline de Macros / Sequência de Execução */}
            <div className="p-3.5 rounded-xl bg-[#0E1D2D] border border-[#2A4D6E] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#AEE4FF]" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Pipeline de Macros (Ordem de Execução)
                  </span>
                  <Badge variant="outline" className="border-[#AEE4FF]/40 text-[#AEE4FF] text-[10px] py-0 px-1.5">
                    {macroPipeline.length} etapa{macroPipeline.length !== 1 ? 's' : ''}
                  </Badge>
                </div>

                {/* Predefinições Rápidas */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-slate-400 text-[10px] mr-1">Presets:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyMacroPreset(['bloquear_migo', 'mover_ajuste', 'atualizar_db'])}
                    className="px-2 py-0.5 rounded bg-[#1B3550] hover:bg-[#234465] text-[#AEE4FF] border border-[#2A4D6E] text-[10px] font-semibold transition-colors"
                    title="Bloquear MIGO ➔ Mover para Ajuste ➔ Atualizar Banco de Dados"
                  >
                    ⚡ Completo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyMacroPreset(['bloquear_migo', 'atualizar_db'])}
                    className="px-2 py-0.5 rounded bg-[#1B3550] hover:bg-[#234465] text-emerald-300 border border-[#2A4D6E] text-[10px] font-semibold transition-colors"
                    title="Bloquear MIGO ➔ Atualizar Banco de Dados"
                  >
                    🔒 Bloquear + DB
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyMacroPreset(['bloquear_migo'])}
                    className="px-2 py-0.5 rounded bg-[#1B3550] hover:bg-[#234465] text-slate-300 border border-[#2A4D6E] text-[10px] font-semibold transition-colors"
                    title="Apenas Bloquear no SAP via MIGO"
                  >
                    🎯 Só Bloquear
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyMacroPreset(['mover_ajuste', 'atualizar_db'])}
                    className="px-2 py-0.5 rounded bg-[#1B3550] hover:bg-[#234465] text-indigo-300 border border-[#2A4D6E] text-[10px] font-semibold transition-colors"
                    title="Mover para Ajuste ➔ Atualizar Banco de Dados"
                  >
                    📦 Mover + DB
                  </button>
                </div>
              </div>

              {/* Lista Sequencial de Macros */}
              <div className="space-y-1.5 min-h-[60px]">
                {macroPipeline.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-[#2A4D6E] rounded-lg">
                    Nenhuma macro configurada. Adicione ações abaixo para montar seu fluxo automático.
                  </div>
                ) : (
                  macroPipeline.map((step, idx) => {
                    const macroDef = AVAILABLE_MACROS.find((m) => m.type === step.actionType);
                    if (!macroDef) return null;

                    return (
                      <div
                        key={step.id}
                        draggable
                        onDragStart={() => setDraggedMacroIndex(idx)}
                        onDragOver={(e) => {
                          e.preventDefault();
                        }}
                        onDrop={() => {
                          if (draggedMacroIndex !== null && draggedMacroIndex !== idx) {
                            handleMoveMacroInPipeline(draggedMacroIndex, idx);
                            setDraggedMacroIndex(null);
                          }
                        }}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg border transition-all duration-200 cursor-grab active:cursor-grabbing",
                          "bg-[#13283E]/90 hover:bg-[#1B3550] border-[#2A4D6E]",
                          draggedMacroIndex === idx && "opacity-50 border-[#AEE4FF]"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <GripVertical className="h-4 w-4 text-slate-500 hover:text-slate-300 shrink-0" />
                          <div className="w-5 h-5 rounded-full bg-[#1B3550] border border-[#2A4D6E] flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
                            {idx + 1}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {step.actionType === 'bloquear_migo' && <Lock className="h-3.5 w-3.5 text-[#AEE4FF] shrink-0" />}
                              {step.actionType === 'mover_ajuste' && <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-300 shrink-0" />}
                              {step.actionType === 'atualizar_db' && <RefreshCw className="h-3.5 w-3.5 text-emerald-300 shrink-0" />}
                              {step.actionType === 'devolver' && <Undo2 className="h-3.5 w-3.5 text-amber-300 shrink-0" />}
                              <span className="text-xs font-semibold text-white truncate">
                                {macroDef.label}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate">
                              {macroDef.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={idx === 0}
                            onClick={() => handleMoveMacroInPipeline(idx, idx - 1)}
                            className="h-6 w-6 text-slate-400 hover:text-white hover:bg-[#2A4D6E]/50"
                            title="Mover para cima"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={idx === macroPipeline.length - 1}
                            onClick={() => handleMoveMacroInPipeline(idx, idx + 1)}
                            className="h-6 w-6 text-slate-400 hover:text-white hover:bg-[#2A4D6E]/50"
                            title="Mover para baixo"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveMacroFromPipeline(idx)}
                            className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            title="Remover etapa"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Caixa de Ações Disponíveis para Adicionar */}
              <div className="pt-2 border-t border-[#2A4D6E]/60 space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                  <Plus className="h-3 w-3 text-[#AEE4FF]" />
                  <span>Adicionar Ação ao Pipeline:</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {AVAILABLE_MACROS.map((macro) => (
                    <button
                      key={macro.type}
                      type="button"
                      onClick={() => handleAddMacroToPipeline(macro.type)}
                      className={cn(
                        "p-2 rounded-lg border text-left transition-all duration-200 flex flex-col justify-between group",
                        "bg-[#13283E] hover:bg-[#1B3550] border-[#2A4D6E] hover:border-[#AEE4FF]/50"
                      )}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        {macro.type === 'bloquear_migo' && <Lock className="h-3.5 w-3.5 text-[#AEE4FF]" />}
                        {macro.type === 'mover_ajuste' && <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-300" />}
                        {macro.type === 'atualizar_db' && <RefreshCw className="h-3.5 w-3.5 text-emerald-300" />}
                        {macro.type === 'devolver' && <Undo2 className="h-3.5 w-3.5 text-amber-300" />}
                        <Plus className="h-3.5 w-3.5 text-slate-400 group-hover:text-white" />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-200 group-hover:text-white leading-tight">
                        {macro.shortLabel}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[10px] text-amber-300 flex items-center gap-1">
              <span>⚠️ Certifique-se de que o SAP GUI está aberto e o Planilha Sync em execução na sua máquina.</span>
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
              onClick={handleExecuteMacroPipeline}
              disabled={
                macroPipeline.length === 0 ||
                isBloquearMigoRunning ||
                (macroPipeline.some((m) => m.actionType === 'bloquear_migo') &&
                  (bloquearSelectedItems.length === 0 ||
                    bloquearSelectedItems.some((it) => !it.material || !it.lote || !it.quantidade)))
              }
              className="bg-[#AEE4FF] hover:bg-[#86d4fa] text-[#13283E] font-bold gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 fill-current" />
              <span>
                {macroPipeline.length > 0
                  ? `Executar Pipeline (${macroPipeline.length} Etapa${macroPipeline.length > 1 ? 's' : ''}) no SAP`
                  : 'Selecione ao menos 1 etapa'}
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
