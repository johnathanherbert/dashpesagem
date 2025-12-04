import * as XLSX from 'xlsx';

export interface MaterialValor {
  material: string;
  valor_unitario: number;
  data_atualizacao?: Date;
}

export function parseValorExcelFile(file: File): Promise<MaterialValor[]> {
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

        // A planilha tem cabeçalho na primeira linha com colunas: Material e Valor unitário
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        console.log('📊 Análise da planilha:');
        console.log(`- Total de linhas: ${jsonData.length}`);
        
        if (jsonData.length > 0) {
          const firstRow = jsonData[0] as any;
          console.log('- Colunas encontradas:', Object.keys(firstRow));
          console.log('- Primeira linha (exemplo):', firstRow);
        }
        
        if (!jsonData || jsonData.length === 0) {
          reject(new Error('Planilha sem dados'));
          return;
        }

        // Processa e mapeia os dados
        const valoresData: MaterialValor[] = [];
        let linhasProcessadas = 0;
        let linhasIgnoradas = 0;
        
        jsonData.forEach((row: any, index: number) => {
          // Debug: mostra as primeiras 3 linhas
          if (index < 3) {
            console.log(`\nLinha ${index + 1}:`, row);
          }
          
          // Busca as colunas - primeiro tenta nomes exatos, depois por padrão
          const allKeys = Object.keys(row);
          
          // Tenta encontrar coluna de Material
          let materialKey: string | undefined = allKeys.find(key => key === 'Material');
          if (!materialKey) {
            materialKey = allKeys.find(key => 
              key.toLowerCase().includes('material') && 
              !key.toLowerCase().includes('texto') &&
              !key.toLowerCase().includes('tipo')
            );
          }
          if (!materialKey) {
            materialKey = allKeys.find(key => 
              key.toLowerCase().includes('codigo') ||
              key.toLowerCase().includes('código')
            );
          }
          
          // Tenta encontrar coluna de Valor
          let valorKey: string | undefined = allKeys.find(key => key === 'Valor unitário');
          if (!valorKey) {
            valorKey = allKeys.find(key => 
              key.toLowerCase().includes('valor') && 
              key.toLowerCase().includes('unitário')
            );
          }
          if (!valorKey) {
            valorKey = allKeys.find(key => 
              key.toLowerCase().includes('valor') ||
              key.toLowerCase().includes('preco') ||
              key.toLowerCase().includes('preço')
            );
          }

          if (!materialKey || !valorKey) {
            if (index < 3) {
              console.warn(`⚠️ Linha ${index + 1}: Colunas não encontradas`);
              console.warn('  Procurando: Material e Valor unitário');
              console.warn('  Colunas disponíveis:', allKeys.slice(0, 5).join(', '), '...');
            }
            linhasIgnoradas++;
            return;
          }

          const material = String(row[materialKey] || '').trim();
          const valorRaw = row[valorKey];
          
          // Converte o valor
          let valor = 0;
          if (typeof valorRaw === 'number') {
            valor = valorRaw;
          } else {
            const valorStr = String(valorRaw || '0').replace(',', '.');
            valor = parseFloat(valorStr);
          }

          // Valida os dados
          if (!material || material === '' || isNaN(valor) || valor < 0) {
            if (index < 3) {
              console.warn(`⚠️ Linha ${index + 1}: Dados inválidos`);
              console.warn(`  Material: "${material}" | Valor: ${valor}`);
            }
            linhasIgnoradas++;
            return;
          }

          valoresData.push({
            material,
            valor_unitario: valor,
            data_atualizacao: new Date(),
          });
          linhasProcessadas++;
        });

        console.log(`\n📈 Resultado do processamento:`);
        console.log(`  ✅ Materiais válidos: ${valoresData.length}`);
        console.log(`  ⚠️ Linhas ignoradas: ${linhasIgnoradas}`);
        
        if (valoresData.length > 0) {
          console.log(`  Exemplo de material processado:`, valoresData[0]);
        }

        if (valoresData.length === 0) {
          reject(new Error(`Nenhum dado válido encontrado. ${linhasIgnoradas} linhas foram ignoradas por dados inválidos ou colunas não reconhecidas. Verifique se a planilha tem colunas "Material" e "Valor Unitário".`));
          return;
        }

        console.log(`✅ Planilha de valores processada: ${valoresData.length} materiais`);
        resolve(valoresData);

      } catch (error) {
        console.error('Erro ao processar arquivo Excel:', error);
        reject(new Error(`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };

    reader.readAsBinaryString(file);
  });
}
