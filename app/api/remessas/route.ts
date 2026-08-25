import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RemessaData } from '@/types/aging';

export async function GET() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM remessas ORDER BY created_at DESC'
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('[API /remessas GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar remessas' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  const data: RemessaData[] = await request.json();

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Nenhuma remessa enviada' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM remessas');

    const batchSize = 500;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      for (const row of batch) {
        await client.query(
          `INSERT INTO remessas (
            numero_remessa, data_picking, peso_total_remessa, item,
            data_disponibilidade, quantidade, unidade_medida, material,
            centro, deposito, descricao_material
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            row.numero_remessa,
            row.data_picking ?? null,
            row.peso_total_remessa ?? null,
            row.item,
            row.data_disponibilidade,
            row.quantidade,
            row.unidade_medida,
            row.material,
            row.centro,
            row.deposito,
            row.descricao_material ?? null,
          ]
        );
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, count: data.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[API /remessas POST]', error);
    return NextResponse.json({ error: 'Erro ao salvar remessas' }, { status: 500 });
  } finally {
    client.release();
  }
}
