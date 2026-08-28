"""
sync.py — Orquestra parser + db para cada tipo de planilha.
"""

from __future__ import annotations

import logging
from pathlib import Path

from app import db, parser, tray

logger = logging.getLogger(__name__)


def sync_estoque(path: Path, kind: str, header_row: int = 3) -> bool:
    """Lê ajuste.xlsx e substitui aging_estoque."""
    try:
        records, ref_date = parser.parse_estoque(path, header_row=header_row)
        if not records:
            logger.warning("sync_estoque: planilha vazia ou sem dados válidos.")
            return False
        count = db.replace_aging_estoque(records)
        logger.info("sync_estoque: %d registros salvos (referência: %s).", count, ref_date)
        tray.notify("Planilha Sync — Estoque", f"{count} registros sincronizados com sucesso!")
        return True
    except Exception as exc:
        logger.error("sync_estoque FALHOU: %s", exc, exc_info=True)
        tray.notify("Planilha Sync — Erro", f"Falha ao sincronizar estoque: {exc}")
        return False


def sync_valor_unitario(path: Path, kind: str) -> bool:
    """Lê planilha de valor unitário e faz upsert em material_valores."""
    try:
        records = parser.parse_valor_unitario(path)
        if not records:
            logger.warning("sync_valor_unitario: nenhum registro válido.")
            return False
        count = db.upsert_material_valores(records)
        logger.info("sync_valor_unitario: %d registros upserted.", count)
        tray.notify("Planilha Sync — Valores", f"{count} valores atualizados com sucesso!")
        return True
    except Exception as exc:
        logger.error("sync_valor_unitario FALHOU: %s", exc, exc_info=True)
        tray.notify("Planilha Sync — Erro", f"Falha ao sincronizar valores: {exc}")
        return False


def sync_remessas(path: Path, kind: str, header_row: int = 3) -> bool:
    """Lê planilha de remessas e substitui a tabela remessas."""
    try:
        records = parser.parse_remessas(path, header_row=header_row)
        if not records:
            logger.warning("sync_remessas: planilha vazia ou sem dados válidos.")
            return False
        count = db.replace_remessas(records)
        logger.info("sync_remessas: %d registros salvos.", count)
        tray.notify("Planilha Sync — Remessas", f"{count} remessas sincronizadas com sucesso!")
        return True
    except Exception as exc:
        logger.error("sync_remessas FALHOU: %s", exc, exc_info=True)
        tray.notify("Planilha Sync — Erro", f"Falha ao sincronizar remessas: {exc}")
        return False
