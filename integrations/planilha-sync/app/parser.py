"""
parser.py — Leitura e processamento das planilhas Excel.
Trata strings vazias, floats .0 (como Centro 600.0 -> 600) e valores NaN do pandas.
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


def _normalize_int_str(val) -> str:
    """Remove sufixo decimal .0 de inteiros lidos como float (ex: 600.0 -> 600)."""
    s = _clean_str(val)
    if not s:
        return ''
    if s.endswith('.0'):
        inteiro = s[:-2]
        if inteiro.lstrip('-').isdigit():
            return inteiro
    return s


def _normalize_lote(val) -> str:
    if pd.isna(val):
        return ''
    return _normalize_int_str(val)


def _normalize_deposito(val) -> str:
    s = _normalize_int_str(val)
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
# Parser de estoque (.txt / .tsv / exportação SAP tabulada)
# ---------------------------------------------------------------------------

def _parse_estoque_txt(path: Path) -> Tuple[List[Dict[str, Any]], date]:
    """
    Lê arquivo texto tabulado exportado do SAP (LX02 / LS24 / WM).
    Processa linha a linha de forma leve e rápida, sem depender de pandas/openpyxl.
    """
    import re

    logger.info("Lendo arquivo de estoque TXT tabulado: %s", path)

    lines: List[str] = []
    for enc in ['latin1', 'utf-8', 'cp1252']:
        try:
            with open(path, 'r', encoding=enc) as f:
                lines = f.readlines()
            break
        except UnicodeDecodeError:
            continue

    if not lines:
        raise ValueError(f"Arquivo vazio ou erro de codificação: {path}")

    # Localiza linha de cabeçalho
    header_idx = -1
    for i, line in enumerate(lines):
        if 'Material' in line and 'Lote' in line:
            header_idx = i
            break

    if header_idx == -1:
        raise ValueError("Cabeçalho com 'Material' e 'Lote' não encontrado no arquivo TXT.")

    header_line = lines[header_idx].strip('\r\n')
    raw_headers = [h.strip() for h in header_line.split('\t')]

    hoje = date.today()

    def parse_float_br(val_str: str) -> float:
        if not val_str:
            return 0.0
        s = val_str.strip().replace('.', '').replace(',', '.')
        try:
            return float(s)
        except ValueError:
            return 0.0

    def parse_date_br(val_str: str) -> Tuple[str, Optional[date]]:
        if not val_str:
            return '', None
        s = val_str.strip()
        m = re.match(r'^(\d{1,2})\.(\d{1,2})\.(\d{4})$', s)
        if m:
            d, mth, y = m.groups()
            return f'{d.zfill(2)}/{mth.zfill(2)}/{y}', date(int(y), int(mth), int(d))
        m2 = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})$', s)
        if m2:
            d, mth, y = m2.groups()
            return f'{d.zfill(2)}/{mth.zfill(2)}/{y}', date(int(y), int(mth), int(d))
        return s, None

    records: List[Dict[str, Any]] = []

    for line in lines[header_idx + 1:]:
        line = line.strip('\r\n')
        if not line or line.startswith('*') or line.strip().startswith('*'):
            continue
        cols = [c.strip() for c in line.split('\t')]

        row_dict: Dict[str, str] = {}
        for h, c in zip(raw_headers, cols):
            if h:
                row_dict[h] = c

        mat = row_dict.get('Material', '')
        # Ignora linhas de totalização do SAP ou sem código numérico
        if not mat or not re.match(r'^\d+$', mat):
            continue

        lote = row_dict.get('Lote', '')
        desc = row_dict.get('Texto breve material', '')
        umb = row_dict.get('UMB', 'KG')
        cen = row_dict.get('Cen.', '600')
        dep = row_dict.get('Dep.', 'PES')
        tp = row_dict.get('Tp.', '999')
        pos = row_dict.get('Posição', row_dict.get('Posiç', row_dict.get('PosiÃ§', '')))
        estq_raw = row_dict.get('Estq.dispon.', row_dict.get('Estoque disponível', '0'))
        venc_raw = row_dict.get('Data venc.', row_dict.get('Data do vencimento', ''))
        mov_raw = row_dict.get('Últ.movim.', row_dict.get('Ã\x9alt.movim.', ''))
        tp_estq = row_dict.get('T', row_dict.get('Tipo de estoque', ''))
        entrd_raw = row_dict.get('Últ.entrd.', row_dict.get('Ã\x9alt.entrd.', ''))

        mat_norm = mat.strip().zfill(6)
        lote_norm = re.sub(r'\.0$', '', lote).strip()
        cen_norm = re.sub(r'\.0$', '', cen).strip()

        dep_norm = dep.strip()
        if dep_norm == '922':
            dep_norm = 'TR-ZONE'

        tipo_dep_norm = tp.strip()
        if tipo_dep_norm == '922':
            tipo_dep_norm = 'TR-ZONE'

        estq_disp = parse_float_br(estq_raw)
        venc_str, _ = parse_date_br(venc_raw)
        mov_str, mov_date = parse_date_br(mov_raw)
        entrd_str, _ = parse_date_br(entrd_raw)

        dias_aging = (hoje - mov_date).days if mov_date else 0

        records.append({
            'material': mat_norm,
            'texto_breve_material': desc,
            'unidade_medida': umb or 'KG',
            'lote': lote_norm,
            'centro': cen_norm,
            'deposito': dep_norm,
            'tipo_deposito': tipo_dep_norm,
            'posicao_deposito': pos,
            'estoque_disponivel': estq_disp,
            'data_vencimento': venc_str,
            'ultimo_movimento': mov_str,
            'tipo_estoque': tp_estq,
            'ultima_entrada_deposito': entrd_str,
            'dias_aging': dias_aging,
        })

    logger.info("Arquivo TXT de estoque: %d registros processados com sucesso.", len(records))
    return records, hoje


# ---------------------------------------------------------------------------
# Parser de estoque (ajuste.xlsx / dados.txt)
# ---------------------------------------------------------------------------

def parse_estoque(path: Path, header_row: int = 3) -> Tuple[List[Dict[str, Any]], date]:
    """
    Lê a planilha de estoque (.xlsx, .xls) ou arquivo texto tabulado (.txt, .tsv)
    e retorna lista de dicts limpos prontos para inserção na tabela `aging_estoque`.
    """
    suffix = path.suffix.lower()
    if suffix in ('.txt', '.tsv', '.csv'):
        return _parse_estoque_txt(path)

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
        raw_mat = _normalize_int_str(row.get('Material'))
        mat_norm = raw_mat.zfill(6) if raw_mat else ''

        records.append({
            'material':               mat_norm,
            'texto_breve_material':   _clean_str(row.get('Descricao_Material')),
            'unidade_medida':         _clean_str(row.get('Unidade_Medida')) or 'KG',
            'lote':                   _normalize_lote(row.get('Lote')),
            'centro':                 _normalize_int_str(row.get('Centro')),
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
