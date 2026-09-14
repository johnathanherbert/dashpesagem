'use client';

import { useState, useMemo, useEffect } from 'react';
import { AgingData, ListaTecnicaItem } from '@/types/aging';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Wrench,
  Calculator,
  Search,
  DollarSign,
  Package,
  Plus,
  Trash2,
  Copy,
  Check,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  FlaskConical,
  Scale,
  Percent,
  ListTree,
  FileText,
  Boxes,
  ExternalLink,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchListaTecnica } from '@/lib/api';

interface ToolsViewProps {
  agingData: AgingData[];
  valores: Record<string, number>;
}

interface SimulatedItem {
  id: string;
  material: string;
  descricao: string;
  unidade: string;
  valorUnitario: number;
  quantidade: number;
  valorTotal: number;
}

export function ToolsView({ agingData, valores }: ToolsViewProps) {
  const [selectedTool, setSelectedTool] = useState<'valorizar-mp' | 'lista-tecnica'>('valorizar-mp');

  // --- Estados da Ferramenta: Valorizar MP ---
  const [materialInput, setMaterialInput] = useState('');
  const [quantidadeInput, setQuantidadeInput] = useState('');
  const [customPriceInput, setCustomPriceInput] = useState('');
  const [simulatedItems, setSimulatedItems] = useState<SimulatedItem[]>([]);
  const [copied, setCopied] = useState(false);

  // --- Estados da Ferramenta: Lista Técnica / Onde é Usado ---
  const [ltSearchInput, setLtSearchInput] = useState('');
  const [ltLoading, setLtLoading] = useState(false);
  const [ltResults, setLtResults] = useState<ListaTecnicaItem[]>([]);
  const [ltMode, setLtMode] = useState<'mp' | 'semi'>('mp');

  // Mapeamento de material para descrições e UMB a partir do agingData
  const materialInfoMap = useMemo(() => {
    const map: Record<string, { descricao: string; unidade: string; estoqueTotal: number; lotes: number }> = {};
    agingData.forEach((item) => {
      const mat = item.material.padStart(6, '0');
      if (!map[mat]) {
        map[mat] = {
          descricao: item.texto_breve_material || 'Matéria-Prima',
          unidade: item.unidade_medida || 'KG',
          estoqueTotal: 0,
          lotes: 0,
        };
      }
      map[mat].estoqueTotal += Number(item.estoque_disponivel || 0);
      map[mat].lotes += 1;
    });
    return map;
  }, [agingData]);

  // Normalização do código digitado no Valorizador
  const normalizedMaterial = useMemo(() => {
    const clean = materialInput.trim().replace(/\D/g, '');
    if (!clean) return '';
    return clean.padStart(6, '0');
  }, [materialInput]);

  // Sugestões de materiais ao digitar no Valorizador
  const suggestions = useMemo(() => {
    const query = materialInput.trim().toLowerCase();
    if (!query || query.length < 2) return [];

    const allMaterials = new Set([
      ...Object.keys(valores),
      ...Object.keys(materialInfoMap),
    ]);

    const matches: { material: string; descricao: string; valor: number }[] = [];
    for (const mat of allMaterials) {
      const desc = materialInfoMap[mat]?.descricao || '';
      const val = valores[mat] || valores[mat.replace(/^0+/, '')] || 0;
      if (mat.includes(query) || desc.toLowerCase().includes(query)) {
        matches.push({ material: mat, descricao: desc, valor: val });
        if (matches.length >= 6) break;
      }
    }
    return matches;
  }, [materialInput, valores, materialInfoMap]);

  // Valor unitário cadastrado
  const registeredUnitValue = useMemo(() => {
    if (!normalizedMaterial) return 0;
    const directVal = valores[normalizedMaterial];
    if (directVal !== undefined && directVal !== null) return directVal;
    const strippedVal = valores[normalizedMaterial.replace(/^0+/, '')];
    if (strippedVal !== undefined && strippedVal !== null) return strippedVal;
    return 0;
  }, [normalizedMaterial, valores]);

  // Valor unitário efetivo (permite override manual se não cadastrado)
  const effectiveUnitValue = useMemo(() => {
    if (customPriceInput && !isNaN(parseFloat(customPriceInput.replace(',', '.')))) {
      return parseFloat(customPriceInput.replace(',', '.'));
    }
    return registeredUnitValue;
  }, [customPriceInput, registeredUnitValue]);

  // Info do material selecionado
  const currentMaterialInfo = useMemo(() => {
    if (!normalizedMaterial) return null;
    return materialInfoMap[normalizedMaterial] || {
      descricao: 'Matéria-Prima',
      unidade: 'KG',
      estoqueTotal: 0,
      lotes: 0,
    };
  }, [normalizedMaterial, materialInfoMap]);

  // Quantidade numérica
  const parsedQuantity = useMemo(() => {
    if (!quantidadeInput) return 0;
    const clean = quantidadeInput.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : val;
  }, [quantidadeInput]);

  // Valor total calculado
  const calculatedTotal = useMemo(() => {
    return parsedQuantity * effectiveUnitValue;
  }, [parsedQuantity, effectiveUnitValue]);

  // Formatação monetária
  const formatCurrency = (val: number) => {
    return 'R$ ' + Number(val || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatNumber = (val: number) => {
    return Number(val || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });
  };

  const handleSelectMaterial = (mat: string) => {
    setMaterialInput(mat);
    setCustomPriceInput('');
  };

  const handleAddSimulation = () => {
    if (!normalizedMaterial) {
      toast.error('Informe o código do material');
      return;
    }
    if (parsedQuantity <= 0) {
      toast.error('Informe uma quantidade válida maior que zero');
      return;
    }
    if (effectiveUnitValue <= 0) {
      toast.error('Valor unitário precisa ser maior que zero');
      return;
    }

    const newItem: SimulatedItem = {
      id: `${normalizedMaterial}-${Date.now()}`,
      material: normalizedMaterial,
      descricao: currentMaterialInfo?.descricao || 'Matéria-Prima',
      unidade: currentMaterialInfo?.unidade || 'KG',
      valorUnitario: effectiveUnitValue,
      quantidade: parsedQuantity,
      valorTotal: calculatedTotal,
    };

    setSimulatedItems((prev) => [newItem, ...prev]);
    toast.success(`Material ${normalizedMaterial} adicionado à lista!`);
  };

  const handleRemoveSimulation = (id: string) => {
    setSimulatedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearSimulation = () => {
    setSimulatedItems([]);
  };

  const totalSimulatedValue = useMemo(() => {
    return simulatedItems.reduce((acc, item) => acc + item.valorTotal, 0);
  }, [simulatedItems]);

  const totalSimulatedQty = useMemo(() => {
    return simulatedItems.reduce((acc, item) => acc + item.quantidade, 0);
  }, [simulatedItems]);

  const handleCopySummary = () => {
    if (simulatedItems.length === 0) return;
    const lines = [
      '--- RESUMO DE VALORIZAÇÃO DE MATÉRIAS-PRIMAS ---',
      ...simulatedItems.map(
        (i) => `${i.material} - ${i.descricao}: ${formatNumber(i.quantidade)} ${i.unidade} x ${formatCurrency(i.valorUnitario)} = ${formatCurrency(i.valorTotal)}`
      ),
      '-------------------------------------------------',
      `TOTAL: ${formatNumber(totalSimulatedQty)} itens/kg | VALOR TOTAL: ${formatCurrency(totalSimulatedValue)}`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    toast.success('Resumo copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 2000);
  };

  // --- Busca da Lista Técnica ---
  const handleSearchListaTecnica = async (term?: string, mode?: 'mp' | 'semi') => {
    const q = term !== undefined ? term : ltSearchInput;
    const currentMode = mode || ltMode;
    if (!q || q.trim().length === 0) {
      setLtResults([]);
      return;
    }

    setLtLoading(true);
    try {
      let results: ListaTecnicaItem[] = [];
      const cleanDigits = q.trim().replace(/\D/g, '');

      if (currentMode === 'mp') {
        if (cleanDigits) {
          results = await fetchListaTecnica({ materia_prima: cleanDigits });
        }
        if (results.length === 0) {
          results = await fetchListaTecnica({ search: q.trim() });
        }
      } else {
        if (cleanDigits) {
          results = await fetchListaTecnica({ semi_acabado: cleanDigits });
        }
        if (results.length === 0) {
          results = await fetchListaTecnica({ search: q.trim() });
        }
      }
      setLtResults(results);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao pesquisar na lista técnica');
    } finally {
      setLtLoading(false);
    }
  };

  const handleGoToValorizar = (mat: string, qtd?: number) => {
    setMaterialInput(mat);
    if (qtd) setQuantidadeInput(String(qtd));
    setSelectedTool('valorizar-mp');
  };

  const handleGoToWhereUsed = (mat: string) => {
    setLtSearchInput(mat);
    setLtMode('mp');
    setSelectedTool('lista-tecnica');
    handleSearchListaTecnica(mat, 'mp');
  };

  return (
    <div className="space-y-6">
      {/* Header da Página Tools */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-ems-border">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#1B3550] border border-[#2A4D6E] text-[#AEE4FF]">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase text-white tracking-wide">
                Central de Ferramentas & Utilidades
              </h2>
              <p className="text-xs text-ems-steel mt-0.5">
                Utilitários de apoio operacional, valorização de matérias-primas, lista técnica (BOM) e simulações
              </p>
            </div>
          </div>
        </div>

        {/* Badges de Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-[#1B3550] border border-[#2A4D6E] text-[#AEE4FF] text-xs font-mono">
            {Object.keys(valores).length} Preços Cadastrados
          </Badge>
          <Badge className="bg-[#1B3550] border border-[#2A4D6E] text-emerald-400 text-xs font-mono">
            3.805 Fórmulas / Lista Técnica
          </Badge>
        </div>
      </div>

      {/* Navegação entre ferramentas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Tool 1: Valorizar MP */}
        <button
          onClick={() => setSelectedTool('valorizar-mp')}
          className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden ${
            selectedTool === 'valorizar-mp'
              ? 'bg-[#1B3550] border-[#AEE4FF] shadow-md ring-1 ring-[#AEE4FF]/40'
              : 'bg-[#13283E]/80 border-[#2A4D6E] hover:bg-[#1B3550] opacity-80 hover:opacity-100'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="p-2 rounded-lg bg-[#AEE4FF]/10 text-[#AEE4FF]">
              <Calculator className="h-4 w-4" />
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Ativo
            </span>
          </div>
          <h3 className="text-sm font-bold text-white">Valorizar MP</h3>
          <p className="text-[11px] text-ems-steel mt-0.5">
            Cálculo de valor unitário e total por quantidade de matéria-prima
          </p>
        </button>

        {/* Tool 2: Lista Técnica / Onde é Usado */}
        <button
          onClick={() => setSelectedTool('lista-tecnica')}
          className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden ${
            selectedTool === 'lista-tecnica'
              ? 'bg-[#1B3550] border-[#AEE4FF] shadow-md ring-1 ring-[#AEE4FF]/40'
              : 'bg-[#13283E]/80 border-[#2A4D6E] hover:bg-[#1B3550] opacity-80 hover:opacity-100'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="p-2 rounded-lg bg-[#AEE4FF]/10 text-[#AEE4FF]">
              <ListTree className="h-4 w-4" />
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-[#AEE4FF] border border-sky-500/30">
              Lista Técnica
            </span>
          </div>
          <h3 className="text-sm font-bold text-white">Onde é Usado? (BOM)</h3>
          <p className="text-[11px] text-ems-steel mt-0.5">
            Descubra em quais produtos/fórmulas a matéria-prima é consumida
          </p>
        </button>

        {/* Tool 3: Em Breve - Simulador de Descarte */}
        <div className="p-3.5 rounded-xl border border-[#2A4D6E]/50 bg-[#13283E]/40 opacity-60 text-left cursor-not-allowed">
          <div className="flex items-center justify-between mb-1.5">
            <div className="p-2 rounded-lg bg-ems-border/40 text-ems-steel">
              <Scale className="h-4 w-4" />
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-ems-border text-ems-steel">
              Em breve
            </span>
          </div>
          <h3 className="text-sm font-bold text-slate-300">Simulador de Descarte</h3>
          <p className="text-[11px] text-ems-steel mt-0.5">
            Cálculo financeiro de perdas, quebras e descartes operacionais
          </p>
        </div>

        {/* Tool 4: Em Breve - Conversor & Densidade */}
        <div className="p-3.5 rounded-xl border border-[#2A4D6E]/50 bg-[#13283E]/40 opacity-60 text-left cursor-not-allowed">
          <div className="flex items-center justify-between mb-1.5">
            <div className="p-2 rounded-lg bg-ems-border/40 text-ems-steel">
              <FlaskConical className="h-4 w-4" />
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-ems-border text-ems-steel">
              Em breve
            </span>
          </div>
          <h3 className="text-sm font-bold text-slate-300">Conversor de Densidade</h3>
          <p className="text-[11px] text-ems-steel mt-0.5">
            Conversão rápida entre Litros, Quilos e Densidade padrão
          </p>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* CONTEÚDO DA FERRAMENTA 1: VALORIZAR MP */}
      {/* ==================================================================== */}
      {selectedTool === 'valorizar-mp' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Coluna Esquerda: Formulário de Entrada (5 colunas) */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="bg-[#13283E] border-[#2A4D6E] text-white shadow-lg">
                <CardHeader className="pb-3 border-b border-[#2A4D6E]/60">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-[#1B3550] text-[#AEE4FF]">
                      <Calculator className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-white">
                        Parâmetros da Matéria-Prima
                      </CardTitle>
                      <CardDescription className="text-xs text-ems-steel">
                        Informe o código do material e a quantidade desejada
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  {/* Campo 1: Código do Material */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                      <span>Código do Material (SAP)</span>
                      {normalizedMaterial && (
                        <span className="text-[10px] font-mono text-[#AEE4FF]">
                          Código formatado: {normalizedMaterial}
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Ex: 010013 ou 10013"
                        value={materialInput}
                        onChange={(e) => setMaterialInput(e.target.value)}
                        className="bg-[#1B3550] border-[#2A4D6E] text-white font-mono text-sm placeholder:text-slate-500 pr-9 focus:border-[#AEE4FF] focus:ring-1 focus:ring-[#AEE4FF]"
                      />
                      <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Sugestões de Materiais */}
                    {suggestions.length > 0 && (
                      <div className="p-1.5 rounded-lg bg-[#1B3550] border border-[#2A4D6E] space-y-1 shadow-md">
                        <p className="text-[10px] font-semibold text-ems-steel px-2 py-0.5">Sugestões:</p>
                        {suggestions.map((sug) => (
                          <button
                            key={sug.material}
                            type="button"
                            onClick={() => handleSelectMaterial(sug.material)}
                            className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs text-left hover:bg-[#234465] transition-colors"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <span className="font-mono font-bold text-[#AEE4FF]">{sug.material}</span>
                              <span className="text-slate-300 text-[11px] truncate block">
                                {sug.descricao || 'Sem descrição'}
                              </span>
                            </div>
                            <span className="text-emerald-400 font-mono text-[11px] shrink-0">
                              {formatCurrency(sug.valor)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Informações detalhadas do Material encontrado */}
                  {normalizedMaterial && (
                    <div className="p-3 rounded-xl bg-[#1B3550]/70 border border-[#2A4D6E] space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase font-bold text-ems-steel">Descrição</p>
                          <p className="text-xs font-semibold text-white leading-tight mt-0.5">
                            {currentMaterialInfo?.descricao || 'Matéria-Prima não detalhada no estoque'}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-[10px] ${
                            registeredUnitValue > 0
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {registeredUnitValue > 0 ? 'Preço Base OK' : 'Sem Preço Base'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#2A4D6E]/50 text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-ems-steel block">Unidade:</span>
                          <span className="text-white font-bold">{currentMaterialInfo?.unidade || 'KG'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-ems-steel block">Em Estoque:</span>
                          <span className="text-[#AEE4FF] font-bold">
                            {formatNumber(currentMaterialInfo?.estoqueTotal || 0)} {currentMaterialInfo?.unidade || 'KG'}
                          </span>
                        </div>
                      </div>

                      {/* Atalho para Lista Técnica */}
                      <button
                        type="button"
                        onClick={() => handleGoToWhereUsed(normalizedMaterial)}
                        className="w-full flex items-center justify-center gap-1.5 py-1 text-[11px] font-semibold text-[#AEE4FF] hover:bg-[#234465] rounded-lg transition-colors mt-1 border border-[#2A4D6E]/50"
                      >
                        <ListTree className="h-3.5 w-3.5" />
                        <span>Ver Fórmulas / Onde é usado este material</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Campo 2: Quantidade */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                      <span>Quantidade ({currentMaterialInfo?.unidade || 'KG'})</span>
                      {currentMaterialInfo && currentMaterialInfo.estoqueTotal > 0 && (
                        <button
                          type="button"
                          onClick={() => setQuantidadeInput(String(currentMaterialInfo.estoqueTotal))}
                          className="text-[10px] text-[#AEE4FF] hover:underline"
                        >
                          Usar Estoque Atual ({formatNumber(currentMaterialInfo.estoqueTotal)})
                        </button>
                      )}
                    </label>
                    <Input
                      type="text"
                      placeholder="Ex: 50,00 ou 1250"
                      value={quantidadeInput}
                      onChange={(e) => setQuantidadeInput(e.target.value)}
                      className="bg-[#1B3550] border-[#2A4D6E] text-white font-mono text-sm placeholder:text-slate-500 focus:border-[#AEE4FF] focus:ring-1 focus:ring-[#AEE4FF]"
                    />

                    {/* Botões rápidos de quantidade */}
                    <div className="flex items-center gap-1.5 pt-1">
                      {[1, 5, 10, 50, 100, 500].map((qty) => (
                        <button
                          key={qty}
                          type="button"
                          onClick={() => setQuantidadeInput(String(qty))}
                          className="px-2 py-0.5 rounded bg-[#1B3550] border border-[#2A4D6E] text-[10px] font-mono text-slate-300 hover:bg-[#234465] hover:text-[#AEE4FF] transition-colors"
                        >
                          +{qty}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Campo 3: Ajuste / Override de Preço Unitário (caso não cadastrado) */}
                  {registeredUnitValue === 0 && normalizedMaterial && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>Preço unitário não encontrado no banco</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Insira um valor unitário personalizado para calcular a valorização:
                      </p>
                      <Input
                        type="text"
                        placeholder="Ex: 24,50"
                        value={customPriceInput}
                        onChange={(e) => setCustomPriceInput(e.target.value)}
                        className="bg-[#13283E] border-amber-500/30 text-white font-mono text-xs focus:border-amber-400"
                      />
                    </div>
                  )}

                  {/* Botão de Adicionar à Cesta de Simulação */}
                  <Button
                    onClick={handleAddSimulation}
                    disabled={!normalizedMaterial || parsedQuantity <= 0 || effectiveUnitValue <= 0}
                    className="w-full bg-[#AEE4FF] hover:bg-[#86d4fa] text-[#13283E] font-bold text-xs h-10 gap-2 shadow-md transition-all disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Adicionar à Lista de Simulação</span>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Coluna Direita: Cards de Resultado & Totalização (7 colunas) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Card Principal de Resultado ao Vivo */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-[#1B3550] via-[#13283E] to-[#0D1F31] border border-[#2A4D6E] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#AEE4FF] flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-[#AEE4FF]" />
                    Resultado da Valorização
                  </span>
                  {normalizedMaterial && (
                    <Badge className="bg-[#13283E] text-[#AEE4FF] border border-[#2A4D6E] font-mono text-xs">
                      MP: {normalizedMaterial}
                    </Badge>
                  )}
                </div>

                {/* Grande Display do Valor Total */}
                <div className="my-4">
                  <p className="text-xs text-ems-steel font-medium">Valor Total Calculado:</p>
                  <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono text-emerald-400 tracking-tight mt-1 flex items-baseline gap-2">
                    <span>{formatCurrency(calculatedTotal)}</span>
                  </div>
                </div>

                {/* Fórmula e Detalhes do Cálculo */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[#2A4D6E]/60 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#13283E]/80 border border-[#2A4D6E]/40 font-mono">
                    <span className="text-[10px] text-ems-steel block uppercase font-sans">Valor Unitário:</span>
                    <span className="text-base font-bold text-white">
                      {formatCurrency(effectiveUnitValue)}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      por {currentMaterialInfo?.unidade || 'KG'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#13283E]/80 border border-[#2A4D6E]/40 font-mono">
                    <span className="text-[10px] text-ems-steel block uppercase font-sans">Qtd. Informada:</span>
                    <span className="text-base font-bold text-[#AEE4FF]">
                      {formatNumber(parsedQuantity)}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {currentMaterialInfo?.unidade || 'KG'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#13283E]/80 border border-[#2A4D6E]/40 font-mono">
                    <span className="text-[10px] text-ems-steel block uppercase font-sans">Estoque Total MP:</span>
                    <span className="text-base font-bold text-slate-300">
                      {formatCurrency((currentMaterialInfo?.estoqueTotal || 0) * effectiveUnitValue)}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      ({formatNumber(currentMaterialInfo?.estoqueTotal || 0)} {currentMaterialInfo?.unidade || 'KG'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Tabela / Lista de Simulação Acumulada */}
              <Card className="bg-[#13283E] border-[#2A4D6E] text-white shadow-lg">
                <CardHeader className="pb-3 border-b border-[#2A4D6E]/60 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                      <Layers className="h-4 w-4 text-[#AEE4FF]" />
                      <span>Lista de Itens Valorizados</span>
                      {simulatedItems.length > 0 && (
                        <Badge className="bg-[#AEE4FF] text-[#13283E] font-bold text-[10px] ml-1">
                          {simulatedItems.length}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs text-ems-steel">
                      Acumule múltiplas matérias-primas para somar o valor total de uma lista ou batelada
                    </CardDescription>
                  </div>

                  {simulatedItems.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopySummary}
                        className="h-7 text-xs bg-[#1B3550] border-[#2A4D6E] text-slate-200 hover:text-white gap-1"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>Copiar</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleClearSimulation}
                        className="h-7 text-xs text-[#E75B5B] hover:bg-[#E75B5B]/10 hover:text-[#E75B5B] gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Limpar</span>
                      </Button>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="pt-3">
                  {simulatedItems.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 space-y-2">
                      <Calculator className="h-8 w-8 mx-auto text-ems-steel/50" />
                      <p className="text-xs text-slate-400">Nenhum item adicionado à lista ainda.</p>
                      <p className="text-[11px] text-ems-steel">
                        Preencha os dados do material à esquerda e clique em "Adicionar à Lista".
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Tabela de Itens */}
                      <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-[#2A4D6E] text-[#608BA6] text-left">
                              <th className="pb-2 font-semibold">Material</th>
                              <th className="pb-2 font-semibold">Descrição</th>
                              <th className="pb-2 font-semibold text-right">Qtd</th>
                              <th className="pb-2 font-semibold text-right">Vl. Unit.</th>
                              <th className="pb-2 font-semibold text-right">Total</th>
                              <th className="pb-2 text-center w-8"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2A4D6E]/40 font-mono">
                            {simulatedItems.map((item) => (
                              <tr key={item.id} className="hover:bg-[#1B3550]/40 transition-colors">
                                <td className="py-2.5 font-bold text-[#AEE4FF]">{item.material}</td>
                                <td className="py-2.5 font-sans text-slate-200 max-w-[180px] truncate">
                                  {item.descricao}
                                </td>
                                <td className="py-2.5 text-right text-white">
                                  {formatNumber(item.quantidade)} {item.unidade}
                                </td>
                                <td className="py-2.5 text-right text-slate-300">
                                  {formatCurrency(item.valorUnitario)}
                                </td>
                                <td className="py-2.5 text-right font-bold text-emerald-400">
                                  {formatCurrency(item.valorTotal)}
                                </td>
                                <td className="py-2.5 text-center">
                                  <button
                                    onClick={() => handleRemoveSimulation(item.id)}
                                    className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                                    title="Remover item"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Card de Total Geral da Lista */}
                      <div className="p-3 rounded-xl bg-[#1B3550] border border-[#2A4D6E] flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-ems-steel uppercase font-bold block">
                            Total Geral da Lista ({simulatedItems.length} {simulatedItems.length === 1 ? 'item' : 'itens'}):
                          </span>
                          <span className="text-xs font-mono text-slate-300">
                            Volume: {formatNumber(totalSimulatedQty)} KG
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-black font-mono text-emerald-400">
                            {formatCurrency(totalSimulatedValue)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* CONTEÚDO DA FERRAMENTA 2: LISTA TÉCNICA (ONDE É USADO / BOM) */}
      {/* ==================================================================== */}
      {selectedTool === 'lista-tecnica' && (
        <div className="space-y-6">
          <Card className="bg-[#13283E] border-[#2A4D6E] text-white shadow-lg">
            <CardHeader className="pb-4 border-b border-[#2A4D6E]/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#1B3550] text-[#AEE4FF]">
                    <ListTree className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-white">
                      Consulta de Lista Técnica & Onde é Usado (BOM)
                    </CardTitle>
                    <CardDescription className="text-xs text-ems-steel">
                      Consulte em quais produtos/semi-acabados uma matéria-prima é usada, ou veja todas as MPs de uma fórmula
                    </CardDescription>
                  </div>
                </div>

                {/* Alternador de Modo de Pesquisa */}
                <div className="flex items-center gap-1 bg-[#1B3550] p-1 rounded-xl border border-[#2A4D6E]">
                  <button
                    onClick={() => {
                      setLtMode('mp');
                      if (ltSearchInput) handleSearchListaTecnica(ltSearchInput, 'mp');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      ltMode === 'mp'
                        ? 'bg-[#AEE4FF] text-[#13283E] font-bold shadow-xs'
                        : 'text-[#608BA6] hover:text-white'
                    }`}
                  >
                    Por Matéria-Prima (Onde vai?)
                  </button>
                  <button
                    onClick={() => {
                      setLtMode('semi');
                      if (ltSearchInput) handleSearchListaTecnica(ltSearchInput, 'semi');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      ltMode === 'semi'
                        ? 'bg-[#AEE4FF] text-[#13283E] font-bold shadow-xs'
                        : 'text-[#608BA6] hover:text-white'
                    }`}
                  >
                    Por Semi-Acabado (Fórmula)
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Barra de Busca */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type="text"
                    placeholder={
                      ltMode === 'mp'
                        ? 'Digite código da MP (ex: 010013) ou nome da matéria-prima...'
                        : 'Digite código do semi-acabado (ex: 700013) ou nome do produto...'
                    }
                    value={ltSearchInput}
                    onChange={(e) => setLtSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchListaTecnica()}
                    className="bg-[#1B3550] border-[#2A4D6E] text-white font-mono text-sm placeholder:text-slate-500 pr-9 focus:border-[#AEE4FF]"
                  />
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
                <Button
                  onClick={() => handleSearchListaTecnica()}
                  disabled={ltLoading || !ltSearchInput.trim()}
                  className="bg-[#AEE4FF] hover:bg-[#86d4fa] text-[#13283E] font-bold text-xs h-10 px-5 gap-1.5"
                >
                  {ltLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span>Pesquisar</span>
                </Button>
              </div>

              {/* Sugestões rápidas de pesquisa */}
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-ems-steel">
                <span>Sugestões rápidas:</span>
                {['010013', '010071', '010311', '700013', '700024'].map((code) => (
                  <button
                    key={code}
                    onClick={() => {
                      setLtSearchInput(code);
                      const mode = code.startsWith('7') ? 'semi' : 'mp';
                      setLtMode(mode);
                      handleSearchListaTecnica(code, mode);
                    }}
                    className="px-2 py-0.5 rounded bg-[#1B3550] hover:bg-[#234465] text-[#AEE4FF] font-mono border border-[#2A4D6E]"
                  >
                    {code}
                  </button>
                ))}
              </div>

              {/* Resultados da Pesquisa */}
              {ltLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Loader2 className="h-7 w-7 animate-spin text-[#AEE4FF]" />
                    <span className="text-xs">Consultando banco de dados de lista técnica...</span>
                  </div>
                </div>
              ) : ltResults.length > 0 ? (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      Encontrados <strong className="text-[#AEE4FF]">{ltResults.length}</strong> vínculos de lista técnica:
                    </span>
                    <Badge className="bg-[#1B3550] text-[#AEE4FF] border border-[#2A4D6E] text-[10px]">
                      Centro 600
                    </Badge>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-[#2A4D6E]">
                    <table className="w-full text-xs">
                      <thead className="bg-[#1B3550] text-[#AEE4FF]">
                        <tr className="border-b border-[#2A4D6E] text-left">
                          <th className="py-2.5 px-3 font-bold">Matéria-Prima</th>
                          <th className="py-2.5 px-3 font-bold">Descrição MP</th>
                          <th className="py-2.5 px-3 font-bold text-right">Qtd MP / Lote</th>
                          <th className="py-2.5 px-3 font-bold">Semi-Acabado (Produto)</th>
                          <th className="py-2.5 px-3 font-bold">Descrição Semi-Acabado</th>
                          <th className="py-2.5 px-3 font-bold text-right">Tamanho Lote</th>
                          <th className="py-2.5 px-3 text-center font-bold">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2A4D6E]/40 font-mono">
                        {ltResults.map((row) => (
                          <tr key={row.id || `${row.materia_prima}-${row.semi_acabado}`} className="hover:bg-[#1B3550]/40 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-[#AEE4FF]">
                              {row.materia_prima}
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-200">
                              {row.descricao_materia_prima}
                            </td>
                            <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                              {formatNumber(row.qtd_materia_prima)} {row.un_materia_prima}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-amber-300">
                              {row.semi_acabado}
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-200">
                              {row.descricao_semi_acabado}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-300">
                              {formatNumber(row.qtd_semi_acabado)} UN
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleGoToValorizar(row.materia_prima, row.qtd_materia_prima)}
                                className="h-6 text-[10px] px-2 bg-[#1B3550] border-[#2A4D6E] text-[#AEE4FF] hover:bg-[#AEE4FF] hover:text-[#13283E] gap-1"
                                title="Valorizar esta quantidade"
                              >
                                <Calculator className="h-3 w-3" />
                                <span>Valorizar</span>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : ltSearchInput.trim() ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <ListTree className="h-8 w-8 mx-auto text-ems-steel/50" />
                  <p className="text-xs text-slate-400">Nenhum registro encontrado na lista técnica para "{ltSearchInput}".</p>
                  <p className="text-[11px] text-ems-steel">
                    Tente buscar por partes do nome ou código sem zeros à esquerda.
                  </p>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <ListTree className="h-8 w-8 mx-auto text-ems-steel/50" />
                  <p className="text-xs text-slate-400">Digite um código ou descrição acima para pesquisar.</p>
                  <p className="text-[11px] text-ems-steel">
                    A base contém mais de 3.800 relações de fórmulas e consumos de matérias-primas.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
