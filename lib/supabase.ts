import { createClient } from '@supabase/supabase-js';
import { AgingData, RemessaData, ConfiguracaoResiduais } from '@/types/aging';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

// Função para buscar valores unitários dos materiais
export async function fetchMaterialValores(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('material_valores')
    .select('material, valor_unitario');

  if (error) {
    if (typeof window !== 'undefined') {
      console.error('Erro ao buscar valores:', error);
    }
    return {}; // Retorna objeto vazio se houver erro
  }

  // Converte array para objeto { material: valor_unitario }
  const valoresMap: Record<string, number> = {};
  data?.forEach(item => {
    valoresMap[item.material] = item.valor_unitario;
  });

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

