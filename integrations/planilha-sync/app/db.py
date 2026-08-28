"""
db.py — Comunicação com o dashpesagem via API HTTP (Cloudflare → dash.agilework.app.br).

Substitui a conexão direta PostgreSQL por chamadas HTTP às API Routes do Next.js.
Funciona de qualquer rede, sem necessidade de VPN ou acesso direto ao banco.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Dict, List

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

# Configurado via init()
_base_url: str = ''
_api_key: str = ''
_session: requests.Session | None = None
_timeout: int = 60          # segundos por request
_chunk_size: int = 500      # registros por POST (evita payload muito grande)


def _build_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=4,
        backoff_factor=2,           # 2s, 4s, 8s, 16s
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=['POST', 'GET'],
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount('https://', adapter)
    session.mount('http://', adapter)
    return session


def init(base_url: str, api_key: str = '', timeout: int = 60, chunk_size: int = 500) -> None:
    """
    Inicializa o cliente HTTP.

    :param base_url:   URL base do dashpesagem, ex: https://dash.agilework.app.br
    :param api_key:    Chave secreta enviada no header X-Sync-Key (pode ser vazia)
    :param timeout:    Timeout em segundos por requisição
    :param chunk_size: Máximo de registros por requisição POST
    """
    global _base_url, _api_key, _timeout, _chunk_size, _session
    _base_url   = base_url.rstrip('/')
    _api_key    = api_key
    _timeout    = timeout
    _chunk_size = chunk_size
    _session    = _build_session()
    logger.info("API client inicializado → %s", _base_url)


def _headers() -> Dict[str, str]:
    h = {'Content-Type': 'application/json'}
    if _api_key:
        h['X-Sync-Key'] = _api_key
    return h


def _post_chunked(endpoint: str, records: List[Dict[str, Any]]) -> int:
    """
    Envia records em chunks via POST para evitar payloads gigantes.
    Retorna total de registros enviados.
    """
    if _session is None:
        raise RuntimeError("Cliente não inicializado. Chame init() primeiro.")

    url = f"{_base_url}{endpoint}"
    total_sent = 0
    chunks = [records[i:i + _chunk_size] for i in range(0, len(records), _chunk_size)]

    for idx, chunk in enumerate(chunks, 1):
        logger.debug("POST %s — chunk %d/%d (%d registros)", endpoint, idx, len(chunks), len(chunk))
        t0 = time.perf_counter()

        resp = _session.post(
            url,
            data=json.dumps(chunk, ensure_ascii=False, default=str),
            headers=_headers(),
            timeout=_timeout,
        )

        elapsed = time.perf_counter() - t0

        if not resp.ok:
            body = {}
            try:
                body = resp.json()
            except Exception:
                pass
            raise RuntimeError(
                f"POST {endpoint} chunk {idx} falhou: HTTP {resp.status_code} — "
                f"{body.get('error', resp.text[:200])} ({elapsed:.1f}s)"
            )

        total_sent += len(chunk)
        logger.debug("Chunk %d OK (%.1fs)", idx, elapsed)

    return total_sent


def test_connection() -> bool:
    """Testa conectividade com a API. Retorna True se ok."""
    if _session is None:
        return False
    try:
        resp = _session.get(
            f"{_base_url}/api/aging",
            headers=_headers(),
            timeout=10,
            params={'limit': 1},
        )
        ok = resp.status_code < 500
        if ok:
            logger.info("Conectividade com API OK (HTTP %s)", resp.status_code)
        else:
            logger.error("API retornou HTTP %s", resp.status_code)
        return ok
    except Exception as exc:
        logger.error("Falha na conexão com a API: %s", exc)
        return False


# ---------------------------------------------------------------------------
# aging_estoque  →  POST /api/aging
# ---------------------------------------------------------------------------

def replace_aging_estoque(records: List[Dict[str, Any]]) -> int:
    """
    Substitui TODOS os dados de aging_estoque enviando via POST /api/aging.
    A rota do Next.js já faz DELETE + INSERT em transação.
    """
    if not records:
        logger.warning("replace_aging_estoque: nenhum registro para enviar.")
        return 0

    logger.info("Enviando %d registros para /api/aging...", len(records))
    sent = _post_chunked('/api/aging', records)
    logger.info("aging_estoque: %d registros enviados.", sent)
    return sent


# ---------------------------------------------------------------------------
# material_valores  →  POST /api/material-valores
# ---------------------------------------------------------------------------

def upsert_material_valores(records: List[Dict[str, Any]]) -> int:
    """Envia valores unitários via POST /api/material-valores."""
    if not records:
        return 0

    logger.info("Enviando %d registros para /api/material-valores...", len(records))
    sent = _post_chunked('/api/material-valores', records)
    logger.info("material_valores: %d registros enviados.", sent)
    return sent


# ---------------------------------------------------------------------------
# remessas  →  POST /api/remessas
# ---------------------------------------------------------------------------

def replace_remessas(records: List[Dict[str, Any]]) -> int:
    """Substitui todas as remessas via POST /api/remessas."""
    if not records:
        logger.warning("replace_remessas: nenhum registro para enviar.")
        return 0

    logger.info("Enviando %d registros para /api/remessas...", len(records))
    sent = _post_chunked('/api/remessas', records)
    logger.info("remessas: %d registros enviados.", sent)
    return sent
