import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ConfiguracaoResiduais } from '@/types/aging';

const DEFAULT_CONFIG: ConfiguracaoResiduais = {
  limite_verde: 100,
  limite_amarelo: 900,
  limite_maximo: 999,
  materiais_alto_valor: [],
};

export async function GET() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM configuracao_residuais WHERE id = 1'
    );
    if (result.rows.length === 0) {
      return NextResponse.json(DEFAULT_CONFIG);
    }
    return NextResponse.json(result.rows[0]);
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
    await client.query(
      `INSERT INTO configuracao_residuais (id, limite_verde, limite_amarelo, limite_maximo, materiais_alto_valor)
       VALUES (1, $1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         limite_verde = EXCLUDED.limite_verde,
         limite_amarelo = EXCLUDED.limite_amarelo,
         limite_maximo = EXCLUDED.limite_maximo,
         materiais_alto_valor = EXCLUDED.materiais_alto_valor,
         updated_at = NOW()`,
      [
        config.limite_verde,
        config.limite_amarelo,
        config.limite_maximo,
        config.materiais_alto_valor,
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
