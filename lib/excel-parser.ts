import * as XLSX from 'xlsx';
import { AgingData } from '@/types/aging';
import { differenceInDays, parseISO, isValid } from 'date-fns';

// Helper para obter valor de linha com múltiplos aliases
function getRowVal(row: any, ...aliases: string[]): any {
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && row[alias] !== '') {
      return row[alias];
    }
  }
  const rowKeys = Object.keys(row);
  for (const alias of aliases) {
    const aliasLower = alias.toLowerCase().trim();
    const matchedKey = rowKeys.find((k) => k.toLowerCase().trim() === aliasLower);
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null && row[matchedKey] !== '') {
      return row[matchedKey];
    }
  }
  return '';
}

export function parseTextFile(file: File): Promise<AgingData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          reject(new Error('Não foi possível ler o conteúdo do arquivo TXT'));
          return;
        }

        const lines = text.split(/\r?\n/);
        let headerIdx = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('Material') && (lines[i].includes('Lote') || lines[i].includes('Texto breve'))) {
            headerIdx = i;
            break;
          }
        }

        if (headerIdx === -1) {
          reject(new Error('Cabeçalho com Material e Lote não encontrado no arquivo TXT'));
          return;
        }

        const rawHeaders = lines[headerIdx].split('\t').map((h) => h.trim());
        const parseDateBr = (str: string) => {
          if (!str) return { formatted: '', date: null };
          const s = str.trim();
          const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/) || s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (m) {
            const [, d, mth, y] = m;
            const dt = new Date(parseInt(y), parseInt(mth) - 1, parseInt(d));
            return { formatted: `${d.padStart(2, '0')}/${mth.padStart(2, '0')}/${y}`, date: dt };
          }
          return { formatted: s, date: null };
        };

        const parseFloatBr = (str: string) => {
          if (!str) return 0;
          const s = str.trim().replace(/\./g, '').replace(',', '.');
          const num = parseFloat(s);
          return isNaN(num) ? 0 : num;
        };

        const records: AgingData[] = [];
        const today = new Date();

        for (let i = headerIdx + 1; i < lines.length; i++) {
          const line = lines[i].trimEnd();
          if (!line || line.startsWith('*') || line.trim().startsWith('*')) continue;

          const cols = line.split('\t').map((c) => c.trim());
          const row: Record<string, string> = {};
          rawHeaders.forEach((h, idx) => {
            if (h) row[h] = cols[idx] || '';
          });

          const mat = String(getRowVal(row, 'Material', 'material', 'Código', 'Codigo') || '').trim();
          if (!mat || !/^\d+$/.test(mat)) continue;

          const lote = String(getRowVal(row, 'Lote', 'lote', 'Batch') || '').replace(/\.0$/, '').trim();
          const desc = String(getRowVal(row, 'Texto breve material', 'Texto breve', 'Descrição', 'Descricao', 'Denominação') || '').trim();
          const umb = String(getRowVal(row, 'UMB', 'Unidade', 'UM') || 'KG').trim();
          const cen = String(getRowVal(row, 'Cen.', 'Centro', 'Cen') || '600').replace(/\.0$/, '').trim();
          let dep = String(getRowVal(row, 'Dep.', 'Depósito', 'Deposito', 'Dep') || 'PES').trim();
          let tp = String(getRowVal(row, 'Tp.', 'Tipo de depósito', 'Tipo depósito', 'Tipo deposito', 'Tp') || '999').trim();
          let pos = String(getRowVal(row, 'PosDepósit', 'PosDepÃ³sit', 'PosDep', 'Pos.depósito', 'Posição no depósito', 'Posição', 'Posicao', 'Posiç', 'PosiÃ§', 'Pos.', 'Pos', 'Pos. depósito', 'Posicao no deposito') || '').trim();
          
          if (!pos) {
            const rowKeys = Object.keys(row);
            const posKey = rowKeys.find(k => k.toLowerCase().trim().startsWith('pos') || k.toLowerCase().trim().includes('posdep'));
            if (posKey && row[posKey]) {
              pos = String(row[posKey]).trim();
            }
          }

          if (!pos) {
            if (tp === 'PES') pos = 'PESAGEM';
            else if (tp === 'DEP' || dep === 'DEP') pos = 'DEVOLUCAO';
            else if (tp === 'TR-ZONE' || tp === '922') pos = 'TR-ZONE';
            else if (tp === '999') pos = 'AJUSTE';
          }

          const estqRaw = getRowVal(row, 'Estq.dispon.', 'Estoque disponível', 'Estoque disponivel', 'Estq. dispon.', 'Estoque');
          const vencRaw = getRowVal(row, 'Data venc.', 'Data do vencimento', 'Data vencimento', 'Vencimento');
          const movRaw = getRowVal(row, 'Últ.movim.', 'Ã\x9Alt.movim.', 'Ãšlt.movim.', 'Último movimento', 'Ultimo movimento', 'Ult.movim.');
          const tpEstq = String(getRowVal(row, 'T', 'Tipo de estoque', 'Tipo estoque') || '').trim();
          const entrdRaw = getRowVal(row, 'Últ.entrd.', 'Ã\x9Alt.entrd.', 'Ãšlt.entrd.', 'Última entrada dep.', 'Ultima entrada dep.', 'Ult.entrd.');

          if (dep === '922') dep = 'TR-ZONE';
          if (tp === '922') tp = 'TR-ZONE';

          const estq = parseFloatBr(String(estqRaw || '0'));
          const { formatted: vencStr } = parseDateBr(String(vencRaw || ''));
          const { formatted: movStr, date: movDate } = parseDateBr(String(movRaw || ''));
          const { formatted: entrdStr } = parseDateBr(String(entrdRaw || ''));

          let diasAging = 0;
          if (movDate) {
            const diffTime = today.getTime() - movDate.getTime();
            diasAging = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
          }

          records.push({
            material: mat.padStart(6, '0'),
            texto_breve_material: desc,
            unidade_medida: umb,
            lote,
            centro: cen,
            deposito: dep,
            tipo_deposito: tp,
            posicao_deposito: pos,
            estoque_disponivel: estq,
            data_vencimento: vencStr,
            ultimo_movimento: movStr,
            tipo_estoque: tpEstq,
            ultima_entrada_deposito: entrdStr,
            dias_aging: diasAging,
          });
        }

        resolve(records);
      } catch (err: any) {
        reject(new Error(`Erro ao processar TXT: ${err?.message || 'Arquivo inválido'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };

    reader.readAsText(file, 'latin1');
  });
}

export function parseExcelFile(file: File): Promise<AgingData[]> {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Arquivo não fornecido'));
      return;
    }

    if (file.name.match(/\.(txt|tsv|csv)$/i)) {
      parseTextFile(file).then(resolve).catch(reject);
      return;
    }

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      reject(new Error('Formato de arquivo inválido. Use .xlsx, .xls ou .txt'));
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

        // Tenta encontrar a linha de cabeçalho dinamicamente
        let rangeHeader = 3;
        for (let r = 0; r <= 6; r++) {
          const testJson = XLSX.utils.sheet_to_json(worksheet, { range: r, header: 1 }) as any[][];
          if (testJson && testJson.length > 0) {
            const firstRowStr = testJson[0].map((c) => String(c || '').toLowerCase()).join(' ');
            if (firstRowStr.includes('material') && (firstRowStr.includes('lote') || firstRowStr.includes('texto') || firstRowStr.includes('dep'))) {
              rangeHeader = r;
              break;
            }
          }
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: rangeHeader });
        
        if (!jsonData || jsonData.length === 0) {
          reject(new Error('Planilha sem dados válidos.'));
          return;
        }
        
        // Processa e mapeia os dados da estrutura real da planilha
        const agingData: AgingData[] = jsonData
          .map((row: any) => {
            const rawMat = String(getRowVal(row, 'Material', 'material', 'Código', 'Codigo', 'Mat.') || '').trim().replace(/\.0$/, '');
            if (!rawMat || !/^\d+$/.test(rawMat)) return null;

            const material = rawMat.padStart(6, '0');
            const textoBreve = String(getRowVal(row, 'Texto breve material', 'Texto breve', 'Descrição', 'Descricao', 'Denominação') || '').trim();
            const unidadeMedida = String(getRowVal(row, 'UMB', 'Unidade', 'UM', 'Unidade de medida') || 'KG').trim();
            const lote = String(getRowVal(row, 'Lote', 'lote', 'Batch') || '').trim().replace(/\.0$/, '');
            const centro = String(getRowVal(row, 'Centro', 'Cen.', 'Cen', 'centro') || '600').trim().replace(/\.0$/, '');
            let deposito = String(getRowVal(row, 'Depósito', 'Deposito', 'Dep.', 'dep', 'deposito') || 'PES').trim().replace(/\.0$/, '');
            let tipoDeposito = String(getRowVal(row, 'Tipo de depósito', 'Tipo depósito', 'Tipo deposito', 'Tp.', 'tp', 'tipo_deposito', 'Tipo de deposito') || '999').trim().replace(/\.0$/, '');
            let posicaoDeposito = String(getRowVal(row, 'PosDepósit', 'PosDepÃ³sit', 'PosDep', 'Pos.depósito', 'Posição no depósito', 'Posição', 'Posicao', 'Posiç', 'PosiÃ§', 'Pos.', 'Pos', 'Pos. depósito', 'Posicao no deposito') || '').trim();
            
            if (!posicaoDeposito) {
              const rowKeys = Object.keys(row);
              const posKey = rowKeys.find(k => k.toLowerCase().trim().startsWith('pos') || k.toLowerCase().trim().includes('posdep'));
              if (posKey && row[posKey]) {
                posicaoDeposito = String(row[posKey]).trim();
              }
            }

            if (deposito === '922') deposito = 'TR-ZONE';
            if (tipoDeposito === '922') tipoDeposito = 'TR-ZONE';

            if (!posicaoDeposito) {
              if (tipoDeposito === 'PES') posicaoDeposito = 'PESAGEM';
              else if (tipoDeposito === 'DEP' || deposito === 'DEP') posicaoDeposito = 'DEVOLUCAO';
              else if (tipoDeposito === 'TR-ZONE' || tipoDeposito === '922') posicaoDeposito = 'TR-ZONE';
              else if (tipoDeposito === '999') posicaoDeposito = 'AJUSTE';
            }

            // Estoque disponível (peso)
            const rawEstq = getRowVal(row, 'Estoque disponível', 'Estoque disponivel', 'Estq.dispon.', 'Estq. dispon.', 'Estq dispon', 'Estoque', 'Qtd', 'Quantidade');
            const estoqueDisponivel = typeof rawEstq === 'number' ? rawEstq : parseFloat(String(rawEstq || '0').replace(/\./g, '').replace(',', '.')) || 0;

            // Datas (vêm como números seriais do Excel ou strings)
            const dataVencimento = getRowVal(row, 'Data do vencimento', 'Data vencimento', 'Data venc.', 'Data venc', 'Vencimento', 'Dt. Venc.');
            const ultimoMovimento = getRowVal(row, 'Último movimento', 'Ultimo movimento', 'Últ.movim.', 'Ãšlt.movim.', 'Ult.movim.', 'Ult. movim.', 'Dt. Mov.', 'Último mov.');
            const ultimaEntrada = getRowVal(row, 'Última entrada dep.', 'Ultima entrada dep.', 'Últ.entrd.', 'Ãšlt.entrd.', 'Ult.entrd.', 'Dt. Entrada', 'Última entrada');
            const tipoEstoque = String(getRowVal(row, 'Tipo de estoque', 'Tipo estoque', 'T', 'tp_estoque') || '');

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
          })
          .filter(Boolean) as AgingData[];

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
