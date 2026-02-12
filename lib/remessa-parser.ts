import * as XLSX from 'xlsx';
import { RemessaData } from '@/types/aging';

interface RemessaRow {
  coluna1: any;
  coluna2: any;
  coluna3: any;
  coluna4: any;
  coluna5: any;
  coluna6: any;
  coluna7: any;
  coluna9: any;
  coluna10: any;
  coluna13: any;
  coluna14: any;
  coluna15: any;
}

/**
 * Converte string de data no formato DD.MM.YYYY para DD/MM/YYYY
 */
function parseDate(dateStr: string): string {
  if (!dateStr) return '';
  // Remove espaços em branco
  const cleanStr = String(dateStr).trim();
  // Se já está no formato DD/MM/YYYY, retorna
  if (cleanStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
    return cleanStr;
  }
  // Se está no formato DD.MM.YYYY, converte
  if (cleanStr.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
    return cleanStr.replace(/\./g, '/');
  }
  // Retorna como está se não reconhecer o formato
  return cleanStr;
}

/**
 * Limpa strings com espaços excessivos (comum em campos do SAP)
 */
function cleanString(str: any): string {
  if (!str) return '';
  return String(str).trim();
}

/**
 * Converte valor string com vírgula decimal para número
 */
function parseNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const str = String(value).replace(/\./g, '').replace(',', '.');
  return parseFloat(str) || 0;
}

/**
 * Detecta se a linha é um cabeçalho de remessa (contém SNVM ou data de picking)
 */
function isRemessaHeaderRow(row: any[]): boolean {
  // Linha de cabeçalho tem "SNVM" na coluna 1 e uma data na coluna 2
  return row[1] === 'SNVM' && row[2] && String(row[2]).includes('.');
}

/**
 * Detecta se a linha é um item de remessa (tem número de remessa na col 1)
 */
function isRemessaItemRow(row: any[]): boolean {
  // Item tem número de remessa (9 dígitos) na coluna 1 e número do item na coluna 3
  const col1 = String(row[1] || '').trim();
  const col3 = String(row[3] || '').trim();
  return !!col1.match(/^\d{9}$/) && !!col3.match(/^\d+$/);
}

/**
 * Parse do arquivo Excel de remessas do SAP
 */
export async function parseRemessasExcel(file: File): Promise<RemessaData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        // Pegar a primeira planilha
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Converter para array (sem pular linhas)
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: null,
          blankrows: true,
        });

        const remessas: RemessaData[] = [];

        // Variáveis para manter contexto da remessa atual
        let currentRemessaNumber: string | null = null;
        let currentDataPicking: string | null = null;
        let currentPesoTotal: number | null = null;

        // Começar a partir da linha 5 (índice 4) - pular cabeçalhos
        for (let i = 4; i < jsonData.length; i++) {
          const row = jsonData[i];

          // Verificar se é linha vazia
          if (!row || row.every(cell => !cell)) {
            continue;
          }

          // Verificar se é cabeçalho de remessa (linha com SNVM)
          if (isRemessaHeaderRow(row)) {
            currentDataPicking = parseDate(row[2]);
            currentPesoTotal = parseNumber(row[4]);
            continue;
          }

          // Verificar se é item de remessa
          if (isRemessaItemRow(row)) {
            const remessa: RemessaData = {
              numero_remessa: cleanString(row[1]),
              data_picking: currentDataPicking || undefined,
              peso_total_remessa: currentPesoTotal || undefined,
              item: cleanString(row[3]),
              data_disponibilidade: parseDate(row[5]),
              quantidade: parseNumber(row[6]),
              unidade_medida: cleanString(row[9]),
              material: cleanString(row[10]),
              centro: cleanString(row[13]),
              deposito: cleanString(row[14]),
              descricao_material: cleanString(row[15]),
            };

            // Validação básica
            if (remessa.numero_remessa && remessa.material && remessa.quantidade > 0) {
              remessas.push(remessa);
            }
          }
        }

        console.log(`Parsed ${remessas.length} remessas from Excel`);
        resolve(remessas);
      } catch (error) {
        console.error('Error parsing Excel:', error);
        reject(new Error('Erro ao processar arquivo Excel de remessas'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };

    reader.readAsBinaryString(file);
  });
}

/**
 * Valida se o arquivo Excel tem a estrutura esperada de remessas SAP
 */
export function validateRemessasExcel(file: File): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: null,
          blankrows: false,
        });

        // Verificar se tem cabeçalhos esperados nas linhas 2-3
        const hasExpectedHeaders =
          jsonData.length > 10 &&
          (jsonData[1]?.includes('LExp') || jsonData[2]?.includes('Remessa'));

        resolve(hasExpectedHeaders);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };

    reader.readAsBinaryString(file);
  });
}
