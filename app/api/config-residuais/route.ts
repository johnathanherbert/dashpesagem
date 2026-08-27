import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ConfiguracaoResiduais } from '@/types/aging';

const DEFAULT_CONFIG: ConfiguracaoResiduais = {
  limite_verde: 100,
  limite_amarelo: 900,
  limite_maximo: 999,
  materiais_alto_valor: [],
  dias_atencao: 3,
  dias_alerta: 7,
  dias_critico: 20,
  dias_vencimento_proximo: 30,
};

// Assegura que a tabela possui as colunas necessárias
let schemaEnsured = false;
async function ensureSchema(client: any) {
  if (schemaEnsured) return;
  try {
    await client.query(`
      ALTER TABLE configuracao_residuais 
      ADD COLUMN IF NOT EXISTS dias_atencao INTEGER DEFAULT 3,
      ADD COLUMN IF NOT EXISTS dias_alerta INTEGER DEFAULT 7,
      ADD COLUMN IF NOT EXISTS dias_critico INTEGER DEFAULT 20,
      ADD COLUMN IF NOT EXISTS dias_vencimento_proximo INTEGER DEFAULT 30;
    `);
    schemaEnsured = true;
  } catch (err) {
    console.warn('[API /config-residuais ensureSchema]', err);
  }
}

export async function GET() {
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const result = await client.query(
      'SELECT * FROM configuracao_residuais WHERE id = 1'
    );
    if (result.rows.length === 0) {
      return NextResponse.json(DEFAULT_CONFIG);
    }
    const row = result.rows[0];
    return NextResponse.json({
      limite_verde: Number(row.limite_verde ?? DEFAULT_CONFIG.limite_verde),
      limite_amarelo: Number(row.limite_amarelo ?? DEFAULT_CONFIG.limite_amarelo),
      limite_maximo: Number(row.limite_maximo ?? DEFAULT_CONFIG.limite_maximo),
      materiais_alto_valor: row.materiais_alto_valor || [],
      dias_atencao: Number(row.dias_atencao ?? DEFAULT_CONFIG.dias_atencao),
      dias_alerta: Number(row.dias_alerta ?? DEFAULT_CONFIG.dias_alerta),
      dias_critico: Number(row.dias_critico ?? DEFAULT_CONFIG.dias_critico),
      dias_vencimento_proximo: Number(row.dias_vencimento_proximo ?? DEFAULT_CONFIG.dias_vencimento_proximo),
    });
  } catch (error) {
    console.error('[API /config-residuais GET]', error);
    return NextResponse.json(DEFAULT_CONFIG);
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  const config: ConfiguracaoResiduais = await request.json();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    await client.query(
      `INSERT INTO configuracao_residuais (
         id, 
         limite_verde, 
         limite_amarelo, 
         limite_maximo, 
         materiais_alto_valor,
         dias_atencao,
         dias_alerta,
         dias_critico,
         dias_vencimento_proximo
       )
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         limite_verde = EXCLUDED.limite_verde,
         limite_amarelo = EXCLUDED.limite_amarelo,
         limite_maximo = EXCLUDED.limite_maximo,
         materiais_alto_valor = EXCLUDED.materiais_alto_valor,
         dias_atencao = EXCLUDED.dias_atencao,
         dias_alerta = EXCLUDED.dias_alerta,
         dias_critico = EXCLUDED.dias_critico,
         dias_vencimento_proximo = EXCLUDED.dias_vencimento_proximo,
         updated_at = NOW()`,
      [
        config.limite_verde ?? DEFAULT_CONFIG.limite_verde,
        config.limite_amarelo ?? DEFAULT_CONFIG.limite_amarelo,
        config.limite_maximo ?? DEFAULT_CONFIG.limite_maximo,
        config.materiais_alto_valor || [],
        config.dias_atencao ?? DEFAULT_CONFIG.dias_atencao,
        config.dias_alerta ?? DEFAULT_CONFIG.dias_alerta,
        config.dias_critico ?? DEFAULT_CONFIG.dias_critico,
        config.dias_vencimento_proximo ?? DEFAULT_CONFIG.dias_vencimento_proximo,
      ]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /config-residuais POST]', error);
    return NextResponse.json({ error: 'Erro ao salvar configuração' }, { status: 500 });
  } finally {
    client.release();
  }
}
