"""
parser.py — Leitura e processamento das planilhas Excel.
Reutiliza a mesma lógica de data_processing.py do aging_flask.
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

import pandas as pd

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers de normalização (espelho de aging_flask/app/data_processing.py)
# ---------------------------------------------------------------------------

def _normalize_lote(val) -> str:
    if pd.isna(val):
        return ''
    lote = str(val).strip()
    if not lote or lote.lower() == 'nan':
        return ''
    if lote.endswith('.0'):
        inteiro = lote[:-2]
        if inteiro.isdigit():
            return inteiro
    return lote


def _normalize_deposito(val) -> str:
    s = str(val or '').strip()
    _MAP = {'922': 'TR-ZONE', 'PES': 'PES', 'DEP': 'DEP', '999': '999'}
    return _MAP.get(s, s)


def _format_date(val) -> str:
    """Converte serial Excel ou datetime/Timestamp para DD/MM/YYYY."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return ''
    if isinstance(val, (datetime, pd.Timestamp)):
        try:
            return val.strftime('%d/%m/%Y')
        except Exception:
            return ''
    if isinstance(val, str):
        val = val.strip()
        if not val or val.lower() == 'nat':
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
    return str(val)


# ---------------------------------------------------------------------------
# Parser de estoque (ajuste.xlsx)
# ---------------------------------------------------------------------------

def parse_estoque(path: Path, header_row: int = 3) -> Tuple[List[Dict[str, Any]], date]:
    """
    Lê a planilha de estoque e retorna lista de dicts prontos para inserção
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
    df['Estoque_Disponivel'] = pd.to_numeric(df['Estoque_Disponivel'], errors='coerce')
    df.dropna(subset=['Estoque_Disponivel'], inplace=True)

    df['Ultimo_Movimento'] = pd.to_datetime(df['Ultimo_Movimento'], errors='coerce')
    df.dropna(subset=['Ultimo_Movimento'], inplace=True)

    if 'Data_Entrada' in df.columns:
        df['Data_Entrada'] = pd.to_datetime(df['Data_Entrada'], errors='coerce')
    if 'Data_Vencimento' in df.columns:
        df['Data_Vencimento'] = pd.to_datetime(df['Data_Vencimento'], errors='coerce')

    if 'Material' in df.columns:
        df['Material'] = df['Material'].astype(str).str.zfill(6)
    if 'Lote' in df.columns:
        df['Lote'] = df['Lote'].apply(_normalize_lote)
    if 'Depósito' in df.columns:
        df['Depósito'] = df['Depósito'].astype(str).map(_normalize_deposito)
    if 'Tipo de depósito' in df.columns:
        df['Tipo de depósito'] = df['Tipo de depósito'].astype(str).map(_normalize_deposito)

    hoje = date.today()
    hoje_dt = pd.to_datetime(hoje)
    df['Dias_Aging'] = (hoje_dt - df['Ultimo_Movimento']).dt.days

    records: List[Dict[str, Any]] = []
    for _, row in df.iterrows():
        records.append({
            'material':               str(row.get('Material', '') or ''),
            'texto_breve_material':   str(row.get('Descricao_Material', '') or ''),
            'unidade_medida':         str(row.get('Unidade_Medida', 'KG') or 'KG'),
            'lote':                   str(row.get('Lote', '') or ''),
            'centro':                 str(row.get('Centro', '') or ''),
            'deposito':               str(row.get('Depósito', '') or ''),
            'tipo_deposito':          str(row.get('Tipo de depósito', '') or ''),
            'posicao_deposito':       str(row.get('Posição no depósito', '') or ''),
            'estoque_disponivel':     float(row.get('Estoque_Disponivel', 0) or 0),
            'data_vencimento':        _format_date(row.get('Data_Vencimento')),
            'ultimo_movimento':       _format_date(row.get('Ultimo_Movimento')),
            'tipo_estoque':           str(row.get('Tipo_Estoque', '') or ''),
            'ultima_entrada_deposito': _format_date(row.get('Data_Entrada')),
            'dias_aging':             int(row.get('Dias_Aging', 0) or 0),
        })

    logger.info("Planilha de estoque: %d registros processados.", len(records))
    return records, hoje


# ---------------------------------------------------------------------------
# Parser de valor unitário
# ---------------------------------------------------------------------------

def parse_valor_unitario(path: Path) -> List[Dict[str, Any]]:
    """Lê a planilha de valor unitário e retorna lista para `material_valores`."""
    logger.info("Lendo planilha de valor unitário: %s", path)
    df = pd.read_excel(path, header=0, dtype={'Material': str})

    if 'Material' not in df.columns or 'Valor unitário' not in df.columns:
        logger.warning("Planilha de valor unitário sem colunas esperadas: %s", df.columns.tolist())
        return []

    df['Material'] = df['Material'].astype(str).str.zfill(6)
    df['Valor unitário'] = pd.to_numeric(df['Valor unitário'], errors='coerce').fillna(0.0)
    df = df[df['Valor unitário'] > 0]

    records = [
        {'material': row['Material'], 'valor_unitario': float(row['Valor unitário'])}
        for _, row in df.iterrows()
    ]
    logger.info("Valor unitário: %d registros processados.", len(records))
    return records


# ---------------------------------------------------------------------------
# Parser de remessas
# ---------------------------------------------------------------------------

def parse_remessas(path: Path, header_row: int = 3) -> List[Dict[str, Any]]:
    """Lê a planilha de remessas e retorna lista para a tabela `remessas`."""
    logger.info("Lendo planilha de remessas: %s (header_row=%d)", path, header_row)
    df = pd.read_excel(path, header=header_row, engine='openpyxl', dtype={0: str})

    records: List[Dict[str, Any]] = []
    for _, row in df.iterrows():
        numero = str(row.get('Remessa', row.get('Nº Remessa', row.get('Numero', ''))) or '')
        if not numero or numero.lower() == 'nan':
            continue

        qtd_raw = row.get('Quantidade', row.get('Qtd', 0))
        qtd = float(qtd_raw) if pd.notna(qtd_raw) else 0.0
        if qtd == 0:
            continue

        records.append({
            'numero_remessa':       numero,
            'data_picking':         _format_date(row.get('Data Picking', row.get('Data', ''))),
            'peso_total_remessa':   float(row.get('Peso Total', row.get('Peso', 0)) or 0),
            'item':                 str(row.get('Item', row.get('Posição', '')) or ''),
            'data_disponibilidade': _format_date(row.get('Data disponib.', row.get('Data Disponib', ''))),
            'quantidade':           qtd,
            'unidade_medida':       str(row.get('UMB', row.get('UN', 'KG')) or 'KG'),
            'material':             str(row.get('Material', '') or '').zfill(6),
            'centro':               str(row.get('Centro', '') or ''),
            'deposito':             str(row.get('Depósito', row.get('Deposito', '')) or ''),
            'descricao_material':   str(row.get('Texto breve material', row.get('Descrição', '')) or ''),
        })

    logger.info("Remessas: %d registros processados.", len(records))
    return records
