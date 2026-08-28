"""
parser.py — Leitura e processamento das planilhas Excel.
Trata strings vazias e valores NaN do pandas para garantir dados limpos.
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from pathlib import Path
from typing import List, Dict, Any, Tuple

import pandas as pd

logger = logging.getLogger(__name__)


def _clean_str(val) -> str:
    """Limpa valor para string pura, tratando NaN, None e vazios."""
    if val is None or pd.isna(val):
        return ''
    s = str(val).strip()
    if s.lower() in ('nan', 'none', 'null', 'nat', '<na>'):
        return ''
    return s


def _normalize_lote(val) -> str:
    if pd.isna(val):
        return ''
    lote = _clean_str(val)
    if not lote:
        return ''
    if lote.endswith('.0'):
        inteiro = lote[:-2]
        if inteiro.isdigit():
            return inteiro
    return lote


def _normalize_deposito(val) -> str:
    s = _clean_str(val)
    if not s:
        return ''
    _MAP = {'922': 'TR-ZONE', 'PES': 'PES', 'DEP': 'DEP', '999': '999'}
    return _MAP.get(s, s)


def _format_date(val) -> str:
    """Converte serial Excel ou datetime/Timestamp para DD/MM/YYYY."""
    if val is None or pd.isna(val):
        return ''
    if isinstance(val, (datetime, pd.Timestamp)):
        try:
            return val.strftime('%d/%m/%Y')
        except Exception:
            return ''
    if isinstance(val, str):
        val = _clean_str(val)
        if not val:
            return ''
        return val
    # número serial do Excel
    if isinstance(val, (int, float)):
        try:
            from datetime import timedelta
            base = datetime(1900, 1, 1)
            d = base + timedelta(days=int(val) - 2)
            return d.strftime('%d/%m/%Y')
        except Exception:
            return str(val)
    return _clean_str(val)


# ---------------------------------------------------------------------------
# Parser de estoque (ajuste.xlsx)
# ---------------------------------------------------------------------------

def parse_estoque(path: Path, header_row: int = 3) -> Tuple[List[Dict[str, Any]], date]:
    """
    Lê a planilha de estoque e retorna lista de dicts limpos prontos para inserção
    na tabela `aging_estoque`.
    """
    logger.info("Lendo planilha de estoque: %s (header_row=%d)", path, header_row)

    df = pd.read_excel(path, header=header_row, engine='openpyxl', dtype={0: str})

    # Renomear colunas para nomes internos
    df.rename(columns={
        'Texto breve material': 'Descricao_Material',
        'Estoque disponível':   'Estoque_Disponivel',
        'Data do vencimento':   'Data_Vencimento',
        'Último movimento':     'Ultimo_Movimento',
        'Tipo de estoque':      'Tipo_Estoque',
        'Última entrada dep.':  'Data_Entrada',
        'UMB':                  'Unidade_Medida',
    }, inplace=True)

    # Limpeza obrigatória
    df['Estoque_Disponivel'] = pd.to_numeric(df['Estoque_Disponivel'], errors='coerce').fillna(0.0)

    df['Ultimo_Movimento'] = pd.to_datetime(df['Ultimo_Movimento'], errors='coerce')
    df.dropna(subset=['Ultimo_Movimento'], inplace=True)

    if 'Data_Entrada' in df.columns:
        df['Data_Entrada'] = pd.to_datetime(df['Data_Entrada'], errors='coerce')
    if 'Data_Vencimento' in df.columns:
        df['Data_Vencimento'] = pd.to_datetime(df['Data_Vencimento'], errors='coerce')

    hoje = date.today()
    hoje_dt = pd.to_datetime(hoje)
    df['Dias_Aging'] = (hoje_dt - df['Ultimo_Movimento']).dt.days

    records: List[Dict[str, Any]] = []
    for _, row in df.iterrows():
        raw_mat = _clean_str(row.get('Material'))
        mat_norm = raw_mat.zfill(6) if raw_mat else ''

        records.append({
            'material':               mat_norm,
            'texto_breve_material':   _clean_str(row.get('Descricao_Material')),
            'unidade_medida':         _clean_str(row.get('Unidade_Medida')) or 'KG',
            'lote':                   _normalize_lote(row.get('Lote')),
            'centro':                 _clean_str(row.get('Centro')),
            'deposito':               _normalize_deposito(row.get('Depósito')),
            'tipo_deposito':          _normalize_deposito(row.get('Tipo de depósito')),
            'posicao_deposito':       _clean_str(row.get('Posição no depósito')),
            'estoque_disponivel':     float(row.get('Estoque_Disponivel', 0.0) or 0.0),
            'data_vencimento':        _format_date(row.get('Data_Vencimento')),
            'ultimo_movimento':       _format_date(row.get('Ultimo_Movimento')),
            'tipo_estoque':           _clean_str(row.get('Tipo_Estoque')),
            'ultima_entrada_deposito': _format_date(row.get('Data_Entrada')),
            'dias_aging':             int(row.get('Dias_Aging', 0) or 0),
        })

    logger.info("Planilha de estoque: %d registros processados com sucesso.", len(records))
    return records, hoje
