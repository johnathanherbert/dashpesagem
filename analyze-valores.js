const XLSX = require('xlsx');
const path = require('path');

// Coloque o caminho da sua planilha de valores aqui
const excelFilePath = process.argv[2] || 'planilha_valores.xlsx';

console.log('='.repeat(80));
console.log('ANÁLISE DETALHADA DA PLANILHA DE VALORES');
console.log('='.repeat(80));
console.log(`Arquivo: ${excelFilePath}\n`);

try {
  // Lê o arquivo Excel
  const workbook = XLSX.readFile(excelFilePath);
  
  console.log(`📊 Número de abas: ${workbook.SheetNames.length}`);
  console.log(`📋 Nomes das abas: ${workbook.SheetNames.join(', ')}\n`);

  // Analisa cada aba
  workbook.SheetNames.forEach((sheetName, index) => {
    console.log('-'.repeat(80));
    console.log(`ABA ${index + 1}: "${sheetName}"`);
    console.log('-'.repeat(80));
    
    const worksheet = workbook.Sheets[sheetName];
    
    // Pega o range da planilha
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    console.log(`📏 Range: ${worksheet['!ref']}`);
    console.log(`📊 Linhas: ${range.e.r + 1} | Colunas: ${range.e.c + 1}\n`);
    
    // Converte para JSON para análise
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    if (jsonData.length === 0) {
      console.log('⚠️  Aba vazia!\n');
      return;
    }
    
    // Mostra as primeiras 5 linhas
    console.log('📄 PRIMEIRAS 5 LINHAS:');
    jsonData.slice(0, 5).forEach((row, idx) => {
      console.log(`Linha ${idx + 1}:`, row);
    });
    console.log('');
    
    // Tenta detectar cabeçalho
    console.log('🔍 ANÁLISE DE CABEÇALHOS:');
    for (let i = 0; i < Math.min(5, jsonData.length); i++) {
      const row = jsonData[i];
      console.log(`Linha ${i + 1} como cabeçalho:`);
      row.forEach((cell, colIdx) => {
        if (cell) {
          const cellStr = String(cell).toLowerCase();
          const isMaterial = cellStr.includes('material') || 
                            cellStr.includes('codigo') || 
                            cellStr.includes('código');
          const isValor = cellStr.includes('valor') || 
                         cellStr.includes('preco') || 
                         cellStr.includes('preço') ||
                         cellStr.includes('unitario') ||
                         cellStr.includes('unitário');
          
          let indicator = '';
          if (isMaterial) indicator = ' ✅ [MATERIAL]';
          if (isValor) indicator = ' ✅ [VALOR]';
          
          console.log(`  Col ${colIdx}: "${cell}"${indicator}`);
        }
      });
      console.log('');
    }
    
    // Tenta diferentes configurações de parsing
    console.log('🧪 TESTES DE PARSING:\n');
    
    // Teste 1: Sem pular linhas
    console.log('Teste 1: Sem pular linhas (header: row 1)');
    const test1 = XLSX.utils.sheet_to_json(worksheet);
    console.log(`  Registros: ${test1.length}`);
    if (test1.length > 0) {
      console.log(`  Colunas: ${Object.keys(test1[0]).join(', ')}`);
      console.log(`  Exemplo:`, test1[0]);
    }
    console.log('');
    
    // Teste 2: Pulando primeira linha
    console.log('Teste 2: Pulando primeira linha (range: 1)');
    const test2 = XLSX.utils.sheet_to_json(worksheet, { range: 1 });
    console.log(`  Registros: ${test2.length}`);
    if (test2.length > 0) {
      console.log(`  Colunas: ${Object.keys(test2[0]).join(', ')}`);
      console.log(`  Exemplo:`, test2[0]);
    }
    console.log('');
    
    // Teste 3: Pulando 2 linhas
    console.log('Teste 3: Pulando 2 linhas (range: 2)');
    const test3 = XLSX.utils.sheet_to_json(worksheet, { range: 2 });
    console.log(`  Registros: ${test3.length}`);
    if (test3.length > 0) {
      console.log(`  Colunas: ${Object.keys(test3[0]).join(', ')}`);
      console.log(`  Exemplo:`, test3[0]);
    }
    console.log('');
    
    // Análise de tipos de dados nas colunas
    console.log('📊 ANÁLISE DE TIPOS DE DADOS (primeiras 10 linhas):');
    if (jsonData.length > 1) {
      const header = jsonData[0];
      const dataRows = jsonData.slice(1, 11);
      
      header.forEach((colName, colIdx) => {
        if (!colName) return;
        
        const samples = dataRows.map(row => row[colIdx]).filter(v => v !== null && v !== undefined && v !== '');
        const types = samples.map(v => typeof v);
        const hasNumbers = samples.some(v => !isNaN(parseFloat(String(v))));
        const hasText = samples.some(v => isNaN(parseFloat(String(v))));
        
        console.log(`  "${colName}":`);
        console.log(`    Valores: ${samples.slice(0, 3).join(', ')}`);
        console.log(`    Tipos: ${[...new Set(types)].join(', ')}`);
        console.log(`    Contém números: ${hasNumbers}`);
        console.log(`    Contém texto: ${hasText}`);
      });
    }
    console.log('');
  });
  
  console.log('='.repeat(80));
  console.log('RECOMENDAÇÃO PARA CONFIGURAÇÃO DO PARSER:');
  console.log('='.repeat(80));
  console.log('Com base na análise acima, identifique:');
  console.log('1. Qual linha contém o cabeçalho (os nomes das colunas)');
  console.log('2. Qual coluna contém o código do material');
  console.log('3. Qual coluna contém o valor unitário');
  console.log('4. Se há linhas a serem puladas no início ou no final\n');
  
} catch (error) {
  console.error('❌ Erro ao ler arquivo:', error.message);
  console.log('\n💡 DICA: Certifique-se de que:');
  console.log('1. O arquivo existe no caminho especificado');
  console.log('2. O arquivo está no formato .xlsx ou .xls');
  console.log('3. O arquivo não está aberto em outro programa');
  console.log('\nUso: node analyze-valores.js caminho/para/planilha.xlsx');
}
