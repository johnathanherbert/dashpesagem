"""
parser.py — Leitura e processamento das planilhas Excel.
Trata strings vazias, floats .0 (como Centro 600.0 -> 600) e valores NaN do pandas.
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from pathlib import Path
from typing import List, Dict, Any, Tuple

try:
    import pandas as pd
    _HAS_PANDAS = True
except ImportError:
    pd = None
    _HAS_PANDAS = False

logger = logging.getLogger(__name__)


def _clean_str(val) -> str:
    """Limpa valor para string pura, tratando NaN, None e vazios."""
    if val is None:
        return ''
    if _HAS_PANDAS and pd is not None and pd.isna(val):
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
    return _normalize_int_str(val)


def _normalize_deposito(val) -> str:
    s = _normalize_int_str(val)
    if not s:
        return ''
    _MAP = {'922': 'TR-ZONE', 'PES': 'PES', 'DEP': 'DEP', '999': '999'}
    return _MAP.get(s, s)


def _format_date(val) -> str:
    """Converte serial Excel ou datetime/Timestamp para DD/MM/YYYY."""
    if val is None:
        return ''
    if isinstance(val, datetime):
        try:
            return val.strftime('%d/%m/%Y')
        except Exception:
            return ''
    if _HAS_PANDAS and pd is not None and isinstance(val, pd.Timestamp):
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

    # Ignora arquivos de documentação, configs ou logs
    fname_lower = path.name.lower()
    if fname_lower.startswith(('readme', 'leia-me', 'leia_me', 'log', '_', 'vba_config', 'config')):
        logger.debug("Ignorando arquivo de texto não-estoque: %s", path.name)
        return [], date.today()

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

        mat = row_dict.get('Material', row_dict.get('Código', row_dict.get('Codigo', '')))
        # Ignora linhas de totalização do SAP ou sem código numérico
        if not mat or not re.match(r'^\d+$', mat):
            continue

        lote = row_dict.get('Lote', '')
        desc = row_dict.get('Texto breve material', row_dict.get('Texto breve', row_dict.get('Descrição', '')))
        umb = row_dict.get('UMB', row_dict.get('Unidade', 'KG'))
        cen = row_dict.get('Cen.', row_dict.get('Centro', '600'))
        dep = row_dict.get('Dep.', row_dict.get('Depósito', row_dict.get('Deposito', 'PES')))
        tp = row_dict.get('Tp.', row_dict.get('Tipo de depósito', row_dict.get('Tipo depósito', '999')))
        pos = ''
        for key, val in row_dict.items():
            k_lower = key.lower().strip()
            if k_lower.startswith('pos') or 'posi' in k_lower or 'posdep' in k_lower or k_lower in ('pos', 'pos.', 'posiç', 'posiã§'):
                candidate = _clean_str(val)
                if candidate:
                    pos = candidate
                    break
        if not pos:
            pos = row_dict.get('PosDepósit', row_dict.get('PosDepÃ³sit', row_dict.get('PosDep', row_dict.get('Posição no depósito', row_dict.get('Posição', row_dict.get('Posiç', row_dict.get('PosiÃ§', row_dict.get('Pos.', row_dict.get('Pos', '')))))))))

        mat_norm = mat.strip().zfill(6)
        lote_norm = re.sub(r'\.0$', '', lote).strip()
        cen_norm = re.sub(r'\.0$', '', cen).strip()

        dep_norm = dep.strip()
        if dep_norm == '922':
            dep_norm = 'TR-ZONE'

        tipo_dep_norm = tp.strip()
        if tipo_dep_norm == '922':
            tipo_dep_norm = 'TR-ZONE'

        if not pos:
            if tipo_dep_norm == 'PES':
                pos = 'PESAGEM'
            elif tipo_dep_norm == 'DEP':
                pos = 'DEVOLUCAO'
            elif tipo_dep_norm in ('TR-ZONE', '922'):
                pos = 'TR-ZONE'
            elif tipo_dep_norm == '999':
                pos = 'AJUSTE'

        estq_raw = row_dict.get('Estq.dispon.', row_dict.get('Estoque disponível', row_dict.get('Estoque disponivel', row_dict.get('Estq. dispon.', ''))))
        if not estq_raw:
            for k, v in row_dict.items():
                if 'estq' in k.lower() or 'estoque' in k.lower():
                    estq_raw = v
                    break
        venc_raw = row_dict.get('Data venc.', row_dict.get('Data do vencimento', row_dict.get('Data vencimento', '')))
        mov_raw = row_dict.get('Últ.movim.', row_dict.get('Ã\x9Alt.movim.', row_dict.get('Ãšlt.movim.', row_dict.get('Último movimento', row_dict.get('Ultimo movimento', '')))))
        tp_estq = row_dict.get('T', row_dict.get('Tipo de estoque', ''))
        entrd_raw = row_dict.get('Últ.entrd.', row_dict.get('Ã\x9Alt.entrd.', row_dict.get('Ãšlt.entrd.', row_dict.get('Última entrada dep.', ''))))

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

    # Tenta ler primeiras linhas sem header para localizar a linha real de cabeçalho dinamicamente
    header_idx = header_row
    try:
        preview_df = pd.read_excel(path, header=None, nrows=10, engine='openpyxl', dtype=str)
        for r_idx, row_vals in preview_df.iterrows():
            row_str = ' '.join(str(v).lower() for v in row_vals if pd.notna(v))
            if 'material' in row_str and ('lote' in row_str or 'texto' in row_str or 'dep' in row_str):
                header_idx = int(r_idx)
                break
    except Exception as e:
        logger.debug("Falha ao detectar header dinâmico: %s. Usando default %d", e, header_row)

    df = pd.read_excel(path, header=header_idx, engine='openpyxl', dtype={0: str})

    # Renomear colunas para nomes internos
    df.rename(columns={
        'Texto breve material': 'Descricao_Material',
        'Texto breve':          'Descricao_Material',
        'Descrição':            'Descricao_Material',
        'Estoque disponível':   'Estoque_Disponivel',
        'Estoque disponivel':   'Estoque_Disponivel',
        'Estq.dispon.':         'Estoque_Disponivel',
        'Data do vencimento':   'Data_Vencimento',
        'Data vencimento':      'Data_Vencimento',
        'Data venc.':           'Data_Vencimento',
        'Último movimento':     'Ultimo_Movimento',
        'Ultimo movimento':     'Ultimo_Movimento',
        'Últ.movim.':           'Ultimo_Movimento',
        'Tipo de estoque':      'Tipo_Estoque',
        'Tipo estoque':         'Tipo_Estoque',
        'T':                    'Tipo_Estoque',
        'Última entrada dep.':  'Data_Entrada',
        'Ultima entrada dep.':  'Data_Entrada',
        'Últ.entrd.':           'Data_Entrada',
        'UMB':                  'Unidade_Medida',
        'Unidade':              'Unidade_Medida',
        'Posição no depósito':  'Posicao_Deposito',
        'Posição':              'Posicao_Deposito',
        'Posicao':              'Posicao_Deposito',
        'Posiç':                'Posicao_Deposito',
        'PosDepósit':           'Posicao_Deposito',
        'PosDepÃ³sit':          'Posicao_Deposito',
        'PosDep':               'Posicao_Deposito',
        'Pos.':                 'Posicao_Deposito',
        'Pos':                  'Posicao_Deposito',
        'Tipo de depósito':     'Tipo_Deposito',
        'Tipo depósito':        'Tipo_Deposito',
        'Tp.':                  'Tipo_Deposito',
        'Depósito':             'Deposito',
        'Dep.':                 'Deposito',
        'Centro':               'Centro',
        'Cen.':                 'Centro',
    }, inplace=True)

    # Limpeza obrigatória
    df['Estoque_Disponivel'] = pd.to_numeric(df.get('Estoque_Disponivel', 0.0), errors='coerce').fillna(0.0)

    if 'Ultimo_Movimento' in df.columns:
        df['Ultimo_Movimento'] = pd.to_datetime(df['Ultimo_Movimento'], errors='coerce')
        df.dropna(subset=['Ultimo_Movimento'], inplace=True)

    if 'Data_Entrada' in df.columns:
        df['Data_Entrada'] = pd.to_datetime(df['Data_Entrada'], errors='coerce')
    if 'Data_Vencimento' in df.columns:
        df['Data_Vencimento'] = pd.to_datetime(df['Data_Vencimento'], errors='coerce')

    hoje = date.today()
    hoje_dt = pd.to_datetime(hoje)
    if 'Ultimo_Movimento' in df.columns:
        df['Dias_Aging'] = (hoje_dt - df['Ultimo_Movimento']).dt.days
    else:
        df['Dias_Aging'] = 0

    records: List[Dict[str, Any]] = []
    for _, row in df.iterrows():
        raw_mat = _normalize_int_str(row.get('Material'))
        mat_norm = raw_mat.zfill(6) if raw_mat else ''
        if not mat_norm or not mat_norm.isdigit():
            continue

        pos_clean = ''
        for col_name in row.index:
            c_str = str(col_name).strip().lower()
            if c_str.startswith('pos') or 'posdep' in c_str or 'posi' in c_str or c_str in ('pos', 'pos.', 'posiç', 'posiã§'):
                val_candidate = _clean_str(row.get(col_name))
                if val_candidate:
                    pos_clean = val_candidate
                    break
        if not pos_clean:
            pos_clean = _clean_str(row.get('Posicao_Deposito', row.get('PosDepósit', row.get('PosDepÃ³sit', row.get('PosDep', row.get('Posição no depósito', row.get('Posição', row.get('Posiç', ''))))))))

        dep_val = _normalize_deposito(row.get('Deposito', row.get('Depósito', 'PES')))
        tp_val = _normalize_deposito(row.get('Tipo_Deposito', row.get('Tipo de depósito', '999')))

        if not pos_clean:
            if tp_val == 'PES':
                pos_clean = 'PESAGEM'
            elif tp_val == 'DEP' or dep_val == 'DEP':
                pos_clean = 'DEVOLUCAO'
            elif tp_val in ('TR-ZONE', '922'):
                pos_clean = 'TR-ZONE'
            elif tp_val == '999':
                pos_clean = 'AJUSTE'

        records.append({
            'material':               mat_norm,
            'texto_breve_material':   _clean_str(row.get('Descricao_Material')),
            'unidade_medida':         _clean_str(row.get('Unidade_Medida')) or 'KG',
            'lote':                   _normalize_lote(row.get('Lote')),
            'centro':                 _normalize_int_str(row.get('Centro', '600')),
            'deposito':               dep_val,
            'tipo_deposito':          tp_val,
            'posicao_deposito':       pos_clean,
            'estoque_disponivel':     float(row.get('Estoque_Disponivel', 0.0) or 0.0),
            'data_vencimento':        _format_date(row.get('Data_Vencimento')),
            'ultimo_movimento':       _format_date(row.get('Ultimo_Movimento')),
            'tipo_estoque':           _clean_str(row.get('Tipo_Estoque')),
            'ultima_entrada_deposito': _format_date(row.get('Data_Entrada')),
            'dias_aging':             int(row.get('Dias_Aging', 0) or 0),
        })

    logger.info("Planilha de estoque: %d registros processados com sucesso.", len(records))
    return records, hoje


# ---------------------------------------------------------------------------
# Parser de valor unitário
# ---------------------------------------------------------------------------

def parse_valor_unitario(path: Path) -> List[Dict[str, Any]]:
    """Lê a planilha de valor unitário e retorna lista para `material_valores`."""
    logger.info("Lendo planilha de valor unitário: %s", path)
    df = pd.read_excel(path, header=0, dtype=str)

    # Normalizar nomes de colunas
    col_map = {}
    for col in df.columns:
        c_str = str(col).strip().lower()
        if 'material' in c_str or 'código' in c_str or 'codigo' in c_str:
            col_map[col] = 'Material'
        elif 'valor' in c_str or 'unitário' in c_str or 'unitario' in c_str or 'preco' in c_str or 'preço' in c_str:
            col_map[col] = 'Valor unitário'

    df.rename(columns=col_map, inplace=True)

    if 'Material' not in df.columns or 'Valor unitário' not in df.columns:
        logger.warning("Planilha de valor unitário sem colunas esperadas: %s", df.columns.tolist())
        return []

    records = []
    for _, row in df.iterrows():
        raw_mat = _normalize_int_str(row.get('Material'))
        if not raw_mat or not raw_mat.isdigit():
            continue
        mat = raw_mat.zfill(6)
        val_raw = str(row.get('Valor unitário', '0')).replace('.', '').replace(',', '.')
        try:
            val = float(val_raw)
        except ValueError:
            val = 0.0
        if val > 0:
            records.append({'material': mat, 'valor_unitario': val})

    logger.info("Valor unitário: %d registros processados.", len(records))
    return records


# ---------------------------------------------------------------------------
# Parser de remessas
# ---------------------------------------------------------------------------

def parse_remessas(path: Path, header_row: int = 3) -> List[Dict[str, Any]]:
    """Lê a planilha de remessas e retorna lista para a tabela `remessas`."""
    logger.info("Lendo planilha de remessas: %s (header_row=%d)", path, header_row)
    df = pd.read_excel(path, header=header_row, engine='openpyxl', dtype=str)

    records: List[Dict[str, Any]] = []
    for _, row in df.iterrows():
        numero = _clean_str(row.get('Remessa', row.get('Nº Remessa', row.get('Numero', ''))))
        if not numero:
            continue

        qtd_raw = str(row.get('Quantidade', row.get('Qtd', '0'))).replace('.', '').replace(',', '.')
        try:
            qtd = float(qtd_raw)
        except ValueError:
            qtd = 0.0
        if qtd == 0:
            continue

        peso_raw = str(row.get('Peso Total', row.get('Peso', '0'))).replace('.', '').replace(',', '.')
        try:
            peso = float(peso_raw)
        except ValueError:
            peso = 0.0

        raw_mat = _normalize_int_str(row.get('Material', ''))
        mat = raw_mat.zfill(6) if raw_mat else ''

        records.append({
            'numero_remessa':       numero,
            'data_picking':         _format_date(row.get('Data Picking', row.get('Data', ''))),
            'peso_total_remessa':   peso,
            'item':                 _clean_str(row.get('Item', row.get('Posição', ''))),
            'data_disponibilidade': _format_date(row.get('Data disponib.', row.get('Data Disponib', ''))),
            'quantidade':           qtd,
            'unidade_medida':       _clean_str(row.get('UMB', row.get('UN', 'KG'))) or 'KG',
            'material':             mat,
            'centro':               _normalize_int_str(row.get('Centro', '')),
            'deposito':             _normalize_deposito(row.get('Depósito', row.get('Deposito', ''))),
            'descricao_material':   _clean_str(row.get('Texto breve material', row.get('Descrição', ''))),
        })

    logger.info("Remessas: %d registros processados.", len(records))
    return records
