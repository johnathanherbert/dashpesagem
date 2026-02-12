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

export interface RemessaData {
  id?: string;
  numero_remessa: string; // Número da remessa (ex: 302604549)
  data_picking?: string; // Data de picking
  peso_total_remessa?: number; // Peso total da remessa
  item: string; // Número do item (ex: "10", "20")
  data_disponibilidade: string; // Data disponibilidade do material
  quantidade: number; // Quantidade da remessa
  unidade_medida: string; // Unidade (KG, UN, etc)
  material: string; // Código do material
  centro: string; // Centro (ex: 600)
  deposito: string; // Depósito (ALM, PES, PDD, etc)
  descricao_material: string; // Denominação do item
  created_at?: string;
  updated_at?: string;
}

export type NivelResidual = 'verde' | 'amarelo' | 'vermelho';

export interface SaldoResidual {
  material: string;
  descricao_material: string;
  lote: string;
  deposito: string;
  quantidade: number;
  unidade_medida: string;
  nivel: NivelResidual; // Classificação do residual
  dias_aging: number;
  eh_lote_unico: boolean; // Se é o único lote no depósito PES
  material_alto_valor: boolean; // Se é material de extrema atenção
  ultimo_movimento: string;
}

export interface ConfiguracaoResiduais {
  limite_verde: number; // Max em gramas (default: 100g)
  limite_amarelo: number; // Max em gramas (default: 900g)
  limite_maximo: number; // Max em gramas para considerar residual (default: 999g)
  // Verde: <= limite_verde
  // Amarelo: > limite_verde e <= limite_amarelo
  // Vermelho: > limite_amarelo e <= limite_maximo
  // Acima de limite_maximo: NÃO é residual (estoque normal)
  materiais_alto_valor: string[]; // Lista de materiais para desconsiderar
}

export interface AgingTableRow {
  // Campos base do AgingData
  material: string;
  texto_breve_material: string;
  unidade_medida: string;
  lote: string;
  centro: string;
  deposito: string;
  tipo_deposito: string;
  posicao_deposito: string;
  estoque_disponivel: number;
  data_vencimento?: string;
  ultimo_movimento: string;
  tipo_estoque?: string;
  ultima_entrada_deposito?: string;
  dias_aging: number;

  // Campos enriquecidos (calculados)
  valor_unitario: number;
  valor_total: number;
  remessas_abertas: number;

  // Campos de análise (preenchidos sempre, usados no modo análise)
  nivel?: NivelResidual;
  eh_lote_unico: boolean;
  material_alto_valor: boolean;
  is_residual: boolean;
}
