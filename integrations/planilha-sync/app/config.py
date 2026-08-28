"""
config.py — Configurações centrais do Planilha Sync.
Resolve diretório das planilhas tanto em modo dev quanto em modo frozen (PyInstaller).
"""

import os
import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent

# Diretório padrão de planilhas (pode ser sobrescrito via env DATABASE_DIR)
LEGACY_DATABASE_DIR = Path(os.environ.get(
    'DATABASE_DIR',
    r"C:\Users\j0038150\OneDrive - EMS S A\Aplicativos\Microsoft Power Query\Uploaded Files"
))

DEFAULT_ESTOQUE_FILE_NAME = 'ajuste.xlsx'


def _runtime_base_dir() -> Path:
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).resolve().parent
    return PROJECT_DIR


def _resolve_database_dir() -> Path:
    env_dir = os.environ.get('DATABASE_DIR')
    if env_dir:
        return Path(env_dir).expanduser()
    if getattr(sys, 'frozen', False):
        return _runtime_base_dir() / 'database'
    # Em modo dev: procura a pasta database dentro do projeto
    candidates = [
        PROJECT_DIR / 'database',
        PROJECT_DIR / 'app' / 'database',
        LEGACY_DATABASE_DIR,
    ]
    for c in candidates:
        if c.exists() and c.is_dir():
            return c
    return LEGACY_DATABASE_DIR


DATABASE_DIR = _resolve_database_dir()

# ------------------------------------------------------------------
# Conexão com PostgreSQL do dashpesagem
# ------------------------------------------------------------------
DB_HOST     = os.environ.get('POSTGRES_HOST',     '192.168.15.16')
DB_PORT     = int(os.environ.get('POSTGRES_PORT', '5432'))
DB_USER     = os.environ.get('POSTGRES_USER',     'postgres')
DB_PASSWORD = os.environ.get('POSTGRES_PASSWORD', '07Huk0594@#$')
DB_NAME     = os.environ.get('POSTGRES_DB',       'postgres')

# ------------------------------------------------------------------
# Configurações do watcher
# ------------------------------------------------------------------
# Intervalo (segundos) entre verificações de mudança nos arquivos
POLL_INTERVAL_SECONDS = int(os.environ.get('POLL_INTERVAL_SECONDS', '30'))

# Padrão de arquivos de estoque a monitorar
ESTOQUE_FILE_PATTERN   = os.environ.get('ESTOQUE_FILE_PATTERN',   'ajuste.xlsx')
VALOR_UNIT_PATTERN     = os.environ.get('VALOR_UNIT_PATTERN',     '*unit*.xlsx')
REMESSAS_FILE_PATTERN  = os.environ.get('REMESSAS_FILE_PATTERN',  '*remessa*.xlsx')

# Linha de cabeçalho (0-indexed) dentro da planilha de estoque
ESTOQUE_HEADER_ROW   = int(os.environ.get('ESTOQUE_HEADER_ROW',   '3'))
VALOR_UNIT_HEADER_ROW = int(os.environ.get('VALOR_UNIT_HEADER_ROW', '0'))
REMESSAS_HEADER_ROW  = int(os.environ.get('REMESSAS_HEADER_ROW',  '3'))

# Nível de log (DEBUG, INFO, WARNING, ERROR)
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
