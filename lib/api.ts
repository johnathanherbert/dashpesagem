/**
 * lib/api.ts
 * Substitui lib/supabase.ts — mesmo contrato de funções exportadas,
 * agora usando API Routes do Next.js (server-side com pg).
 */

import { AgingData, RemessaData, ConfiguracaoResiduais, DashboardSnapshot } from '@/types/aging';

// Re-export DashboardSnapshot so existing imports from '@/lib/api' still work
export type { DashboardSnapshot };


// =====================================================
// CACHE de material_valores (mantido em localStorage)
// =====================================================
const CACHE_KEY = 'material_valores_cache';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 horas

interface CacheData {
  valores: Record<string, number>;
  timestamp: number;
  count: number;
}

function saveCacheToStorage(valores: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  const cacheData: CacheData = {
    valores,
    timestamp: Date.now(),
    count: Object.keys(valores).length,
  };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    console.log('💾 Cache salvo:', cacheData.count, 'materiais');
  } catch (error) {
    console.warn('⚠️ Erro ao salvar cache:', error);
  }
}

function loadCacheFromStorage(): Record<string, number> | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const cacheData: CacheData = JSON.parse(cached);
    const age = Date.now() - cacheData.timestamp;
    if (age > CACHE_EXPIRY_MS) {
      console.log('⏰ Cache expirado (' + Math.round(age / 1000 / 60 / 60) + 'h)');
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    console.log('✅ Cache carregado:', cacheData.count, 'materiais (' + Math.round(age / 1000 / 60) + 'min)');
    return cacheData.valores;
  } catch (error) {
    console.warn('⚠️ Erro ao carregar cache:', error);
    return null;
  }
}

export function invalidateMaterialValoresCache(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CACHE_KEY);
  console.log('🗑️ Cache invalidado');
}

// =====================================================

// =====================================================
// AGING ESTOQUE
// =====================================================

export async function fetchAgingData(): Promise<AgingData[]> {
  const res = await fetch('/api/aging');
  if (!res.ok) throw new Error('Erro ao buscar dados de aging');
  return res.json();
}

export async function replaceAllAgingData(newData: AgingData[]): Promise<void> {
  if (!newData || newData.length === 0) {
    throw new Error('Nenhum dado para inserir no banco');
  }
  const res = await fetch('/api/aging', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newData),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Falha ao salvar dados de aging');
  }
}

export async function insertAgingData(data: AgingData[]): Promise<void> {
  await replaceAllAgingData(data);
}

export async function deleteAgingItem(_id: string): Promise<void> {
  // Não implementado — o app atual não usa deleção individual
  console.warn('deleteAgingItem: não suportado na versão PostgreSQL');
}

// =====================================================
// MATERIAL VALORES
// =====================================================

export async function fetchMaterialValores(
  forceRefresh = false
): Promise<Record<string, number>> {
  if (!forceRefresh) {
    const cached = loadCacheFromStorage();
    if (cached) return cached;
  }

  console.log('🔄 Buscando valores do banco de dados...');
  const res = await fetch('/api/material-valores');
  if (!res.ok) {
    console.error('Erro ao buscar valores');
    return {};
  }
  const rows: { material: string; valor_unitario: number }[] = await res.json();
  const valoresMap: Record<string, number> = {};
  rows.forEach(row => {
    valoresMap[row.material] = Number(row.valor_unitario);
  });

  if (typeof window !== 'undefined') {
    console.log('💰 Valores carregados:', Object.keys(valoresMap).length, 'materiais');
  }

  saveCacheToStorage(valoresMap);
  return valoresMap;
}

export async function replaceAllMaterialValores(
  data: { material: string; valor_unitario: number }[]
): Promise<void> {
  const res = await fetch('/api/material-valores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Falha ao salvar valores');
  }
  invalidateMaterialValoresCache();
}

// =====================================================
// CACHE de remessas (mantido em localStorage)
// =====================================================
const REMESSAS_CACHE_KEY = 'remessas_cache';
const REMESSAS_CACHE_EXPIRY_MS = 60 * 60 * 1000; // 1 hora

interface RemessasCacheData {
  data: RemessaData[];
  timestamp: number;
  count: number;
}

function saveRemessasCache(data: RemessaData[]): void {
  if (typeof window === 'undefined') return;
  try {
    const cacheData: RemessasCacheData = {
      data,
      timestamp: Date.now(),
      count: data.length,
    };
    localStorage.setItem(REMESSAS_CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('⚠️ Erro ao salvar cache de remessas:', error);
  }
}

function loadRemessasCache(): RemessaData[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(REMESSAS_CACHE_KEY);
    if (!cached) return null;
    const cacheData: RemessasCacheData = JSON.parse(cached);
    const age = Date.now() - cacheData.timestamp;
    if (age > REMESSAS_CACHE_EXPIRY_MS) {
      localStorage.removeItem(REMESSAS_CACHE_KEY);
      return null;
    }
    return cacheData.data;
  } catch (error) {
    console.warn('⚠️ Erro ao carregar cache de remessas:', error);
    return null;
  }
}

export function invalidateRemessasCache(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(REMESSAS_CACHE_KEY);
  } catch (error) {
    console.warn('⚠️ Erro ao invalidar cache de remessas:', error);
  }
}

// =====================================================
// REMESSAS
// =====================================================

export async function fetchRemessas(forceRefresh = false): Promise<RemessaData[]> {
  if (!forceRefresh) {
    const cached = loadRemessasCache();
    if (cached && cached.length > 0) {
      return cached;
    }
  }

  const res = await fetch('/api/remessas');
  if (!res.ok) throw new Error('Erro ao buscar remessas');
  const data: RemessaData[] = await res.json();
  saveRemessasCache(data);
  return data;
}

export async function replaceAllRemessas(newData: RemessaData[]): Promise<void> {
  if (!newData || newData.length === 0) {
    throw new Error('Nenhuma remessa para inserir');
  }
  const res = await fetch('/api/remessas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newData),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Falha ao salvar remessas');
  }
  invalidateRemessasCache();
}

// =====================================================
// CONFIGURAÇÃO DE RESIDUAIS
// =====================================================

const DEFAULT_CONFIG: ConfiguracaoResiduais = {
  limite_verde: 100,
  limite_amarelo: 900,
  limite_maximo: 999,
  materiais_alto_valor: [],
};

export async function fetchConfiguracaoResiduais(): Promise<ConfiguracaoResiduais> {
  const res = await fetch('/api/config-residuais');
  if (!res.ok) return DEFAULT_CONFIG;
  const data = await res.json();
  return data || DEFAULT_CONFIG;
}

export async function saveConfiguracaoResiduais(
  config: ConfiguracaoResiduais
): Promise<void> {
  const res = await fetch('/api/config-residuais', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Falha ao salvar configuração');
  }
}

// =====================================================
// DASHBOARD HISTÓRICO
// =====================================================

export async function fetchDashboardHistorico(
  limit = 90
): Promise<(DashboardSnapshot & { id: string; snapshot_at: string })[]> {
  const res = await fetch(`/api/dashboard-historico?limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function saveSnapshotHistorico(
  data: AgingData[],
  valores: Record<string, number>
): Promise<void> {
  if (data.length === 0) return;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const em30Dias = new Date(hoje);
  em30Dias.setDate(hoje.getDate() + 30);

  const parseDate = (s: string): Date | null => {
    if (!s) return null;
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const d = new Date(+m[3], +m[2] - 1, +m[1]);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  let totalValorizado = 0, valorCritico = 0, valorAlerta = 0, itensComValor = 0;
  let valorAjuste = 0, itensAjuste = 0, valorAjuSaida = 0, itensAjuSaida = 0;
  let itensCriticos = 0, itensAlerta = 0, itensVencidos = 0, itensVencendo30d = 0;
  let materiaisInf = 0, materiaisCfa = 0;
  const { isMaterialEspecial } = await import('@/lib/materiais-especiais');

  const totalDias = data.reduce((s, i) => s + (i.dias_aging || 0), 0);
  const mediaAging = totalDias / data.length;
  const maxAging = Math.max(...data.map(i => i.dias_aging || 0));

  data.forEach(item => {
    const dias = item.dias_aging || 0;
    if (dias > 20) itensCriticos++;
    else if (dias >= 10) itensAlerta++;

    const esp = isMaterialEspecial(item.material);
    if (esp === 'inf') materiaisInf++;
    else if (esp === 'cfa') materiaisCfa++;

    const dv = item.data_vencimento ? parseDate(item.data_vencimento) : null;
    if (dv) {
      if (dv < hoje) itensVencidos++;
      else if (dv <= em30Dias) itensVencendo30d++;
    }

    const valor = valores[item.material];
    if (valor) {
      const vt = (item.estoque_disponivel || 0) * valor;
      totalValorizado += vt;
      itensComValor++;
      if (dias > 20) valorCritico += vt;
      else if (dias >= 10) valorAlerta += vt;

      const tipo = item.tipo_deposito?.toUpperCase() ?? '';
      const pos = item.posicao_deposito?.toUpperCase() ?? '';
      if (tipo === '999' && pos === 'AJUSTE') { valorAjuste += vt; itensAjuste++; }
      else if (tipo === '999' && pos === 'AJU-SAIDA') { valorAjuSaida += vt; itensAjuSaida++; }
    }
  });

  const snapshot: DashboardSnapshot = {
    total_itens: data.length,
    media_aging: Math.round(mediaAging * 100) / 100,
    max_aging: maxAging,
    itens_criticos: itensCriticos,
    itens_alerta: itensAlerta,
    total_valorizado: Math.round(totalValorizado * 100) / 100,
    valor_critico: Math.round(valorCritico * 100) / 100,
    valor_alerta: Math.round(valorAlerta * 100) / 100,
    itens_com_valor: itensComValor,
    valor_ajuste: Math.round(valorAjuste * 100) / 100,
    itens_ajuste: itensAjuste,
    valor_aju_saida: Math.round(valorAjuSaida * 100) / 100,
    itens_aju_saida: itensAjuSaida,
    itens_vencidos: itensVencidos,
    itens_vencendo_30d: itensVencendo30d,
    materiais_inf: materiaisInf,
    materiais_cfa: materiaisCfa,
  };

  try {
    await fetch('/api/dashboard-historico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
  } catch {
    console.warn('Aviso: não foi possível salvar snapshot de histórico');
  }
}

// =====================================================
// LOTES EM INVESTIGAÇÃO
// =====================================================

export interface LoteInvestigacao {
  lote: string;
  material?: string;
  motivo?: string;
  created_by?: string;
  created_at?: string;
}

export async function fetchLotesInvestigacao(): Promise<LoteInvestigacao[]> {
  try {
    const res = await fetch('/api/lotes-investigacao');
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    console.error('Erro ao buscar lotes em investigação:', error);
    return [];
  }
}

export async function addLoteInvestigacao(item: {
  lote: string;
  material?: string;
  motivo?: string;
  created_by?: string;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/lotes-investigacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return res.ok;
  } catch (error) {
    console.error('Erro ao adicionar lote em investigação:', error);
    return false;
  }
}

export async function removeLoteInvestigacao(lote: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/lotes-investigacao?lote=${encodeURIComponent(lote)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (error) {
    console.error('Erro ao remover lote de investigação:', error);
    return false;
  }
}
