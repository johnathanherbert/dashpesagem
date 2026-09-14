import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { validateSyncKey } from '@/lib/sync-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const materiaPrima = searchParams.get('materia_prima');
  const semiAcabado = searchParams.get('semi_acabado');
  const search = searchParams.get('search');

  const client = await pool.connect();
  try {
    if (materiaPrima) {
      const normalized = materiaPrima.trim().padStart(6, '0');
      const result = await client.query(
        `SELECT id, concatenar, status, semi_acabado, descricao_semi_acabado,
                qtd_semi_acabado, centro_semi_acabado, materia_prima,
                descricao_materia_prima, qtd_materia_prima, un_materia_prima
         FROM lista_tecnica
         WHERE materia_prima = $1 OR materia_prima = $2
         ORDER BY descricao_semi_acabado ASC`,
        [normalized, materiaPrima.trim()]
      );
      return NextResponse.json(result.rows);
    }

    if (semiAcabado) {
      const normalized = semiAcabado.trim().padStart(6, '0');
      const result = await client.query(
        `SELECT id, concatenar, status, semi_acabado, descricao_semi_acabado,
                qtd_semi_acabado, centro_semi_acabado, materia_prima,
                descricao_materia_prima, qtd_materia_prima, un_materia_prima
         FROM lista_tecnica
         WHERE semi_acabado = $1 OR semi_acabado = $2
         ORDER BY materia_prima ASC`,
        [normalized, semiAcabado.trim()]
      );
      return NextResponse.json(result.rows);
    }

    if (search) {
      const q = `%${search.trim().toLowerCase()}%`;
      const result = await client.query(
        `SELECT id, concatenar, status, semi_acabado, descricao_semi_acabado,
                qtd_semi_acabado, centro_semi_acabado, materia_prima,
                descricao_materia_prima, qtd_materia_prima, un_materia_prima
         FROM lista_tecnica
         WHERE LOWER(materia_prima) LIKE $1
            OR LOWER(descricao_materia_prima) LIKE $1
            OR LOWER(semi_acabado) LIKE $1
            OR LOWER(descricao_semi_acabado) LIKE $1
         ORDER BY descricao_materia_prima ASC, descricao_semi_acabado ASC
         LIMIT 200`,
        [q]
      );
      return NextResponse.json(result.rows);
    }

    // Default: lista completa ou resumo
    const result = await client.query(
      `SELECT id, concatenar, status, semi_acabado, descricao_semi_acabado,
              qtd_semi_acabado, centro_semi_acabado, materia_prima,
              descricao_materia_prima, qtd_materia_prima, un_materia_prima
       FROM lista_tecnica
       ORDER BY materia_prima ASC, semi_acabado ASC`
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('[API /lista-tecnica GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar lista técnica' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const authError = validateSyncKey(request);
  if (authError) return authError;

  const data = await request.json();
  if (!Array.isArray(data) || data.length === 0) {
    return NextResponse.json({ error: 'Nenhum dado enviado' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM lista_tecnica');

    for (const row of data) {
      await client.query(
        `INSERT INTO lista_tecnica (
          concatenar, status, semi_acabado, descricao_semi_acabado,
          qtd_semi_acabado, centro_semi_acabado, materia_prima,
          descricao_materia_prima, qtd_materia_prima, un_materia_prima
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          row.concatenar || '',
          row.status || 'SEMI ACABADO',
          String(row.semi_acabado || '').padStart(6, '0'),
          row.descricao_semi_acabado || '',
          Number(row.qtd_semi_acabado || 0),
          row.centro_semi_acabado || '600',
          String(row.materia_prima || '').padStart(6, '0'),
          row.descricao_materia_prima || '',
          Number(row.qtd_materia_prima || 0),
          row.un_materia_prima || 'KG',
        ]
      );
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, count: data.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[API /lista-tecnica POST]', error);
    return NextResponse.json({ error: 'Erro ao salvar lista técnica' }, { status: 500 });
  } finally {
    client.release();
  }
}
