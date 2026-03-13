import { createClient } from '@supabase/supabase-js';
import { AgingData, RemessaData, ConfiguracaoResiduais } from '@/types/aging';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Configuração do cache
const CACHE_KEY = 'material_valores_cache';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 horas

interface CacheData {
  valores: Record<string, number>;
  timestamp: number;
  count: number;
}

// Função para salvar cache
function saveCacheToStorage(valores: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  
  const cacheData: CacheData = {
    valores,
    timestamp: Date.now(),
    count: Object.keys(valores).length
  };
  
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    console.log('💾 Cache salvo:', cacheData.count, 'materiais');
  } catch (error) {
    console.warn('⚠️ Erro ao salvar cache:', error);
  }
}

// Função para carregar cache
function loadCacheFromStorage(): Record<string, number> | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const cacheData: CacheData = JSON.parse(cached);
    const age = Date.now() - cacheData.timestamp;
    
    if (age > CACHE_EXPIRY_MS) {
      console.log('⏰ Cache expirado (idade: ' + Math.round(age / 1000 / 60 / 60) + 'h)');
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    console.log('✅ Cache carregado:', cacheData.count, 'materiais (idade: ' + Math.round(age / 1000 / 60) + 'min)');
    return cacheData.valores;
  } catch (error) {
    console.warn('⚠️ Erro ao carregar cache:', error);
    return null;
  }
}

// Função para invalidar cache
export function invalidateMaterialValoresCache(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CACHE_KEY);
  console.log('🗑️ Cache invalidado');
}

// Função para buscar todos os dados de aging
export async function fetchAgingData(): Promise<AgingData[]> {
  const { data, error } = await supabase
    .from('aging_estoque')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    if (typeof window !== 'undefined') {
      console.error('Erro ao buscar dados:', error);
    }
    throw error;
  }

  return data || [];
}

// Função para buscar valores unitários dos materiais (com cache)
export async function fetchMaterialValores(forceRefresh: boolean = false): Promise<Record<string, number>> {
  // Tentar carregar do cache primeiro
  if (!forceRefresh) {
    const cachedValues = loadCacheFromStorage();
    if (cachedValues) {
      return cachedValues;
    }
  }

  console.log('🔄 Buscando valores do banco de dados...');
  
  // Buscar TODOS os registros (sem limite padrão de 1000)
  // Supabase tem limite de 1000 por padrão, precisamos buscar todos
  let allData: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('material_valores')
      .select('material, valor_unitario')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      if (typeof window !== 'undefined') {
        console.error('Erro ao buscar valores:', error);
      }
      return {}; // Retorna objeto vazio se houver erro
    }

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      page++;
      hasMore = data.length === pageSize; // Se retornou menos que pageSize, acabou
    } else {
      hasMore = false;
    }
  }

  // Converte array para objeto { material: valor_unitario }
  const valoresMap: Record<string, number> = {};
  allData.forEach(item => {
    valoresMap[item.material] = item.valor_unitario;
  });

  if (typeof window !== 'undefined') {
    console.log('💰 Valores carregados do Supabase:');
    console.log(`  Total: ${Object.keys(valoresMap).length} materiais (${page} páginas)`);
    if (Object.keys(valoresMap).length > 0) {
      const exemplos = Object.entries(valoresMap).slice(0, 5);
      exemplos.forEach(([mat, val]) => {
        console.log(`    ${mat} = R$ ${val.toFixed(2)}`);
      });
    }
  }

  // Salvar no cache
  saveCacheToStorage(valoresMap);

  return valoresMap;
}

// Função para atualizar/substituir todos os dados da tabela
export async function replaceAllAgingData(newData: AgingData[]): Promise<void> {
  if (!newData || newData.length === 0) {
    throw new Error('Nenhum dado para inserir no banco');
  }

  // Verificar se Supabase está configurado
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase não configurado. Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local');
  }

  try {
    // Deletar todos os dados existentes
    const { error: deleteError } = await supabase
      .from('aging_estoque')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      if (typeof window !== 'undefined') {
        console.error('Erro ao deletar dados:', deleteError);
      }
      throw new Error(`Falha ao limpar dados antigos: ${deleteError.message || 'Erro desconhecido'}`);
    }

    // Inserir novos dados
    const { error: insertError } = await supabase
      .from('aging_estoque')
      .insert(newData);

    if (insertError) {
      if (typeof window !== 'undefined') {
        console.error('Erro ao inserir dados:', insertError);
      }
      throw new Error(`Falha ao inserir dados: ${insertError.message || 'Verifique se a tabela existe no Supabase'}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Erro desconhecido ao atualizar banco de dados');
  }
}

// Função para inserir dados em lote
export async function insertAgingData(data: AgingData[]): Promise<void> {
  const { error } = await supabase
    .from('aging_estoque')
    .insert(data);

  if (error) {
    if (typeof window !== 'undefined') {
      console.error('Erro ao inserir dados:', error);
    }
    throw error;
  }
}

// Função para deletar um item específico
export async function deleteAgingItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('aging_estoque')
    .delete()
    .eq('id', id);

  if (error) {
    if (typeof window !== 'undefined') {
      console.error('Erro ao deletar item:', error);
    }
    throw error;
  }
}

// ===== FUNÇÕES DE REMESSAS =====

// Função para buscar todas as remessas
export async function fetchRemessas(): Promise<RemessaData[]> {
  const { data, error } = await supabase
    .from('remessas')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    if (typeof window !== 'undefined') {
      console.error('Erro ao buscar remessas:', error);
    }
    throw error;
  }

  return data || [];
}

// Função para substituir todas as remessas
export async function replaceAllRemessas(newData: RemessaData[]): Promise<void> {
  if (!newData || newData.length === 0) {
    throw new Error('Nenhuma remessa para inserir no banco');
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase não configurado');
  }

  try {
    // Deletar todos os dados existentes
    const { error: deleteError } = await supabase
      .from('remessas')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      if (typeof window !== 'undefined') {
        console.error('Erro ao deletar remessas:', deleteError);
      }
      throw new Error(`Falha ao limpar remessas antigas: ${deleteError.message}`);
    }

    // Inserir novos dados em lotes (1000 por vez)
    const batchSize = 1000;
    for (let i = 0; i < newData.length; i += batchSize) {
      const batch = newData.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('remessas')
        .insert(batch);

      if (insertError) {
        if (typeof window !== 'undefined') {
          console.error('Erro ao inserir remessas:', insertError);
        }
        throw new Error(`Falha ao inserir remessas (lote ${Math.floor(i / batchSize) + 1}): ${insertError.message}`);
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Erro desconhecido ao atualizar remessas');
  }
}

// ===== FUNÇÕES DE CONFIGURAÇÃO DE RESIDUAIS =====

// Buscar configuração de residuais
export async function fetchConfiguracaoResiduais(): Promise<ConfiguracaoResiduais> {
  const { data, error } = await supabase
    .from('configuracao_residuais')
    .select('*')
    .single();

  if (error) {
    // Retornar configuração padrão se não existir
    return {
      limite_verde: 100,
      limite_amarelo: 900,
      limite_maximo: 999,
      materiais_alto_valor: [],
    };
  }

  return data || {
    limite_verde: 100,
    limite_amarelo: 900,
    limite_maximo: 999,
    materiais_alto_valor: [],
  };
}

// ===== HISTÓRICO DO DASHBOARD =====

export interface DashboardSnapshot {
  total_itens: number;
  media_aging: number;
  max_aging: number;
  itens_criticos: number;
  itens_alerta: number;
  total_valorizado: number;
  valor_critico: number;
  valor_alerta: number;
  itens_com_valor: number;
  valor_ajuste: number;
  itens_ajuste: number;
  valor_aju_saida: number;
  itens_aju_saida: number;
  itens_vencidos: number;
  itens_vencendo_30d: number;
  materiais_inf: number;
  materiais_cfa: number;
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

  const { error } = await supabase.from('dashboard_historico').insert(snapshot);
  if (error && typeof window !== 'undefined') {
    console.warn('Aviso: não foi possível salvar snapshot de histórico:', error.message);
  }
}

// Buscar histórico do dashboard
export async function fetchDashboardHistorico(limit = 90): Promise<(DashboardSnapshot & { id: string; snapshot_at: string })[]> {
  const { data, error } = await supabase
    .from('dashboard_historico')
    .select('*')
    .order('snapshot_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (typeof window !== 'undefined') console.error('Erro ao buscar histórico:', error);
    return [];
  }
  return data || [];
}

// Salvar configuração de residuais
export async function saveConfiguracaoResiduais(config: ConfiguracaoResiduais): Promise<void> {
  const { error } = await supabase
    .from('configuracao_residuais')
    .upsert({
      id: 1, // Usa sempre o mesmo registro
      limite_verde: config.limite_verde,
      limite_amarelo: config.limite_amarelo,
      limite_maximo: config.limite_maximo,
      materiais_alto_valor: config.materiais_alto_valor,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    if (typeof window !== 'undefined') {
      console.error('Erro ao salvar configuração:', error);
    }
    throw error;
  }
}

