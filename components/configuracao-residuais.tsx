'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  Plus,
  X,
  Save,
  Loader2,
  AlertTriangle,
  Clock,
  Scale,
  ShieldAlert,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  CalendarClock,
} from 'lucide-react';
import { ConfiguracaoResiduais } from '@/types/aging';
import { fetchConfiguracaoResiduais, saveConfiguracaoResiduais } from '@/lib/api';
import toast from 'react-hot-toast';

interface ConfiguracaoResiduaisProps {
  onConfigChange?: () => void;
}

const DEFAULT_CONFIG: ConfiguracaoResiduais = {
  limite_verde: 100,
  limite_amarelo: 900,
  limite_maximo: 999,
  materiais_alto_valor: [],
  dias_atencao: 3,
  dias_alerta: 7,
  dias_critico: 20,
  dias_vencimento_proximo: 30,
};

export function ConfiguracaoResiduaisComponent({ onConfigChange }: ConfiguracaoResiduaisProps) {
  const [config, setConfig] = useState<ConfiguracaoResiduais>(DEFAULT_CONFIG);
  const [novoMaterial, setNovoMaterial] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await fetchConfiguracaoResiduais();
      setConfig({
        ...DEFAULT_CONFIG,
        ...data,
      });
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validações de integridade
    const diasAlerta = Number(config.dias_alerta ?? 7);
    const diasCritico = Number(config.dias_critico ?? 20);

    if (diasAlerta >= diasCritico) {
      toast.error('O número de dias para Alerta deve ser menor que o de Crítico.');
      return;
    }

    if (config.limite_verde >= config.limite_amarelo || config.limite_amarelo >= config.limite_maximo) {
      toast.error('Os limites em gramas devem seguir a ordem: Verde < Amarelo < Vermelho (Máximo).');
      return;
    }

    setSaving(true);
    try {
      await saveConfiguracaoResiduais(config);
      toast.success('Configurações salvas com sucesso!');
      if (onConfigChange) {
        onConfigChange();
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast.error('Erro ao salvar configuração.');
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreDefaults = () => {
    setConfig({
      ...DEFAULT_CONFIG,
      materiais_alto_valor: config.materiais_alto_valor, // preserva materiais já cadastrados
    });
    toast.success('Valores padrão restaurados (clique em Salvar para persistir).');
  };

  const handleAddMaterial = () => {
    const materialTrimmed = novoMaterial.trim().toUpperCase();
    if (!materialTrimmed) return;

    if (config.materiais_alto_valor.includes(materialTrimmed)) {
      toast.error('Material já está na lista.');
      return;
    }

    setConfig({
      ...config,
      materiais_alto_valor: [...config.materiais_alto_valor, materialTrimmed],
    });
    setNovoMaterial('');
  };

  const handleRemoveMaterial = (material: string) => {
    setConfig({
      ...config,
      materiais_alto_valor: config.materiais_alto_valor.filter((m) => m !== material),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-ems-card rounded-2xl border border-ems-border">
        <Loader2 className="h-7 w-7 animate-spin text-[#AEE4FF]" />
        <span className="ml-3 text-sm text-[#608BA6] font-medium">Carregando configurações...</span>
      </div>
    );
  }

  const diasAtencao = Number(config.dias_atencao ?? 3);
  const diasAlerta = Number(config.dias_alerta ?? 7);
  const diasCritico = Number(config.dias_critico ?? 20);
  const diasVencimento = Number(config.dias_vencimento_proximo ?? 30);

  return (
    <div className="space-y-6">
      {/* SEÇÃO 1: FAIXAS DE AGING (DIAS DE ESTOQUE) */}
      <Card className="bg-ems-card border border-ems-border shadow-xl overflow-hidden">
        <CardHeader className="border-b border-ems-border/80 bg-[#13283E]/60 pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#1B3550] border border-[#2A4D6E] text-[#AEE4FF]">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-black tracking-wide text-white uppercase">
                  Faixas de Aging (Dias em Estoque)
                </CardTitle>
                <CardDescription className="text-xs text-[#608BA6]">
                  Defina os limites de dias para classificação de criticidade dos lotes e alertas
                </CardDescription>
              </div>
            </div>
            <Badge className="bg-[#1B3550] text-[#AEE4FF] border border-[#2A4D6E] font-mono text-xs">
              Métricas de Tempo
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Grid de Inputs de Dias */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 1. Dias para Alerta */}
            <div className="p-4 rounded-xl bg-[#13283E]/70 border border-[#2A4D6E]/80 space-y-2">
              <Label htmlFor="dias-alerta" className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Início Alerta</span>
                <Badge className="bg-[#E29A36]/15 text-[#E29A36] border border-[#E29A36]/30 text-[10px] px-1.5">
                  Alerta
                </Badge>
              </Label>
              <div className="relative">
                <Input
                  id="dias-alerta"
                  type="number"
                  min="1"
                  max={diasCritico - 1}
                  value={diasAlerta}
                  onChange={(e) => setConfig({ ...config, dias_alerta: parseInt(e.target.value) || 0 })}
                  className="bg-[#1B3550] border-[#2A4D6E] text-white font-mono font-bold text-sm focus:border-[#AEE4FF]"
                />
              </div>
              <p className="text-[11px] text-[#608BA6]">
                Abaixo de {diasAlerta}d é <strong>Normal</strong>; Alerta de <strong className="text-[#E29A36]">{diasAlerta} a {diasCritico - 1}d</strong>
              </p>
            </div>

            {/* 2. Dias para Crítico */}
            <div className="p-4 rounded-xl bg-[#13283E]/70 border border-[#2A4D6E]/80 space-y-2">
              <Label htmlFor="dias-critico" className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Início Crítico</span>
                <Badge className="bg-[#E75B5B]/15 text-[#E75B5B] border border-[#E75B5B]/30 text-[10px] px-1.5">
                  Crítico
                </Badge>
              </Label>
              <div className="relative">
                <Input
                  id="dias-critico"
                  type="number"
                  min={diasAlerta + 1}
                  value={diasCritico}
                  onChange={(e) => setConfig({ ...config, dias_critico: parseInt(e.target.value) || 0 })}
                  className="bg-[#1B3550] border-[#2A4D6E] text-white font-mono font-bold text-sm focus:border-[#AEE4FF]"
                />
              </div>
              <p className="text-[11px] text-[#608BA6]">
                Lotes em criticidade com <strong className="text-[#E75B5B]">≥ {diasCritico} dias</strong>
              </p>
            </div>

            {/* 3. Dias de Vencimento Próximo */}
            <div className="p-4 rounded-xl bg-[#13283E]/70 border border-[#2A4D6E]/80 space-y-2">
              <Label htmlFor="dias-vencimento" className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Vencimento Próximo</span>
                <Badge className="bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] px-1.5">
                  Validade
                </Badge>
              </Label>
              <div className="relative">
                <Input
                  id="dias-vencimento"
                  type="number"
                  min="1"
                  value={diasVencimento}
                  onChange={(e) => setConfig({ ...config, dias_vencimento_proximo: parseInt(e.target.value) || 0 })}
                  className="bg-[#1B3550] border-[#2A4D6E] text-white font-mono font-bold text-sm focus:border-[#AEE4FF]"
                />
              </div>
              <p className="text-[11px] text-[#608BA6]">
                Vencendo nos próximos <strong className="text-purple-300">{diasVencimento} dias</strong>
              </p>
            </div>
          </div>

          {/* Visualizador da Barra de Aging */}
          <div className="p-4 rounded-2xl bg-[#1B3550]/60 border border-[#2A4D6E] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#AEE4FF]" />
                Visualização da Régua de Aging
              </span>
              <span className="text-[#608BA6] font-mono text-[11px]">
                Normal: &lt;{diasAlerta}d • Alerta: {diasAlerta}–{diasCritico - 1}d • Crítico: ≥{diasCritico}d
              </span>
            </div>

            <div className="h-6 w-full rounded-xl overflow-hidden flex border border-[#2A4D6E] shadow-inner font-mono text-[11px] font-bold text-center leading-6">
              <div
                style={{ width: `${Math.max(25, (diasAlerta / (diasCritico * 1.3)) * 100)}%` }}
                className="bg-[#AEE4FF] text-[#13283E] transition-all flex items-center justify-center truncate px-2"
                title={`Normal: 0 a ${diasAlerta - 1} dias`}
              >
                Normal (&lt;{diasAlerta}d)
              </div>
              <div
                style={{ width: `${Math.max(30, ((diasCritico - diasAlerta) / (diasCritico * 1.3)) * 100)}%` }}
                className="bg-[#E29A36] text-[#13283E] transition-all flex items-center justify-center truncate px-2"
                title={`Alerta: ${diasAlerta} a ${diasCritico - 1} dias`}
              >
                Alerta ({diasAlerta}–{diasCritico - 1}d)
              </div>
              <div
                className="bg-[#E75B5B] text-white flex-1 transition-all flex items-center justify-center truncate px-2"
                title={`Crítico: ≥ ${diasCritico} dias`}
              >
                Crítico (≥{diasCritico}d)
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 2: FAIXAS DE SALDOS RESIDUAIS (GRAMAS) */}
      <Card className="bg-ems-card border border-ems-border shadow-xl overflow-hidden">
        <CardHeader className="border-b border-ems-border/80 bg-[#13283E]/60 pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#1B3550] border border-[#2A4D6E] text-[#AEE4FF]">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-black tracking-wide text-white uppercase">
                  Faixas de Saldos Residuais (Gramas)
                </CardTitle>
                <CardDescription className="text-xs text-[#608BA6]">
                  Configure os limites em gramas para classificação dos saldos no depósito PES
                </CardDescription>
              </div>
            </div>
            <Badge className="bg-[#1B3550] text-[#AEE4FF] border border-[#2A4D6E] font-mono text-xs">
              Pesagem & Sobras
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Verde */}
            <div className="p-4 rounded-xl bg-[#13283E]/70 border border-[#2A4D6E]/80 space-y-2">
              <Label htmlFor="limite-verde" className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Verde / Leve</span>
                <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] px-1.5">
                  Até {config.limite_verde}g
                </Badge>
              </Label>
              <Input
                id="limite-verde"
                type="number"
                value={config.limite_verde}
                onChange={(e) => setConfig({ ...config, limite_verde: parseInt(e.target.value) || 0 })}
                min="0"
                step="10"
                className="bg-[#1B3550] border-[#2A4D6E] text-white font-mono font-bold text-sm focus:border-[#AEE4FF]"
              />
              <p className="text-[11px] text-[#608BA6]">Saldos residuais de 0g a {config.limite_verde}g</p>
            </div>

            {/* Amarelo */}
            <div className="p-4 rounded-xl bg-[#13283E]/70 border border-[#2A4D6E]/80 space-y-2">
              <Label htmlFor="limite-amarelo" className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Amarelo / Médio</span>
                <Badge className="bg-[#E29A36]/15 text-[#E29A36] border border-[#E29A36]/30 text-[10px] px-1.5">
                  Até {config.limite_amarelo}g
                </Badge>
              </Label>
              <Input
                id="limite-amarelo"
                type="number"
                value={config.limite_amarelo}
                onChange={(e) => setConfig({ ...config, limite_amarelo: parseInt(e.target.value) || 0 })}
                min={config.limite_verde}
                step="50"
                className="bg-[#1B3550] border-[#2A4D6E] text-white font-mono font-bold text-sm focus:border-[#AEE4FF]"
              />
              <p className="text-[11px] text-[#608BA6]">Saldos de {config.limite_verde}g a {config.limite_amarelo}g</p>
            </div>

            {/* Vermelho / Máximo Residual */}
            <div className="p-4 rounded-xl bg-[#13283E]/70 border border-[#2A4D6E]/80 space-y-2">
              <Label htmlFor="limite-maximo" className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Vermelho / Alto</span>
                <Badge className="bg-[#E75B5B]/15 text-[#E75B5B] border border-[#E75B5B]/30 text-[10px] px-1.5">
                  Até {config.limite_maximo}g
                </Badge>
              </Label>
              <Input
                id="limite-maximo"
                type="number"
                value={config.limite_maximo}
                onChange={(e) => setConfig({ ...config, limite_maximo: parseInt(e.target.value) || 0 })}
                min={config.limite_amarelo}
                step="50"
                className="bg-[#1B3550] border-[#2A4D6E] text-white font-mono font-bold text-sm focus:border-[#AEE4FF]"
              />
              <p className="text-[11px] text-[#608BA6]">Saldos de {config.limite_amarelo}g a {config.limite_maximo}g</p>
            </div>

            {/* Estoque Normal */}
            <div className="p-4 rounded-xl bg-[#13283E]/70 border border-[#2A4D6E]/80 space-y-2 opacity-80">
              <Label className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Estoque Normal</span>
                <Badge variant="outline" className="text-[10px] px-1.5 border-[#2A4D6E] text-[#608BA6]">
                  Padrão
                </Badge>
              </Label>
              <Input
                value={`> ${config.limite_maximo}g (≥ 1 KG)`}
                disabled
                className="bg-[#1B3550]/40 border-[#2A4D6E] text-[#AEE4FF] font-mono font-bold text-sm cursor-not-allowed"
              />
              <p className="text-[11px] text-[#608BA6]">Não classificado como residual</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 bg-[#1B3550]/60 border border-[#2A4D6E] rounded-xl text-xs text-slate-200">
            <AlertTriangle className="h-4 w-4 text-[#E29A36] mt-0.5 shrink-0" />
            <div>
              <strong className="text-white">Regra de Conversão:</strong> Apenas saldos de pesagem até{' '}
              <span className="text-[#AEE4FF] font-bold">{config.limite_maximo}g</span> são analisados na esteira de
              residuais. Lotes acima desse valor são tratados como estoque pleno de produção.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 3: MATERIAIS DE EXTREMA ATENÇÃO / ALTO VALOR */}
      <Card className="bg-ems-card border border-ems-border shadow-xl overflow-hidden">
        <CardHeader className="border-b border-ems-border/80 bg-[#13283E]/60 pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#1B3550] border border-[#2A4D6E] text-[#AEE4FF]">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-black tracking-wide text-white uppercase">
                  Materiais de Extrema Atenção (Alto Valor)
                </CardTitle>
                <CardDescription className="text-xs text-[#608BA6]">
                  Materiais de altíssimo valor que NÃO devem ser desconsiderados ou tratados como sobras comuns
                </CardDescription>
              </div>
            </div>
            <Badge className="bg-[#1B3550] text-[#AEE4FF] border border-[#2A4D6E] font-mono text-xs">
              {config.materiais_alto_valor.length} cadastrados
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <div className="flex gap-2.5 max-w-md">
            <Input
              placeholder="Código do material (ex: 011370)"
              value={novoMaterial}
              onChange={(e) => setNovoMaterial(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddMaterial();
                }
              }}
              className="bg-[#1B3550] border-[#2A4D6E] text-white font-mono text-xs focus:border-[#AEE4FF]"
            />
            <Button
              onClick={handleAddMaterial}
              variant="outline"
              size="sm"
              className="bg-[#1B3550] hover:bg-[#234465] text-[#AEE4FF] border-[#2A4D6E] font-bold"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>

          {config.materiais_alto_valor.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-2">
              {config.materiais_alto_valor.map((material) => (
                <Badge
                  key={material}
                  className="bg-[#1B3550] hover:bg-[#234465] text-[#AEE4FF] border border-[#2A4D6E] px-3 py-1.5 text-xs font-mono font-bold flex items-center gap-2 rounded-xl shadow-xs"
                >
                  <span>{material}</span>
                  <button
                    onClick={() => handleRemoveMaterial(material)}
                    className="text-[#608BA6] hover:text-[#E75B5B] transition-colors p-0.5 rounded-full"
                    title="Remover material"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#608BA6] italic pt-1">
              Nenhum material cadastrado nesta lista de atenção especial.
            </p>
          )}
        </CardContent>
      </Card>

      {/* BARRA DE AÇÕES: SALVAR / RESTAURAR */}
      <div className="flex items-center justify-between p-4 bg-ems-card border border-ems-border rounded-2xl shadow-xl flex-wrap gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRestoreDefaults}
          disabled={saving}
          className="bg-[#1B3550] border-[#2A4D6E] text-[#608BA6] hover:text-white hover:bg-[#234465] text-xs font-bold"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Restaurar Padrões
        </Button>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#AEE4FF] hover:bg-[#86d4fa] text-[#13283E] font-bold text-xs px-6 py-2 rounded-xl shadow-md border-0 cursor-pointer transition-all active:scale-[0.98]"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin text-[#13283E]" />
                Salvando Configurações...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Todas as Configurações
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
