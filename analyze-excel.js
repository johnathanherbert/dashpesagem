// Script para analisar a estrutura da planilha Excel
// Execute com: node analyze-excel.js

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Caminho para a planilha
const excelFilePath = path.join(__dirname, 'ajutes.xlsx');

console.log('🔍 Analisando planilha Excel...\n');
console.log(`Arquivo: ${excelFilePath}\n`);

try {
  // Verificar se o arquivo existe
  if (!fs.existsSync(excelFilePath)) {
    console.error('❌ Arquivo não encontrado!');
    process.exit(1);
  }

  // Ler o arquivo Excel
  const workbook = XLSX.readFile(excelFilePath);
  
  console.log('📊 INFORMAÇÕES DO ARQUIVO:\n');
  console.log(`Total de planilhas: ${workbook.SheetNames.length}`);
  console.log(`Nome das planilhas: ${workbook.SheetNames.join(', ')}\n`);

  // Analisar cada planilha
  workbook.SheetNames.forEach((sheetName, index) => {
    console.log(`${'='.repeat(80)}`);
    console.log(`PLANILHA ${index + 1}: "${sheetName}"`);
    console.log(`${'='.repeat(80)}\n`);

    const worksheet = workbook.Sheets[sheetName];
    
    // Converter para JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    
    if (jsonData.length === 0) {
      console.log('⚠️  Planilha vazia\n');
      return;
    }

    console.log(`📝 Total de linhas de dados: ${jsonData.length}\n`);

    // Obter todas as colunas (do primeiro registro)
    const columns = Object.keys(jsonData[0]);
    
    console.log(`📋 COLUNAS ENCONTRADAS (${columns.length} colunas):\n`);
    
    columns.forEach((col, idx) => {
      console.log(`   ${idx + 1}. "${col}"`);
    });

    console.log('\n📊 ANÁLISE DETALHADA DAS COLUNAS:\n');
    
    columns.forEach((col) => {
      const values = jsonData.map(row => row[col]).filter(v => v !== '' && v !== null && v !== undefined);
      const uniqueValues = [...new Set(values)];
      const sampleValues = values.slice(0, 5);
      
      // Detectar tipo de dado
      const types = values.map(v => {
        if (typeof v === 'number') return 'number';
        if (!isNaN(parseFloat(v)) && isFinite(v)) return 'numeric-string';
        if (v instanceof Date) return 'date';
        if (typeof v === 'string' && v.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) return 'date-string';
        return 'string';
      });
      const primaryType = types.sort((a, b) =>
        types.filter(t => t === a).length - types.filter(t => t === b).length
      ).pop();

      console.log(`   🔹 "${col}"`);
      console.log(`      Tipo detectado: ${primaryType}`);
      console.log(`      Valores não vazios: ${values.length}/${jsonData.length}`);
      console.log(`      Valores únicos: ${uniqueValues.length}`);
      console.log(`      Exemplos: ${sampleValues.slice(0, 3).map(v => `"${v}"`).join(', ')}`);
      
      // Estatísticas numéricas
      if (primaryType === 'number' || primaryType === 'numeric-string') {
        const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
        const min = Math.min(...numericValues);
        const max = Math.max(...numericValues);
        const sum = numericValues.reduce((a, b) => a + b, 0);
        const avg = sum / numericValues.length;
        
        console.log(`      Min: ${min.toFixed(2)} | Max: ${max.toFixed(2)} | Média: ${avg.toFixed(2)}`);
      }
      
      console.log('');
    });

    console.log('📋 EXEMPLO DE 3 PRIMEIRAS LINHAS:\n');
    console.log(JSON.stringify(jsonData.slice(0, 3), null, 2));
    console.log('\n');

    // Sugestões de mapeamento
    console.log('💡 SUGESTÕES DE MAPEAMENTO:\n');
    
    const mappingSuggestions = {
      codigo_materia_prima: columns.filter(c => 
        c.toLowerCase().includes('codigo') || 
        c.toLowerCase().includes('código') || 
        c.toLowerCase().includes('material') ||
        c.toLowerCase().includes('mat')
      ),
      lote: columns.filter(c => 
        c.toLowerCase().includes('lote') || 
        c.toLowerCase().includes('batch')
      ),
      peso: columns.filter(c => 
        c.toLowerCase().includes('peso') || 
        c.toLowerCase().includes('weight') ||
        c.toLowerCase().includes('kg') ||
        c.toLowerCase().includes('qtd') ||
        c.toLowerCase().includes('quantidade')
      ),
      deposito: columns.filter(c => 
        c.toLowerCase().includes('dep') || 
        c.toLowerCase().includes('armazem') ||
        c.toLowerCase().includes('local')
      ),
      data: columns.filter(c => 
        c.toLowerCase().includes('data') || 
        c.toLowerCase().includes('date') ||
        c.toLowerCase().includes('movimento')
      ),
    };

    Object.entries(mappingSuggestions).forEach(([field, suggestions]) => {
      if (suggestions.length > 0) {
        console.log(`   ${field}: ${suggestions.map(s => `"${s}"`).join(', ')}`);
      }
    });

    console.log('\n');
  });

  // Gerar relatório em arquivo
  const report = {
    arquivo: excelFilePath,
    data_analise: new Date().toISOString(),
    planilhas: workbook.SheetNames.map(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      const columns = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
      
      return {
        nome: sheetName,
        total_linhas: jsonData.length,
        colunas: columns,
        exemplo_dados: jsonData.slice(0, 2),
      };
    }),
  };

  fs.writeFileSync('planilha-analise.json', JSON.stringify(report, null, 2));
  console.log('✅ Relatório detalhado salvo em: planilha-analise.json\n');

} catch (error) {
  console.error('❌ Erro ao analisar planilha:', error.message);
  process.exit(1);
}
