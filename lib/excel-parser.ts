import * as XLSX from 'xlsx';
import { AgingData } from '@/types/aging';
import { differenceInDays, parseISO, isValid } from 'date-fns';

export function parseExcelFile(file: File): Promise<AgingData[]> {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Arquivo não fornecido'));
      return;
    }

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      reject(new Error('Formato de arquivo inválido. Use .xlsx ou .xls'));
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        
        if (!data) {
          reject(new Error('Não foi possível ler o arquivo'));
          return;
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          reject(new Error('Planilha vazia ou sem abas'));
          return;
        }

        // Pega a primeira planilha
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        if (!worksheet) {
          reject(new Error('Não foi possível acessar a planilha'));
          return;
        }

        // Converte para JSON começando da linha 4 (pula as 3 primeiras linhas de cabeçalho)
        // Linha 1: "Estoques WM com texto breve de material"
        // Linha 2: "Nº depósito | WNM"
        // Linha 3: (vazia)
        // Linha 4: Cabeçalhos reais (Material, Texto breve material, etc)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: 3 });
        
        if (!jsonData || jsonData.length === 0) {
          reject(new Error('Planilha sem dados. Verifique se há dados a partir da linha 2'));
          return;
        }
        
        // Remove as últimas 4 linhas (linhas 688-691 que são rodapé vazio)
        const validData = jsonData.slice(0, -4);
        
        // Processa e mapeia os dados da estrutura real da planilha
        const agingData: AgingData[] = validData.map((row: any) => {
          // Mapeia as colunas da planilha real (nomes em português)
          const material = String(row['Material'] || '');
          const textoBreve = String(row['Texto breve material'] || '');
          const unidadeMedida = String(row['UMB'] || 'KG');
          const lote = String(row['Lote'] || '');
          const centro = String(row['Centro'] || '');
          const deposito = String(row['Depósito'] || '');
          const tipoDeposito = String(row['Tipo de depósito'] || '');
          const posicaoDeposito = String(row['Posição no depósito'] || '');
          
          // Estoque disponível (peso)
          const estoqueDisponivel = parseFloat(row['Estoque disponível'] || 0);

          // Datas (vêm como números seriais do Excel)
          const dataVencimento = row['Data do vencimento'] || '';
          const ultimoMovimento = row['Último movimento'] || '';
          const ultimaEntrada = row['Última entrada dep.'] || '';
          const tipoEstoque = String(row['Tipo de estoque'] || '');

          // Calcula dias de aging baseado no último movimento
          let diasAging = 0;
          if (ultimoMovimento) {
            try {
              const dataMovimento = parseExcelDate(ultimoMovimento);
              if (dataMovimento && isValid(dataMovimento)) {
                diasAging = differenceInDays(new Date(), dataMovimento);
              }
            } catch (error) {
              if (typeof window !== 'undefined') {
                console.warn('Erro ao calcular aging:', error);
              }
            }
          }

          return {
            material,
            texto_breve_material: textoBreve,
            unidade_medida: unidadeMedida,
            lote,
            centro,
            deposito,
            tipo_deposito: tipoDeposito,
            posicao_deposito: posicaoDeposito,
            estoque_disponivel: estoqueDisponivel,
            data_vencimento: formatExcelDate(dataVencimento),
            ultimo_movimento: formatExcelDate(ultimoMovimento),
            tipo_estoque: tipoEstoque,
            ultima_entrada_deposito: formatExcelDate(ultimaEntrada),
            dias_aging: diasAging,
          };
        });

        // Validar que temos dados válidos
        if (agingData.length === 0) {
          reject(new Error('Nenhum dado válido encontrado após processamento'));
          return;
        }

        // Validar estrutura mínima do primeiro item
        const primeiroItem = agingData[0];
        if (!primeiroItem.material && !primeiroItem.lote) {
          reject(new Error('Estrutura da planilha não corresponde ao esperado. Verifique se as colunas estão corretas'));
          return;
        }

        resolve(agingData);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro ao processar planilha';
        reject(new Error(errorMessage));
      }
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler o arquivo. Tente novamente'));
    };
    
    try {
      reader.readAsBinaryString(file);
    } catch (error) {
      reject(new Error('Não foi possível abrir o arquivo. Verifique se não está corrompido'));
    }
  });
}

// Função auxiliar para converter datas do Excel
function parseExcelDate(excelDate: any): Date | null {
  if (!excelDate) return null;

  // Se já for uma data válida
  if (excelDate instanceof Date) {
    return excelDate;
  }

  // Se for uma string de data
  if (typeof excelDate === 'string') {
    // Tenta vários formatos comuns
    const formats = [
      excelDate, // ISO format
      excelDate.split('/').reverse().join('-'), // DD/MM/YYYY -> YYYY-MM-DD
      excelDate.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'), // DD/MM/YYYY -> YYYY-MM-DD
    ];

    for (const format of formats) {
      try {
        const date = parseISO(format);
        if (isValid(date)) {
          return date;
        }
      } catch {
        continue;
      }
    }
  }

  // Se for um número serial do Excel (dias desde 1900-01-01)
  if (typeof excelDate === 'number') {
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (excelDate - 2) * 86400000);
    return date;
  }

  return null;
}

// Função para formatar data do Excel para string legível
function formatExcelDate(excelDate: any): string {
  if (!excelDate) return '';
  
  const date = parseExcelDate(excelDate);
  if (date && isValid(date)) {
    // Formata como DD/MM/YYYY
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  return String(excelDate);
}

// Função para calcular estatísticas
export function calculateAgingStats(data: AgingData[]) {
  const stats = {
    total_peso: 0,
    total_itens: data.length,
    media_aging: 0,
    por_deposito: {} as Record<string, number>,
    por_pesagem: {} as Record<string, number>,
    por_tr_zone: {} as Record<string, number>,
    por_devolucao: {} as Record<string, number>,
    por_tipo_estoque: {} as Record<string, number>,
  };

  let totalDiasAging = 0;

  data.forEach(item => {
    stats.total_peso += item.estoque_disponivel || 0;
    totalDiasAging += item.dias_aging || 0;

    // Agrupa por depósito
    if (item.deposito) {
      stats.por_deposito[item.deposito] = 
        (stats.por_deposito[item.deposito] || 0) + (item.estoque_disponivel || 0);
    }

    // Agrupa por tipo de depósito (ao invés de pesagem)
    if (item.tipo_deposito) {
      stats.por_pesagem[item.tipo_deposito] = 
        (stats.por_pesagem[item.tipo_deposito] || 0) + (item.estoque_disponivel || 0);
    }

    // Agrupa por centro (ao invés de TR-Zone)
    if (item.centro) {
      stats.por_tr_zone[item.centro] = 
        (stats.por_tr_zone[item.centro] || 0) + (item.estoque_disponivel || 0);
    }

    // Agrupa por unidade de medida (ao invés de devolução)
    if (item.unidade_medida) {
      stats.por_devolucao[item.unidade_medida] = 
        (stats.por_devolucao[item.unidade_medida] || 0) + (item.estoque_disponivel || 0);
    }

    // Agrupa por tipo de estoque
    if (item.tipo_estoque) {
      stats.por_tipo_estoque[item.tipo_estoque] = 
        (stats.por_tipo_estoque[item.tipo_estoque] || 0) + (item.estoque_disponivel || 0);
    }
  });

  stats.media_aging = data.length > 0 ? totalDiasAging / data.length : 0;

  return stats;
}
