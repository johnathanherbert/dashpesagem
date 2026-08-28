"""
config.py — Configurações centrais do Planilha Sync.
"""

import os
import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent

LEGACY_DATABASE_DIR = Path(os.environ.get(
    'DATABASE_DIR',
    r"C:\Users\j0038150\OneDrive - EMS S A\Aplicativos\Microsoft Power Query\Uploaded Files"
))

DEFAULT_ESTOQUE_FILE_NAME = 'ajuste.xlsx'


def _runtime_base_dir() -> Path:
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).resolve().parent
    return PROJECT_DIR


def get_search_directories() -> list[Path]:
    """Retorna lista de diretórios onde procurar planilhas, em ordem de preferência."""
    dirs: list[Path] = []
    
    # 1. Variável de ambiente explícita
    env_dir = os.environ.get('DATABASE_DIR')
    if env_dir:
        dirs.append(Path(env_dir).expanduser())

    # 2. Pasta local database/ ao lado do executável
    dirs.append(_runtime_base_dir() / 'database')

    # 3. Pasta OneDrive corporativa padrão
    if LEGACY_DATABASE_DIR not in dirs:
        dirs.append(LEGACY_DATABASE_DIR)

    # 4. Pastas de desenvolvimento
    dev_db = PROJECT_DIR / 'database'
    if dev_db not in dirs:
        dirs.append(dev_db)

    return dirs


def _resolve_database_dir() -> Path:
    # Retorna o primeiro diretório existente que contenha ajuste.xlsx ou o diretório local database
    search_dirs = get_search_directories()
    for d in search_dirs:
        try:
            if d.exists() and (d / DEFAULT_ESTOQUE_FILE_NAME).exists():
                return d
        except Exception:
            pass
            
    # Se nenhum tiver ajuste.xlsx, retorna a pasta database local ao lado do exe
    return _runtime_base_dir() / 'database'


DATABASE_DIR = _resolve_database_dir()

# ------------------------------------------------------------------
# API do dashpesagem (via Cloudflare)
# ------------------------------------------------------------------
API_BASE_URL  = os.environ.get('API_BASE_URL',  'https://dash.agilework.app.br')
API_KEY       = os.environ.get('API_KEY',        '')           # X-Sync-Key header
API_TIMEOUT   = int(os.environ.get('API_TIMEOUT',   '60'))    # segundos
API_CHUNK_SIZE = int(os.environ.get('API_CHUNK_SIZE', '500')) # registros por POST

# ------------------------------------------------------------------
# Configurações do watcher
# ------------------------------------------------------------------
POLL_INTERVAL_SECONDS = int(os.environ.get('POLL_INTERVAL_SECONDS', '15'))

ESTOQUE_FILE_PATTERN  = os.environ.get('ESTOQUE_FILE_PATTERN',  'ajuste.xlsx')
VALOR_UNIT_PATTERN    = os.environ.get('VALOR_UNIT_PATTERN',    '*unit*.xlsx')
REMESSAS_FILE_PATTERN = os.environ.get('REMESSAS_FILE_PATTERN', '*remessa*.xlsx')

ESTOQUE_HEADER_ROW    = int(os.environ.get('ESTOQUE_HEADER_ROW',    '3'))
VALOR_UNIT_HEADER_ROW = int(os.environ.get('VALOR_UNIT_HEADER_ROW', '0'))
REMESSAS_HEADER_ROW   = int(os.environ.get('REMESSAS_HEADER_ROW',   '3'))

LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
