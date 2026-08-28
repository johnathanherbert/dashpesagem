"""
launcher.py — Ponto de entrada do Planilha Sync.

Comportamento:
  1. Configura logging (console + arquivo rotativo)
  2. Inicializa pool de conexão PostgreSQL
  3. Descobre planilhas na pasta DATABASE_DIR
  4. Executa sincronização inicial imediata
  5. Inicia FileWatcher para detectar mudanças futuras
  6. Exibe ícone na bandeja do sistema (se disponível)
  7. Aguarda encerramento via bandeja ou Ctrl+C

Compatível com PyInstaller (frozen) e execução direta (python launcher.py).
"""

import os
import sys
import logging
import logging.handlers
import threading
import tempfile
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# PyInstaller: ajustar BASE_DIR e sys.path
# ---------------------------------------------------------------------------
if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys._MEIPASS)
else:
    BASE_DIR = Path(__file__).resolve().parent

os.chdir(BASE_DIR)
sys.path.insert(0, str(BASE_DIR))

# Carrega variáveis de ambiente do arquivo .env (se existir)
try:
    from dotenv import load_dotenv as _load_dotenv
    _env_candidates = [
        Path(sys.executable).parent / '.env' if getattr(sys, 'frozen', False) else None,
        BASE_DIR / '.env',
        BASE_DIR.parent / '.env',
    ]
    for _env_path in _env_candidates:
        if _env_path and _env_path.exists():
            _load_dotenv(_env_path, override=False)
            break
except ImportError:
    pass  # python-dotenv opcional

# Compat pyarrow (mesmo truque do aging_flask)
import types
try:
    import pyarrow as _pa
    if not hasattr(_pa, '__version__') or not isinstance(getattr(_pa, '__version__', None), str):
        _pa.__version__ = '0.0.0'
except Exception:
    _dummy = types.ModuleType('pyarrow')
    _dummy.__version__ = '0.0.0'
    sys.modules['pyarrow'] = _dummy

# ---------------------------------------------------------------------------
# Imports internos (após ajuste de path)
# ---------------------------------------------------------------------------
from app.config import (
    DATABASE_DIR,
    DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME,
    POLL_INTERVAL_SECONDS,
    ESTOQUE_FILE_PATTERN, VALOR_UNIT_PATTERN, REMESSAS_FILE_PATTERN,
    ESTOQUE_HEADER_ROW, VALOR_UNIT_HEADER_ROW, REMESSAS_HEADER_ROW,
    LOG_LEVEL,
)
from app import db, sync
from app.watcher import FileWatcher


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOG_DIR = (Path(sys.executable).parent if getattr(sys, 'frozen', False) else BASE_DIR) / 'logs'
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / 'planilha_sync.log'

_shutdown_event = threading.Event()


def _setup_logging() -> None:
    level = getattr(logging, LOG_LEVEL.upper(), logging.INFO)
    root = logging.getLogger()
    root.setLevel(level)

    fmt = logging.Formatter(
        '[%(asctime)s] %(levelname)-8s %(name)s — %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
    )

    # Console
    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(fmt)
    root.addHandler(ch)

    # Arquivo rotativo (5 MB × 5 backups)
    fh = logging.handlers.RotatingFileHandler(
        LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=5, encoding='utf-8'
    )
    fh.setFormatter(fmt)
    root.addHandler(fh)


logger = None  # definido após _setup_logging()


# ---------------------------------------------------------------------------
# Descoberta de planilhas
# ---------------------------------------------------------------------------

def _find_files(directory: Path, pattern: str) -> list[Path]:
    """Retorna todos os arquivos que batem com o padrão dentro de directory."""
    if not directory.exists():
        return []
    return sorted(directory.glob(pattern))


# ---------------------------------------------------------------------------
# Callbacks de sincronização (usados pelo watcher)
# ---------------------------------------------------------------------------

def _on_estoque_change(path: Path, kind: str) -> bool:
    return sync.sync_estoque(path, kind, header_row=ESTOQUE_HEADER_ROW)


def _on_valor_unitario_change(path: Path, kind: str) -> bool:
    return sync.sync_valor_unitario(path, kind)


def _on_remessas_change(path: Path, kind: str) -> bool:
    return sync.sync_remessas(path, kind, header_row=REMESSAS_HEADER_ROW)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    global logger
    _setup_logging()
    logger = logging.getLogger('launcher')

    logger.info("=" * 60)
    logger.info("  Planilha Sync — dashpesagem")
    logger.info("  DATABASE_DIR : %s", DATABASE_DIR)
    logger.info("  PostgreSQL   : %s@%s:%s/%s", DB_USER, DB_HOST, DB_PORT, DB_NAME)
    logger.info("  Intervalo    : %ss", POLL_INTERVAL_SECONDS)
    logger.info("  Log          : %s", LOG_FILE)
    logger.info("=" * 60)

    # --- Conexão com banco ---
    try:
        db.init_pool(DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)
    except Exception as exc:
        logger.critical("Falha ao inicializar pool de conexão: %s", exc)
        sys.exit(1)

    if not db.test_connection():
        logger.critical("Não foi possível conectar ao PostgreSQL. Verifique as configurações.")
        sys.exit(1)

    logger.info("Conexão com PostgreSQL OK.")

    # --- Configurar watcher ---
    watcher = FileWatcher(poll_interval=float(POLL_INTERVAL_SECONDS))

    registered_count = 0

    # Estoque (ajuste.xlsx)
    estoque_files = _find_files(DATABASE_DIR, ESTOQUE_FILE_PATTERN)
    for f in estoque_files:
        watcher.register(f, 'estoque', _on_estoque_change)
        registered_count += 1

    # Valor unitário
    valor_unit_files = _find_files(DATABASE_DIR, VALOR_UNIT_PATTERN)
    for f in valor_unit_files:
        watcher.register(f, 'valor_unitario', _on_valor_unitario_change)
        registered_count += 1

    # Remessas
    remessas_files = _find_files(DATABASE_DIR, REMESSAS_FILE_PATTERN)
    for f in remessas_files:
        watcher.register(f, 'remessas', _on_remessas_change)
        registered_count += 1

    if registered_count == 0:
        logger.warning(
            "Nenhuma planilha encontrada em '%s'. "
            "Verifique DATABASE_DIR e os padrões de arquivo. "
            "O watcher aguardará os arquivos aparecerem.",
            DATABASE_DIR,
        )
    else:
        logger.info("%d planilha(s) registrada(s) para monitoramento.", registered_count)

    # --- Sincronização inicial imediata ---
    logger.info("Executando sincronização inicial...")
    watcher.force_sync_all()

    # --- Iniciar watcher ---
    watcher.start()

    # --- Bandeja do sistema ---
    def _force_sync_all():
        logger.info("Sincronização manual solicitada via bandeja.")
        watcher.force_sync_all()

    def _shutdown():
        logger.info("Encerrando por solicitação do usuário...")
        _shutdown_event.set()

    try:
        from app.tray import start_tray
        start_tray(
            shutdown_callback=_shutdown,
            force_sync_callback=_force_sync_all,
            log_path=str(LOG_FILE),
        )
    except Exception as exc:
        logger.warning("Não foi possível iniciar bandeja: %s", exc)

    # --- Loop principal ---
    logger.info("Serviço rodando em background. Ctrl+C ou bandeja para encerrar.")
    try:
        while not _shutdown_event.wait(timeout=1):
            pass
    except KeyboardInterrupt:
        logger.info("Interrompido via Ctrl+C.")
    finally:
        watcher.stop()
        logger.info("Planilha Sync encerrado.")
        os._exit(0)


if __name__ == '__main__':
    main()
