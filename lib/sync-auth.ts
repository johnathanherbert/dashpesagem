/**
 * lib/sync-auth.ts
 *
 * Valida a chave de API enviada pelo planilha-sync no header X-Sync-Key.
 * Configure SYNC_API_KEY nas variáveis de ambiente do servidor.
 * Se SYNC_API_KEY não estiver definido, as rotas ficam abertas (compatível com instalações sem chave).
 */
import { NextRequest, NextResponse } from 'next/server';

export function validateSyncKey(request: NextRequest): NextResponse | null {
  const expectedKey = process.env.SYNC_API_KEY;

  // Sem chave configurada → acesso livre (backward compat)
  if (!expectedKey) return null;

  const providedKey = request.headers.get('x-sync-key') ?? '';

  if (providedKey !== expectedKey) {
    return NextResponse.json(
      { error: 'Não autorizado. Header X-Sync-Key inválido ou ausente.' },
      { status: 401 }
    );
  }

  return null; // OK
}
