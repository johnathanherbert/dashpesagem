import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { validateSyncKey } from '@/lib/sync-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const authError = validateSyncKey(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const jobId = body.job_id || body.id;
    const status = body.status === 'failed' ? 'failed' : 'completed';
    const resultMessage = body.result_message || (status === 'completed' ? 'Executado com sucesso no SAP' : 'Erro na execução');

    if (!jobId) {
      return NextResponse.json({ error: 'job_id obrigatório' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE sap_automations
         SET status = $1, completed_at = NOW(), result_message = $2
         WHERE id = $3
         RETURNING *`,
        [status, resultMessage, parseInt(jobId)]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        job: result.rows[0],
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[API /sap-automation/complete POST]', error);
    return NextResponse.json({ error: 'Erro ao finalizar job' }, { status: 500 });
  }
}
