import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT material, valor_unitario FROM material_valores ORDER BY material'
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('[API /material-valores GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar valores' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  const data: { material: string; valor_unitario: number }[] = await request.json();

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Nenhum dado enviado' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM material_valores');

    const batchSize = 500;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      for (const row of batch) {
        await client.query(
          `INSERT INTO material_valores (material, valor_unitario)
           VALUES ($1, $2)
           ON CONFLICT (material) DO UPDATE SET valor_unitario = EXCLUDED.valor_unitario`,
          [row.material, row.valor_unitario]
        );
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, count: data.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[API /material-valores POST]', error);
    return NextResponse.json({ error: 'Erro ao salvar valores' }, { status: 500 });
  } finally {
    client.release();
  }
}
