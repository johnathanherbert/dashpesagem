import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { validateSyncKey } from '@/lib/sync-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const authError = validateSyncKey(request);
  if (authError) return authError;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Busca o job pendente mais antigo e trava para atualização
    const result = await client.query(
      `SELECT * FROM sap_automations
       WHERE status = 'pending'
       ORDER BY id ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`
    );

    if (result.rows.length === 0) {
      await client.query('COMMIT');
      return NextResponse.json({ pending: false, job: null });
    }

    const job = result.rows[0];
    await client.query(
      `UPDATE sap_automations
       SET status = 'running', started_at = NOW()
       WHERE id = $1`,
      [job.id]
    );

    await client.query('COMMIT');
    return NextResponse.json({
      pending: true,
      job: {
        ...job,
        status: 'running',
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[API /sap-automation/pending GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar pendências' }, { status: 500 });
  } finally {
    client.release();
  }
}
