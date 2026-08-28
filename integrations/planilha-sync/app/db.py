"""
db.py — Acesso ao PostgreSQL do dashpesagem.
Operações de upsert / replace para aging_estoque, material_valores e remessas.
"""

from __future__ import annotations

import logging
from typing import List, Dict, Any

import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool

logger = logging.getLogger(__name__)

_pool: ThreadedConnectionPool | None = None


def init_pool(host: str, port: int, user: str, password: str, dbname: str,
              minconn: int = 1, maxconn: int = 5) -> None:
    """Inicializa o pool de conexões. Chame uma vez na inicialização."""
    global _pool
    _pool = ThreadedConnectionPool(
        minconn, maxconn,
        host=host, port=port, user=user, password=password, dbname=dbname,
        connect_timeout=10,
    )
    logger.info("Pool PostgreSQL inicializado (%s@%s:%s/%s)", user, host, port, dbname)


def _get_conn():
    if _pool is None:
        raise RuntimeError("Pool não inicializado. Chame init_pool() primeiro.")
    return _pool.getconn()


def _put_conn(conn) -> None:
    if _pool is not None:
        _pool.putconn(conn)


def test_connection() -> bool:
    """Testa conectividade com o banco. Retorna True se ok."""
    try:
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
            return True
        finally:
            _put_conn(conn)
    except Exception as exc:
        logger.error("Falha na conexão com o banco: %s", exc)
        return False


# ---------------------------------------------------------------------------
# aging_estoque
# ---------------------------------------------------------------------------

def replace_aging_estoque(records: List[Dict[str, Any]]) -> int:
    """
    Substitui TODOS os registros de aging_estoque pelos registros fornecidos.
    Usa TRUNCATE + INSERT em transação única para atomicidade.
    Retorna o número de linhas inseridas.
    """
    if not records:
        logger.warning("replace_aging_estoque: nenhum registro para inserir.")
        return 0

    conn = _get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("TRUNCATE TABLE aging_estoque RESTART IDENTITY CASCADE")

                psycopg2.extras.execute_values(
                    cur,
                    """
                    INSERT INTO aging_estoque
                        (material, texto_breve_material, unidade_medida, lote,
                         centro, deposito, tipo_deposito, posicao_deposito,
                         estoque_disponivel, data_vencimento, ultimo_movimento,
                         tipo_estoque, ultima_entrada_deposito, dias_aging)
                    VALUES %s
                    """,
                    [
                        (
                            r['material'],
                            r['texto_breve_material'],
                            r['unidade_medida'],
                            r['lote'],
                            r['centro'],
                            r['deposito'],
                            r['tipo_deposito'],
                            r['posicao_deposito'],
                            r['estoque_disponivel'],
                            r['data_vencimento'],
                            r['ultimo_movimento'],
                            r['tipo_estoque'],
                            r['ultima_entrada_deposito'],
                            r['dias_aging'],
                        )
                        for r in records
                    ],
                    page_size=500,
                )
        logger.info("aging_estoque: %d registros inseridos.", len(records))
        return len(records)
    except Exception as exc:
        logger.error("Erro ao inserir aging_estoque: %s", exc)
        raise
    finally:
        _put_conn(conn)


# ---------------------------------------------------------------------------
# material_valores
# ---------------------------------------------------------------------------

def upsert_material_valores(records: List[Dict[str, Any]]) -> int:
    """
    Faz upsert em material_valores (INSERT … ON CONFLICT DO UPDATE).
    Não apaga registros existentes que não estejam na planilha (merge seguro).
    """
    if not records:
        return 0

    conn = _get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                psycopg2.extras.execute_values(
                    cur,
                    """
                    INSERT INTO material_valores (material, valor_unitario)
                    VALUES %s
                    ON CONFLICT (material) DO UPDATE
                        SET valor_unitario = EXCLUDED.valor_unitario,
                            updated_at     = NOW()
                    """,
                    [(r['material'], r['valor_unitario']) for r in records],
                    page_size=500,
                )
        logger.info("material_valores: %d registros upserted.", len(records))
        return len(records)
    except Exception as exc:
        logger.error("Erro ao upsert material_valores: %s", exc)
        raise
    finally:
        _put_conn(conn)


# ---------------------------------------------------------------------------
# remessas
# ---------------------------------------------------------------------------

def replace_remessas(records: List[Dict[str, Any]]) -> int:
    """
    Substitui TODOS os registros de remessas pelos registros fornecidos.
    """
    if not records:
        logger.warning("replace_remessas: nenhum registro para inserir.")
        return 0

    conn = _get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("TRUNCATE TABLE remessas RESTART IDENTITY CASCADE")

                psycopg2.extras.execute_values(
                    cur,
                    """
                    INSERT INTO remessas
                        (numero_remessa, data_picking, peso_total_remessa, item,
                         data_disponibilidade, quantidade, unidade_medida,
                         material, centro, deposito, descricao_material)
                    VALUES %s
                    """,
                    [
                        (
                            r['numero_remessa'],
                            r['data_picking'],
                            r['peso_total_remessa'],
                            r['item'],
                            r['data_disponibilidade'],
                            r['quantidade'],
                            r['unidade_medida'],
                            r['material'],
                            r['centro'],
                            r['deposito'],
                            r['descricao_material'],
                        )
                        for r in records
                    ],
                    page_size=500,
                )
        logger.info("remessas: %d registros inseridos.", len(records))
        return len(records)
    except Exception as exc:
        logger.error("Erro ao inserir remessas: %s", exc)
        raise
    finally:
        _put_conn(conn)
