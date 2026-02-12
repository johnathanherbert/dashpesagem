'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, Plus, X, Save, Loader2, AlertTriangle } from 'lucide-react';
import { ConfiguracaoResiduais } from '@/types/aging';
import { fetchConfiguracaoResiduais, saveConfiguracaoResiduais } from '@/lib/supabase';

interface ConfiguracaoResiduaisProps {
  onConfigChange?: () => void;
}

export function ConfiguracaoResiduaisComponent({ onConfigChange }: ConfiguracaoResiduaisProps) {
  const [config, setConfig] = useState<ConfiguracaoResiduais>({
    limite_verde: 100,
    limite_amarelo: 900,
    limite_maximo: 999,
    materiais_alto_valor: [],
  });

  const [novoMaterial, setNovoMaterial] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await fetchConfiguracaoResiduais();
      setConfig(data);
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');

    try {
      await saveConfiguracaoResiduais(config);
      setMessage('Configuração salva com sucesso!');
      if (onConfigChange) {
        onConfigChange();
      }
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      setMessage('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMaterial = () => {
    const materialTrimmed = novoMaterial.trim();
    if (!materialTrimmed) return;

    if (config.materiais_alto_valor.includes(materialTrimmed)) {
      setMessage('Material já está na lista');
      setTimeout(() => setMessage(''), 3000);
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
      materiais_alto_valor: config.materiais_alto_valor.filter(m => m !== material),
    });
  };

  const handleLimiteChange = (tipo: 'verde' | 'amarelo' | 'maximo', valor: string) => {
    const numValue = parseInt(valor) || 0;
    if (tipo === 'verde') {
      setConfig({ ...config, limite_verde: numValue });
    } else if (tipo === 'amarelo') {
      setConfig({ ...config, limite_amarelo: numValue });
    } else {
      setConfig({ ...config, limite_maximo: numValue });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>Configuração de Saldos Residuais</CardTitle>
          </div>
          <CardDescription>
            Configure os limites para classificação de residuais e materiais de extrema atenção
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Limites de Classificação */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Limites de Classificação (em gramas)</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="limite-verde" className="flex items-center gap-2">
                  <Badge className="bg-green-500">Verde</Badge>
                  Até (g)
                </Label>
                <Input
                  id="limite-verde"
                  type="number"
                  value={config.limite_verde}
                  onChange={(e) => handleLimiteChange('verde', e.target.value)}
                  min="0"
                  step="10"
                />
                <p className="text-xs text-muted-foreground">
                  Até {config.limite_verde}g
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="limite-amarelo" className="flex items-center gap-2">
                  <Badge className="bg-yellow-500">Amarelo</Badge>
                  Até (g)
                </Label>
                <Input
                  id="limite-amarelo"
                  type="number"
                  value={config.limite_amarelo}
                  onChange={(e) => handleLimiteChange('amarelo', e.target.value)}
                  min={config.limite_verde}
                  step="50"
                />
                <p className="text-xs text-muted-foreground">
                  {config.limite_verde}g até {config.limite_amarelo}g
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="limite-maximo" className="flex items-center gap-2">
                  <Badge className="bg-red-500">Vermelho</Badge>
                  Até (g)
                </Label>
                <Input
                  id="limite-maximo"
                  type="number"
                  value={config.limite_maximo}
                  onChange={(e) => handleLimiteChange('maximo', e.target.value)}
                  min={config.limite_amarelo}
                  step="50"
                />
                <p className="text-xs text-muted-foreground">
                  {config.limite_amarelo}g até {config.limite_maximo}g
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Badge variant="outline">Estoque Normal</Badge>
                </Label>
                <Input
                  value={`> ${config.limite_maximo}g`}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Não é residual
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-50 text-blue-700 rounded-md text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Importante:</strong> Apenas saldos no depósito PES até {config.limite_maximo}g são analisados como residuais.
                Acima deste valor é considerado estoque normal. Conversões: 1 KG = 1.000g, 1 TON = 1.000.000g
              </div>
            </div>
          </div>

          {/* Materiais de Alto Valor */}
          <div className="space-y-4 border-t pt-6">
            <h4 className="text-sm font-semibold">Materiais de Extrema Atenção</h4>
            <p className="text-sm text-muted-foreground">
              Materiais de altíssimo valor que NÃO devem ser considerados na análise de residuais
            </p>

            <div className="flex gap-2">
              <Input
                placeholder="Código do material (ex: 011370)"
                value={novoMaterial}
                onChange={(e) => setNovoMaterial(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddMaterial();
                  }
                }}
              />
              <Button onClick={handleAddMaterial} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>

            {config.materiais_alto_valor.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {config.materiais_alto_valor.map((material) => (
                  <Badge
                    key={material}
                    variant="secondary"
                    className="px-3 py-1.5 text-sm"
                  >
                    {material}
                    <button
                      onClick={() => handleRemoveMaterial(material)}
                      className="ml-2 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Nenhum material configurado
              </p>
            )}
          </div>

          {/* Botão Salvar */}
          <div className="flex items-center gap-3 border-t pt-6">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Configuração
                </>
              )}
            </Button>

            {message && (
              <span
                className={`text-sm ${
                  message.includes('sucesso') ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {message}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
