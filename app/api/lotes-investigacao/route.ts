import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT lote, material, motivo, created_by, created_at FROM lotes_investigacao ORDER BY created_at DESC'
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('[API /lotes-investigacao GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar lotes em investigação' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { lote, material, motivo, created_by } = body;

  if (!lote) {
    return NextResponse.json({ error: 'Lote é obrigatório' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO lotes_investigacao (lote, material, motivo, created_by, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (lote) 
       DO UPDATE SET 
         material = EXCLUDED.material,
         motivo = EXCLUDED.motivo,
         created_by = EXCLUDED.created_by,
         updated_at = NOW()
       RETURNING *`,
      [lote, material ?? null, motivo ?? null, created_by ?? null]
    );
    return NextResponse.json({ success: true, item: result.rows[0] });
  } catch (error) {
    console.error('[API /lotes-investigacao POST]', error);
    return NextResponse.json({ error: 'Erro ao salvar lote em investigação' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const lote = searchParams.get('lote');

  if (!lote) {
    return NextResponse.json({ error: 'Parâmetro lote é obrigatório' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('DELETE FROM lotes_investigacao WHERE lote = $1', [lote]);
    return NextResponse.json({ success: true, lote });
  } catch (error) {
    console.error('[API /lotes-investigacao DELETE]', error);
    return NextResponse.json({ error: 'Erro ao remover lote de investigação' }, { status: 500 });
  } finally {
    client.release();
  }
}
