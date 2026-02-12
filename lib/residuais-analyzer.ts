import { AgingData, SaldoResidual, NivelResidual, ConfiguracaoResiduais, AgingTableRow, RemessaData } from '@/types/aging';

/**
 * Converte quantidade para gramas baseado na unidade de medida
 */
function converterParaGramas(quantidade: number, unidadeMedida: string): number {
  const unidade = unidadeMedida.toUpperCase().trim();

  switch (unidade) {
    case 'KG':
      return quantidade * 1000; // 1 KG = 1000g
    case 'G':
      return quantidade;
    case 'MG':
      return quantidade / 1000; // 1000 MG = 1g
    case 'TON':
    case 'T':
      return quantidade * 1000000; // 1 TON = 1.000.000g
    case 'UN':
    case 'PC':
    case 'L':
    case 'ML':
      // Para unidades não converteríveis, retorna a quantidade original
      // Permitindo análise, mas sem conversão precisa
      return quantidade;
    default:
      return quantidade;
  }
}

/**
 * Determina o nível de residual baseado na quantidade em gramas
 * Retorna null se estiver acima do limite máximo (não é residual)
 */
function determinarNivelResidual(
  quantidadeGramas: number,
  config: ConfiguracaoResiduais
): NivelResidual | null {
  // Acima do limite máximo não é considerado residual
  if (quantidadeGramas > config.limite_maximo) {
    return null;
  }

  if (quantidadeGramas <= config.limite_verde) {
    return 'verde';
  } else if (quantidadeGramas <= config.limite_amarelo) {
    return 'amarelo';
  } else {
    return 'vermelho';
  }
}

/**
 * Verifica se um material é de alto valor (extrema atenção)
 */
function ehMaterialAltoValor(material: string, config: ConfiguracaoResiduais): boolean {
  return config.materiais_alto_valor.includes(material);
}

/**
 * Verifica se um lote é único no depósito PES
 */
function verificarLoteUnico(
  material: string,
  lote: string,
  deposito: string,
  todosOsDados: AgingData[]
): boolean {
  if (deposito !== 'PES') {
    return false;
  }

  // Conta quantos lotes diferentes existem para este material no depósito PES
  const lotesNoPES = new Set(
    todosOsDados
      .filter(item => item.material === material && item.deposito === 'PES')
      .map(item => item.lote)
  );

  return lotesNoPES.size === 1;
}

/**
 * Analisa os dados de aging e identifica saldos residuais
 */
export function analisarSaldosResiduais(
  agingData: AgingData[],
  config: ConfiguracaoResiduais
): SaldoResidual[] {
  const residuais: SaldoResidual[] = [];

  // Filtrar apenas itens do depósito PES
  const itensPES = agingData.filter(item => item.deposito === 'PES');

  for (const item of itensPES) {
    const quantidadeGramas = converterParaGramas(
      item.estoque_disponivel,
      item.unidade_medida
    );

    const nivel = determinarNivelResidual(quantidadeGramas, config);
    const materialAltoValor = ehMaterialAltoValor(item.material, config);

    // Se é material de alto valor, não inclui na análise de residuais
    if (materialAltoValor) {
      continue;
    }

    // Se está acima do limite máximo (null), não é residual
    if (nivel === null) {
      continue;
    }

    const loteUnico = verificarLoteUnico(
      item.material,
      item.lote,
      item.deposito,
      agingData
    );

    // Criar objeto de saldo residual
    const residual: SaldoResidual = {
      material: item.material,
      descricao_material: item.texto_breve_material,
      lote: item.lote,
      deposito: item.deposito,
      quantidade: item.estoque_disponivel,
      unidade_medida: item.unidade_medida,
      nivel,
      dias_aging: item.dias_aging || 0,
      eh_lote_unico: loteUnico,
      material_alto_valor: false,
      ultimo_movimento: item.ultimo_movimento,
    };

    residuais.push(residual);
  }

  return residuais;
}

/**
 * Filtra residuais por nível
 */
export function filtrarResiduaisPorNivel(
  residuais: SaldoResidual[],
  nivel?: NivelResidual
): SaldoResidual[] {
  if (!nivel) return residuais;
  return residuais.filter(r => r.nivel === nivel);
}

/**
 * Agrupa residuais por material
 */
export function agruparResiduaisPorMaterial(
  residuais: SaldoResidual[]
): Record<string, SaldoResidual[]> {
  const agrupados: Record<string, SaldoResidual[]> = {};

  for (const residual of residuais) {
    if (!agrupados[residual.material]) {
      agrupados[residual.material] = [];
    }
    agrupados[residual.material].push(residual);
  }

  return agrupados;
}

/**
 * Calcula estatísticas de residuais
 */
export interface EstatisticasResiduais {
  total: number;
  verdes: number;
  amarelos: number;
  vermelhos: number;
  lotesUnicos: number;
  quantidadeTotalGramas: number;
}

export function calcularEstatisticasResiduais(
  residuais: SaldoResidual[]
): EstatisticasResiduais {
  const stats: EstatisticasResiduais = {
    total: residuais.length,
    verdes: 0,
    amarelos: 0,
    vermelhos: 0,
    lotesUnicos: 0,
    quantidadeTotalGramas: 0,
  };

  for (const residual of residuais) {
    // Contar por nível
    if (residual.nivel === 'verde') stats.verdes++;
    if (residual.nivel === 'amarelo') stats.amarelos++;
    if (residual.nivel === 'vermelho') stats.vermelhos++;

    // Contar lotes únicos
    if (residual.eh_lote_unico) stats.lotesUnicos++;

    // Somar quantidade total em gramas
    stats.quantidadeTotalGramas += converterParaGramas(
      residual.quantidade,
      residual.unidade_medida
    );
  }

  return stats;
}

/**
 * Ordena residuais por prioridade (vermelho > amarelo > verde, depois por quantidade)
 */
export function ordenarResiduaisPorPrioridade(
  residuais: SaldoResidual[]
): SaldoResidual[] {
  const prioridadeNivel: Record<NivelResidual, number> = {
    vermelho: 3,
    amarelo: 2,
    verde: 1,
  };

  return [...residuais].sort((a, b) => {
    // Primeiro por nível (vermelho primeiro)
    const difNivel = prioridadeNivel[b.nivel] - prioridadeNivel[a.nivel];
    if (difNivel !== 0) return difNivel;

    // Depois por quantidade (maior primeiro)
    const qtdA = converterParaGramas(a.quantidade, a.unidade_medida);
    const qtdB = converterParaGramas(b.quantidade, b.unidade_medida);
    return qtdB - qtdA;
  });
}

/**
 * Enriquece dados de aging com análise de residuais, valores e contagem de remessas
 * Retorna AgingTableRow[] para uso na tabela unificada
 */
export function enriquecerAgingComAnalise(
  agingData: AgingData[],
  config: ConfiguracaoResiduais,
  valores: Record<string, number>,
  remessas: RemessaData[]
): AgingTableRow[] {
  // Pré-computar contagem de remessas por material
  const remessasPorMaterial: Record<string, number> = {};
  for (const r of remessas) {
    remessasPorMaterial[r.material] = (remessasPorMaterial[r.material] || 0) + 1;
  }

  // Pré-computar lotes por material no PES para performance
  const lotesPorMaterialPES: Record<string, Set<string>> = {};
  for (const item of agingData) {
    if (item.deposito === 'PES') {
      if (!lotesPorMaterialPES[item.material]) {
        lotesPorMaterialPES[item.material] = new Set();
      }
      lotesPorMaterialPES[item.material].add(item.lote);
    }
  }

  return agingData.map(item => {
    const valorUnit = valores[item.material] || 0;
    const quantidadeGramas = converterParaGramas(item.estoque_disponivel, item.unidade_medida);
    const nivel = item.deposito === 'PES' ? determinarNivelResidual(quantidadeGramas, config) : null;
    const materialAltoValor = ehMaterialAltoValor(item.material, config);
    const ehLoteUnico = item.deposito === 'PES'
      ? (lotesPorMaterialPES[item.material]?.size === 1)
      : false;

    return {
      material: item.material,
      texto_breve_material: item.texto_breve_material,
      unidade_medida: item.unidade_medida,
      lote: item.lote,
      centro: item.centro,
      deposito: item.deposito,
      tipo_deposito: item.tipo_deposito,
      posicao_deposito: item.posicao_deposito,
      estoque_disponivel: item.estoque_disponivel,
      data_vencimento: item.data_vencimento,
      ultimo_movimento: item.ultimo_movimento,
      tipo_estoque: item.tipo_estoque,
      ultima_entrada_deposito: item.ultima_entrada_deposito,
      dias_aging: item.dias_aging || 0,
      valor_unitario: valorUnit,
      valor_total: item.estoque_disponivel * valorUnit,
      remessas_abertas: remessasPorMaterial[item.material] || 0,
      nivel: nivel ?? undefined,
      eh_lote_unico: ehLoteUnico,
      material_alto_valor: materialAltoValor,
      is_residual: item.deposito === 'PES' && nivel !== null && !materialAltoValor,
    };
  });
}
