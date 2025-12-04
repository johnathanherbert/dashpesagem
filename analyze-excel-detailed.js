// Script detalhado para analisar a estrutura exata da planilha Excel
// Execute com: node analyze-excel-detailed.js

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelFilePath = path.join(__dirname, 'ajutes.xlsx');

console.log('🔍 ANÁLISE DETALHADA DA PLANILHA\n');
console.log('='.repeat(80));

try {
  if (!fs.existsSync(excelFilePath)) {
    console.error('❌ Arquivo não encontrado!');
    process.exit(1);
  }

  const workbook = XLSX.readFile(excelFilePath);
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  console.log(`\n📋 Planilha: "${firstSheetName}"\n`);

  // Obter o range da planilha
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  console.log(`📊 Range: ${worksheet['!ref']}`);
  console.log(`   Linhas: ${range.s.r + 1} até ${range.e.r + 1} (total: ${range.e.r - range.s.r + 1} linhas)`);
  console.log(`   Colunas: ${range.s.c + 1} até ${range.e.c + 1} (total: ${range.e.c - range.s.c + 1} colunas)\n`);

  // Analisar as primeiras 10 linhas célula por célula
  console.log('🔍 PRIMEIRAS 10 LINHAS (CÉLULA POR CÉLULA):\n');
  
  for (let row = 0; row <= Math.min(9, range.e.r); row++) {
    console.log(`${'─'.repeat(80)}`);
    console.log(`LINHA ${row + 1}:`);
    console.log(`${'─'.repeat(80)}`);
    
    let hasContent = false;
    const cellContents = [];
    
    for (let col = 0; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];
      
      if (cell && cell.v !== undefined && cell.v !== '') {
        hasContent = true;
        const colLetter = XLSX.utils.encode_col(col);
        cellContents.push({
          col: colLetter,
          index: col,
          value: cell.v,
          type: cell.t
        });
      }
    }
    
    if (hasContent) {
      cellContents.forEach(cell => {
        console.log(`   [${cell.col}${row + 1}] Coluna ${cell.index}: "${cell.value}" (tipo: ${cell.type})`);
      });
    } else {
      console.log('   (linha vazia)');
    }
    console.log('');
  }

  // Testar diferentes ranges para conversão
  console.log('\n' + '='.repeat(80));
  console.log('📊 TESTANDO DIFERENTES CONVERSÕES:\n');

  const testRanges = [
    { name: 'Range 0 (desde início)', range: 0 },
    { name: 'Range 1 (pula 1 linha)', range: 1 },
    { name: 'Range 2 (pula 2 linhas)', range: 2 },
    { name: 'Range 3 (pula 3 linhas)', range: 3 },
    { name: 'Range 4 (pula 4 linhas)', range: 4 }
  ];

  testRanges.forEach(test => {
    console.log(`\n${test.name}:`);
    console.log('─'.repeat(80));
    
    try {
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: test.range });
      
      if (jsonData.length > 0) {
        console.log(`✓ ${jsonData.length} registros encontrados`);
        console.log('\nColunas detectadas:');
        const columns = Object.keys(jsonData[0]);
        columns.forEach((col, idx) => {
          console.log(`   ${idx + 1}. "${col}"`);
        });
        
        console.log('\nPrimeiros 2 registros:');
        jsonData.slice(0, 2).forEach((row, idx) => {
          console.log(`\nRegistro ${idx + 1}:`);
          Object.entries(row).forEach(([key, value]) => {
            console.log(`   ${key}: "${value}"`);
          });
        });
      } else {
        console.log('✗ Nenhum registro encontrado');
      }
    } catch (error) {
      console.log(`✗ Erro: ${error.message}`);
    }
  });

  // Análise de onde começam os dados reais
  console.log('\n' + '='.repeat(80));
  console.log('🎯 DETECÇÃO AUTOMÁTICA DO INÍCIO DOS DADOS:\n');

  let dataStartRow = -1;
  const expectedColumns = ['Material', 'Texto breve material', 'UMB', 'Lote', 'Centro', 'Depósito'];

  for (let row = 0; row <= Math.min(10, range.e.r); row++) {
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: row, header: 1 });
    
    if (jsonData.length > 0) {
      const firstRow = jsonData[0];
      const matchedColumns = expectedColumns.filter(col => 
        firstRow.some(cell => String(cell).toLowerCase().includes(col.toLowerCase()))
      );
      
      if (matchedColumns.length >= 3) {
        dataStartRow = row;
        console.log(`✓ Linha ${row + 1} parece ser o cabeçalho!`);
        console.log(`  Colunas encontradas: ${matchedColumns.join(', ')}`);
        console.log(`  Conteúdo da linha: ${JSON.stringify(firstRow.filter(c => c))}`);
        break;
      }
    }
  }

  if (dataStartRow >= 0) {
    console.log(`\n✅ RECOMENDAÇÃO: Use range: ${dataStartRow} para pular até o cabeçalho correto\n`);
    
    // Mostrar exemplo com o range correto
    console.log('📋 EXEMPLO COM RANGE CORRETO:\n');
    const correctData = XLSX.utils.sheet_to_json(worksheet, { range: dataStartRow });
    console.log(`Total de registros: ${correctData.length}`);
    console.log('\nPrimeiro registro completo:');
    console.log(JSON.stringify(correctData[0], null, 2));
  } else {
    console.log('\n⚠️ Não foi possível detectar automaticamente o início dos dados');
  }

} catch (error) {
  console.error('❌ Erro:', error.message);
  console.error(error.stack);
}
