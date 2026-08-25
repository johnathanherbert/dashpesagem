// Script para executar o schema no banco PostgreSQL
// Uso: node scripts/run-schema.js
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: '192.168.15.16',
  port: 5432,
  user: 'postgres',
  password: '07Huk0594@#$',
  database: 'postgres',
});

async function runSchema() {
  const client = await pool.connect();
  try {
    console.log('✅ Conectado ao PostgreSQL em 192.168.15.16:5432');
    const schemaPath = path.join(__dirname, '..', 'postgres-schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    console.log('📄 Executando schema...');
    const result = await client.query(sql);
    // O último SELECT retorna as tabelas criadas
    const lastResult = Array.isArray(result) ? result[result.length - 1] : result;
    if (lastResult && lastResult.rows) {
      console.log('\n📊 Tabelas criadas:');
      lastResult.rows.forEach(row => {
        console.log(`  ✓ ${row.table_name} (${row.colunas} colunas)`);
      });
    }
    console.log('\n✅ Schema executado com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao executar schema:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runSchema();
