const XLSX = require('xlsx');

console.log('Lendo arquivo REMESSAS.xlsx...\n');

const workbook = XLSX.readFile('REMESSAS.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

console.log('Nome da planilha:', sheetName);
console.log('\n=== ESTRUTURA DA PLANILHA ===\n');

// Converter para JSON
const jsonData = XLSX.utils.sheet_to_json(worksheet, {
  header: 1,
  defval: null,
  blankrows: false
});

console.log('Total de linhas:', jsonData.length);
console.log('\n=== PRIMEIRAS 10 LINHAS ===\n');

jsonData.slice(0, 10).forEach((row, idx) => {
  console.log(`Linha ${idx + 1}:`, JSON.stringify(row, null, 2));
});

console.log('\n=== CABEÇALHOS DETECTADOS ===\n');

// Tentar encontrar linha de cabeçalho
let headerRowIndex = -1;
for (let i = 0; i < Math.min(10, jsonData.length); i++) {
  const row = jsonData[i];
  if (row && row.length > 5) {
    console.log(`\nLinha ${i + 1} (${row.length} colunas):`);
    row.forEach((cell, idx) => {
      if (cell) {
        console.log(`  Col ${idx}: "${cell}"`);
      }
    });
  }
}

console.log('\n=== AMOSTRA DE DADOS ===\n');

// Mostrar algumas linhas do meio
const midPoint = Math.floor(jsonData.length / 2);
jsonData.slice(midPoint, midPoint + 5).forEach((row, idx) => {
  console.log(`Linha ${midPoint + idx + 1}:`, JSON.stringify(row, null, 2));
});

console.log('\n=== ESTATÍSTICAS ===\n');

// Análise de colunas
const columnStats = {};
jsonData.forEach(row => {
  if (row) {
    row.forEach((cell, colIdx) => {
      if (!columnStats[colIdx]) {
        columnStats[colIdx] = {
          nonNull: 0,
          samples: []
        };
      }
      if (cell !== null && cell !== undefined && cell !== '') {
        columnStats[colIdx].nonNull++;
        if (columnStats[colIdx].samples.length < 3) {
          columnStats[colIdx].samples.push(cell);
        }
      }
    });
  }
});

console.log('Estatísticas por coluna:');
Object.entries(columnStats).forEach(([colIdx, stats]) => {
  console.log(`Coluna ${colIdx}: ${stats.nonNull} valores não-nulos`);
  console.log(`  Amostras: ${stats.samples.join(', ')}`);
});
