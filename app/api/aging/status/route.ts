import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT MAX(created_at) as last_updated, COUNT(*) as total_rows FROM aging_estoque'
    );
    const row = result.rows[0];
    return NextResponse.json({
      last_updated: row?.last_updated || null,
      total_rows: Number(row?.total_rows || 0),
    });
  } catch (error) {
    console.error('[API /aging/status GET]', error);
    return NextResponse.json({ last_updated: null, total_rows: 0 });
  } finally {
    client.release();
  }
}
