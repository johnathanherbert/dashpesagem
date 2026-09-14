import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  const client = await pool.connect();
  try {
    if (id) {
      const result = await client.query(
        'SELECT * FROM sap_automations WHERE id = $1',
        [parseInt(id)]
      );
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 });
      }
      return NextResponse.json(result.rows[0]);
    }

    const result = await client.query(
      'SELECT * FROM sap_automations ORDER BY id DESC LIMIT 20'
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('[API /sap-automation GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar automações' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const command = body.command || 'movermigo';
    const requestedBy = body.requested_by || 'Web Dashboard';
    const scriptCode = body.script_code || null;

    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO sap_automations (command, status, requested_by, script_code)
         VALUES ($1, 'pending', $2, $3)
         RETURNING *`,
        [command, requestedBy, scriptCode]
      );

      return NextResponse.json({
        success: true,
        job: result.rows[0],
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[API /sap-automation POST]', error);
    return NextResponse.json(
      { error: 'Erro ao criar solicitação de automação: ' + (error?.message || error) },
      { status: 500 }
    );
  }
}
