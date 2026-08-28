import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { AgingData } from '@/types/aging';
import { validateSyncKey } from '@/lib/sync-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM aging_estoque ORDER BY created_at DESC'
    );
    return NextResponse.json(result.rows, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[API /aging GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar dados de aging' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const authError = validateSyncKey(request);
  if (authError) return authError;

  const data: AgingData[] = await request.json();

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Nenhum dado enviado' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM aging_estoque');

    const batchSize = 500;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      for (const row of batch) {
        await client.query(
          `INSERT INTO aging_estoque (
            material, texto_breve_material, unidade_medida, lote, centro,
            deposito, tipo_deposito, posicao_deposito, estoque_disponivel,
            data_vencimento, ultimo_movimento, tipo_estoque,
            ultima_entrada_deposito, dias_aging
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            row.material,
            row.texto_breve_material,
            row.unidade_medida,
            row.lote,
            row.centro,
            row.deposito,
            row.tipo_deposito,
            row.posicao_deposito,
            row.estoque_disponivel,
            row.data_vencimento ?? null,
            row.ultimo_movimento,
            row.tipo_estoque ?? null,
            row.ultima_entrada_deposito ?? null,
            row.dias_aging ?? null,
          ]
        );
      }
    }

    // Gerar snapshot automático do histórico com timestamp atual
    const totalItens = data.length;
    let somaAging = 0;
    let maxAging = 0;
    let itensCriticos = 0;
    let itensAlerta = 0;
    let itensAjuste = 0;
    let itensAjuSaida = 0;

    for (const item of data) {
      const dias = Number(item.dias_aging || 0);
      somaAging += dias;
      if (dias > maxAging) maxAging = dias;
      if (dias >= 20) itensCriticos++;
      else if (dias >= 7) itensAlerta++;

      const pos = String(item.posicao_deposito || '').toUpperCase();
      if (pos === 'AJUSTE') itensAjuste++;
      else if (pos === 'AJU-SAIDA' || pos === 'AJU-SAÍDA') itensAjuSaida++;
    }
    const mediaAging = totalItens > 0 ? somaAging / totalItens : 0;

    await client.query(
      `INSERT INTO dashboard_historico (
        snapshot_at, total_itens, media_aging, max_aging, itens_criticos, itens_alerta,
        itens_ajuste, itens_aju_saida
      ) VALUES (NOW(), $1, $2, $3, $4, $5, $6, $7)`,
      [totalItens, mediaAging, maxAging, itensCriticos, itensAlerta, itensAjuste, itensAjuSaida]
    );

    await client.query('COMMIT');
    return NextResponse.json({ success: true, count: data.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[API /aging POST]', error);
    return NextResponse.json({ error: 'Erro ao salvar dados de aging' }, { status: 500 });
  } finally {
    client.release();
  }
}
