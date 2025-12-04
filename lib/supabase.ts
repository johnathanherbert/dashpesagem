import { createClient } from '@supabase/supabase-js';
import { AgingData } from '@/types/aging';

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
