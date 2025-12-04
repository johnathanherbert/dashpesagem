export interface AgingData {
  id?: string;
  material: string; // Código do material
  texto_breve_material: string; // Nome/descrição do material
  unidade_medida: string; // UMB (KG, UN, etc)
  lote: string;
  centro: string; // Centro (ex: 600)
  deposito: string; // Depósito (ex: PES)
  tipo_deposito: string; // Tipo de depósito (ex: 999)
  posicao_deposito: string; // Posição no depósito
  estoque_disponivel: number; // Peso/quantidade disponível
  data_vencimento?: string; // Data do vencimento
  ultimo_movimento: string; // Data do último movimento
  tipo_estoque?: string; // Tipo de estoque (S, etc)
  ultima_entrada_deposito?: string; // Data da última entrada
  dias_aging?: number; // Calculado: dias desde último movimento
  created_at?: string;
  updated_at?: string;
}

export interface AgingStats {
  total_peso: number;
  total_itens: number;
  media_aging: number;
  por_deposito: Record<string, number>;
  por_pesagem: Record<string, number>;
  por_tr_zone: Record<string, number>;
  por_devolucao: Record<string, number>;
  por_tipo_estoque: Record<string, number>;
}

export interface AgingChartData {
  name: string;
  value: number;
  peso: number;
}

export interface AgingTableFilter {
  searchTerm: string;
  tipoEstoque?: string;
  deposito?: string;
  minPeso?: number;
  maxPeso?: number;
  minDias?: number;
  maxDias?: number;
}
