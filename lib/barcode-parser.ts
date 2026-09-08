export interface ParsedBarcode {
  material: string;
  lote: string;
  quantidade?: number | null;
  raw: string;
  extra?: string[];
}

/**
 * Faz o parsing de códigos de barras (ex: padrão Code 128 com Material, Lote, Qtd, etc.)
 * Exemplo de formato: "010311    M5B4344    24..." ou "010311 M5B4344 24"
 */
export function parseBarcode(rawText: string): ParsedBarcode {
  const clean = rawText.trim();
  if (!clean) {
    return { material: '', lote: '', raw: '' };
  }

  // Tenta split por múltiplos espaços ou tabs primeiro
  let parts = clean.split(/[\t\s]+/);

  // Se não dividiu por espaços, tenta delimitadores comuns como ";" ou "|" ou "-"
  if (parts.length === 1) {
    if (clean.includes(';')) {
      parts = clean.split(';');
    } else if (clean.includes('|')) {
      parts = clean.split('|');
    }
  }

  const material = parts[0]?.trim() || '';
  const lote = parts[1]?.trim() || '';
  const qtdRaw = parts[2]?.trim();
  const quantidade = qtdRaw ? parseFloat(qtdRaw.replace(',', '.')) : null;

  return {
    material,
    lote,
    quantidade: !isNaN(quantidade as number) ? quantidade : null,
    raw: clean,
    extra: parts.slice(3),
  };
}
