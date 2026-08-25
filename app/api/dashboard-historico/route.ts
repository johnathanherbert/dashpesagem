import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { DashboardSnapshot } from '@/types/aging';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '90');

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM dashboard_historico ORDER BY snapshot_at DESC LIMIT $1',
      [limit]
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('[API /dashboard-historico GET]', error);
    return NextResponse.json([]);
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  const snapshot: DashboardSnapshot = await request.json();
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO dashboard_historico (
        total_itens, media_aging, max_aging, itens_criticos, itens_alerta,
        total_valorizado, valor_critico, valor_alerta, itens_com_valor,
        valor_ajuste, itens_ajuste, valor_aju_saida, itens_aju_saida,
        itens_vencidos, itens_vencendo_30d, materiais_inf, materiais_cfa
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        snapshot.total_itens,
        snapshot.media_aging,
        snapshot.max_aging,
        snapshot.itens_criticos,
        snapshot.itens_alerta,
        snapshot.total_valorizado,
        snapshot.valor_critico,
        snapshot.valor_alerta,
        snapshot.itens_com_valor,
        snapshot.valor_ajuste,
        snapshot.itens_ajuste,
        snapshot.valor_aju_saida,
        snapshot.itens_aju_saida,
        snapshot.itens_vencidos,
        snapshot.itens_vencendo_30d,
        snapshot.materiais_inf,
        snapshot.materiais_cfa,
      ]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /dashboard-historico POST]', error);
    return NextResponse.json({ error: 'Erro ao salvar snapshot' }, { status: 500 });
  } finally {
    client.release();
  }
}
