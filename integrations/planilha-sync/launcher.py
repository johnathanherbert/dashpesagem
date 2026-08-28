"""
launcher.py — Ponto de entrada do Planilha Sync (standalone .exe).

Tudo hardcoded — sem necessidade de .env ou configuração manual.
Conecta em https://dash.agilework.app.br via Cloudflare automaticamente.
"""

import os
import sys
import subprocess
import logging
import logging.handlers
import threading
import tempfile
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# PyInstaller: BASE_DIR (arquivos bundled) vs EXE_DIR (pasta do .exe)
# ---------------------------------------------------------------------------
if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys._MEIPASS)          # pasta temporária do bundle
    EXE_DIR  = Path(sys.executable).resolve().parent  # pasta real do .exe
else:
    BASE_DIR = Path(__file__).resolve().parent
    EXE_DIR  = BASE_DIR

os.chdir(BASE_DIR)
sys.path.insert(0, str(BASE_DIR))

# Compat pyarrow
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
# Imports internos
# ---------------------------------------------------------------------------
from app.config import (
    DATABASE_DIR,
    get_search_directories,
    API_BASE_URL,
    POLL_INTERVAL_SECONDS,
    ESTOQUE_FILE_PATTERN, VALOR_UNIT_PATTERN, REMESSAS_FILE_PATTERN,
    ESTOQUE_HEADER_ROW, REMESSAS_HEADER_ROW,
    LOG_LEVEL,
)
from app import db, sync
from app.watcher import DirectoryWatcher

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOG_DIR  = EXE_DIR / 'logs'
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / 'planilha_sync.log'

_shutdown_event = threading.Event()


def _setup_logging() -> None:
    level = getattr(logging, LOG_LEVEL.upper(), logging.INFO)
    root  = logging.getLogger()
    root.setLevel(level)
    fmt = logging.Formatter(
        '[%(asctime)s] %(levelname)-8s %(name)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
    )
    fh = logging.handlers.RotatingFileHandler(
        LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=5, encoding='utf-8'
    )
    fh.setFormatter(fmt)
    root.addHandler(fh)


logger = None


# ---------------------------------------------------------------------------
# Pasta database/ ao lado do .exe
# ---------------------------------------------------------------------------

def _seed_database_dir() -> Path:
    db_dir = EXE_DIR / 'database'
    db_dir.mkdir(parents=True, exist_ok=True)
    readme = db_dir / 'LEIA-ME.txt'
    if not readme.exists():
        readme.write_text(
            f"Coloque aqui as planilhas Excel:\n\n"
            f"  ajuste.xlsx        -> aging_estoque\n"
            f"  *unit*.xlsx        -> material_valores\n"
            f"  *remessa*.xlsx     -> remessas\n\n"
            f"Verificacao a cada {POLL_INTERVAL_SECONDS}s automaticamente.\n"
            f"Logs em: logs/planilha_sync.log\n",
            encoding='utf-8',
        )
    return db_dir


# ---------------------------------------------------------------------------
# Status file (compartilhado com o terminal PowerShell)
# ---------------------------------------------------------------------------

def _set_loading(status_file: Path, percent: int, message: str) -> None:
    try:
        status_file.write_bytes(f"{max(0,min(100,percent))}|{message}".encode('ascii', errors='replace'))
    except Exception:
        pass


def _animate_loading(status_file: Path, start: int, end: int,
                     message: str, duration: float) -> None:
    steps = max(1, end - start)
    for i, pct in enumerate(range(start, end + 1)):
        _set_loading(status_file, pct, message)
        time.sleep(max(0.01, duration / steps))


# ---------------------------------------------------------------------------
# Terminal PowerShell de loading
# ---------------------------------------------------------------------------

def _open_loading_terminal(status_file: Path):
    """
    Abre janela PowerShell separada com barra de progresso.
    Salva o script como UTF-8 com BOM para evitar tela preta.
    """
    sf = str(status_file).replace("'", "''")

    lines = [
        "$ErrorActionPreference = 'SilentlyContinue'",
        "$ProgressPreference    = 'SilentlyContinue'",
        "$host.UI.RawUI.WindowTitle = 'Planilha Sync'",
        "$frames  = @('|','/','-','\\')",
        "$i       = 0",
        "$barSize = 28",
        "$start   = Get-Date",
        f"$sf      = '{sf}'",
        "",
        "Write-Host ''",
        "Write-Host '  ==========================================' -ForegroundColor DarkGreen",
        "Write-Host '    Planilha Sync  -  dashpesagem           ' -ForegroundColor Green",
        "Write-Host '  ==========================================' -ForegroundColor DarkGreen",
        "Write-Host ''",
        "",
        "while ($true) {",
        "    $raw = if (Test-Path $sf) { (Get-Content $sf -Raw -Encoding Ascii).Trim() } else { '0|Iniciando' }",
        "    if ($raw -match '^(\\d+)\\|(.*)$') {",
        "        $pct = [int]$Matches[1]",
        "        $msg = $Matches[2]",
        "    } else { $pct = 0; $msg = 'Aguarde' }",
        "    $fill    = [Math]::Floor(($pct / 100.0) * $barSize)",
        "    $bar     = ('=' * $fill).PadRight($barSize,'.')",
        "    $spin    = $frames[$i % 4]",
        "    $elapsed = [int]((Get-Date) - $start).TotalSeconds",
        "    $line    = \"  $spin  [$bar] $pct%  $msg  (${elapsed}s)\"",
        "    Write-Host \"`r$line\" -NoNewline -ForegroundColor Cyan",
        "    if ($pct -ge 100) { break }",
        "    $i++",
        "    Start-Sleep -Milliseconds 100",
        "}",
        "",
        "Write-Host ''",
        "Write-Host ''",
        "Write-Host '  Servico iniciado! Use o icone na bandeja para sincronizar ou encerrar.' -ForegroundColor Green",
        "Write-Host ''",
        "Start-Sleep -Seconds 3",
    ]

    script = "\r\n".join(lines)
    tmp = Path(tempfile.gettempdir()) / '_planilha_sync_load.ps1'
    tmp.write_bytes(b'\xef\xbb\xbf' + script.encode('utf-8'))

    try:
        proc = subprocess.Popen(
            [
                'powershell', '-ExecutionPolicy', 'Bypass',
                '-NoLogo', '-NonInteractive',
                '-File', str(tmp),
            ],
            creationflags=subprocess.CREATE_NEW_CONSOLE,
        )
        return proc, tmp
    except FileNotFoundError:
        return None, tmp


# ---------------------------------------------------------------------------
# Callbacks de sincronização
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

    status_file = Path(tempfile.gettempdir()) / '_planilha_sync_status.txt'
    _set_loading(status_file, 2, 'Preparando')

    loading_proc, loading_tmp = _open_loading_terminal(status_file)
    _animate_loading(status_file, 2, 15, 'Carregando modulos', 0.5)

    _setup_logging()
    logger = logging.getLogger('launcher')
    _set_loading(status_file, 18, 'Logging OK')

    search_dirs = get_search_directories()

    logger.info("=" * 55)
    logger.info("  Planilha Sync - dashpesagem")
    logger.info("  EXE_DIR      : %s", EXE_DIR)
    logger.info("  DATABASE_DIR : %s", DATABASE_DIR)
    logger.info("  PASTAS BUSCA : %s", [str(d) for d in search_dirs])
    logger.info("  API          : %s", API_BASE_URL)
    logger.info("  Intervalo    : %ss", POLL_INTERVAL_SECONDS)
    logger.info("  Log          : %s", LOG_FILE)
    logger.info("=" * 55)

    # Pasta database/ ao lado do exe
    _animate_loading(status_file, 18, 28, 'Criando pasta database', 0.3)
    runtime_db = _seed_database_dir()
    logger.info("database/ em: %s", runtime_db)

    # Inicializar cliente HTTP
    _set_loading(status_file, 30, 'Conectando API Cloudflare')
    db.init(base_url=API_BASE_URL)
    _animate_loading(status_file, 30, 50, 'Testando conectividade', 0.6)

    if not db.test_connection():
        logger.critical("API inacessivel: %s", API_BASE_URL)
        _set_loading(status_file, 100, 'ERRO: sem internet ou API offline')
        time.sleep(3)
        sys.exit(1)

    logger.info("API OK -> %s", API_BASE_URL)
    _set_loading(status_file, 52, 'API OK')

    # Configurar watcher com diretórios de busca dinâmicos
    _animate_loading(status_file, 52, 65, 'Configurando monitoramento', 0.3)
    watcher = DirectoryWatcher(directories=search_dirs, poll_interval=float(POLL_INTERVAL_SECONDS))
    watcher.add_rule('estoque', ESTOQUE_FILE_PATTERN, _on_estoque_change)
    watcher.add_rule('valor_unitario', VALOR_UNIT_PATTERN, _on_valor_unitario_change)
    watcher.add_rule('remessas', REMESSAS_FILE_PATTERN, _on_remessas_change)

    # Sync inicial (busca em todas as pastas)
    _animate_loading(status_file, 65, 88, 'Sincronizacao inicial', 0.3)
    logger.info("Sincronizacao inicial...")
    synced = watcher.scan_and_sync_all(force=True)
    logger.info("Sincronizacao inicial concluida: %d arquivo(s) sincronizado(s).", synced)

    # Iniciar watcher em background
    watcher.start()
    _animate_loading(status_file, 88, 96, 'Iniciando monitoramento', 0.2)

    # System tray
    def _force_sync():
        logger.info("Sync manual via bandeja")
        cnt = watcher.force_sync_all()
        if cnt == 0:
            from app import tray
            tray.notify("Planilha Sync", "Nenhum arquivo novo ou alterado encontrado.")

    def _shutdown():
        logger.info("Encerrando por solicitacao do usuario")
        _shutdown_event.set()

    try:
        from app.tray import start_tray
        start_tray(shutdown_callback=_shutdown, force_sync_callback=_force_sync,
                   log_path=str(LOG_FILE))
    except Exception as exc:
        logger.warning("Bandeja indisponivel: %s", exc)

    # Fechar terminal de loading
    _set_loading(status_file, 100, 'Servico iniciado!')
    if loading_proc is not None:
        try:
            loading_proc.wait(timeout=5)
        except Exception:
            loading_proc.kill()
    try:
        loading_tmp.unlink(missing_ok=True)
        status_file.unlink(missing_ok=True)
    except Exception:
        pass

    # Loop principal
    logger.info("Servico em background. Use a bandeja para sincronizar ou encerrar.")
    try:
        while not _shutdown_event.wait(timeout=1):
            pass
    except KeyboardInterrupt:
        logger.info("Interrompido via Ctrl+C")
    finally:
        watcher.stop()
        logger.info("Planilha Sync encerrado.")
        os._exit(0)


if __name__ == '__main__':
    main()
