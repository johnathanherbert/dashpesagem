"""
launcher.py — Ponto de entrada do Planilha Sync.

Comportamento:
  1. Abre terminal PowerShell com animação de carregamento (Windows)
  2. Cria pasta database/ ao lado do .exe (se não existir)
  3. Configura logging (console + arquivo rotativo)
  4. Inicializa pool de conexão PostgreSQL
  5. Descobre planilhas na pasta DATABASE_DIR
  6. Executa sincronização inicial imediata
  7. Inicia FileWatcher para detectar mudanças futuras
  8. Exibe ícone na bandeja do sistema
  9. Fecha terminal de loading e aguarda encerramento

Compatível com PyInstaller (frozen) e execução direta (python launcher.py).
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
# PyInstaller: ajustar BASE_DIR e sys.path
# ---------------------------------------------------------------------------
if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys._MEIPASS)
    EXE_DIR  = Path(sys.executable).resolve().parent   # pasta real do .exe
else:
    BASE_DIR = Path(__file__).resolve().parent
    EXE_DIR  = BASE_DIR

os.chdir(BASE_DIR)
sys.path.insert(0, str(BASE_DIR))

# Carrega variáveis de ambiente do arquivo .env (se existir)
try:
    from dotenv import load_dotenv as _load_dotenv
    for _env_path in [EXE_DIR / '.env', BASE_DIR / '.env', BASE_DIR.parent / '.env']:
        if _env_path.exists():
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
    API_BASE_URL, API_KEY, API_TIMEOUT, API_CHUNK_SIZE,
    POLL_INTERVAL_SECONDS,
    ESTOQUE_FILE_PATTERN, VALOR_UNIT_PATTERN, REMESSAS_FILE_PATTERN,
    ESTOQUE_HEADER_ROW, REMESSAS_HEADER_ROW,
    LOG_LEVEL,
)
from app import db, sync
from app.watcher import FileWatcher

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
        '[%(asctime)s] %(levelname)-8s %(name)s — %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
    )

    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(fmt)
    root.addHandler(ch)

    fh = logging.handlers.RotatingFileHandler(
        LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=5, encoding='utf-8'
    )
    fh.setFormatter(fmt)
    root.addHandler(fh)


logger = None  # definido após _setup_logging()


# ---------------------------------------------------------------------------
# Pasta database ao lado do .exe
# ---------------------------------------------------------------------------

_DATABASE_README = """\
# Pasta de Planilhas — Planilha Sync

Coloque aqui as planilhas Excel que serão monitoradas:

  ajuste.xlsx           → sincroniza com aging_estoque
  *unit*.xlsx           → sincroniza com material_valores
  *remessa*.xlsx        → sincroniza com remessas

O serviço detecta mudanças automaticamente a cada {interval}s
e atualiza o banco de dados do dashpesagem.

Configurações em: .env (ao lado do executável)
Logs em:          logs/planilha_sync.log
"""


_ENV_EXAMPLE_CONTENT = """\
# Planilha Sync — dashpesagem
# Copie este arquivo para .env e ajuste os valores

# =====================================================
# API do dashpesagem (via Cloudflare)
# =====================================================
API_BASE_URL=https://dash.agilework.app.br
API_KEY=
API_TIMEOUT=60
API_CHUNK_SIZE=500

# =====================================================
# Planilhas
# =====================================================
# Diretório das planilhas. Se vazio, usa a pasta database/ ao lado do exe.
# DATABASE_DIR=C:\\Users\\SeuUsuario\\OneDrive\\Pasta\\Planilhas

ESTOQUE_FILE_PATTERN=ajuste.xlsx
VALOR_UNIT_PATTERN=*unit*.xlsx
REMESSAS_FILE_PATTERN=*remessa*.xlsx
ESTOQUE_HEADER_ROW=3
VALOR_UNIT_HEADER_ROW=0
REMESSAS_HEADER_ROW=3

# =====================================================
# Watcher
# =====================================================
POLL_INTERVAL_SECONDS=30
LOG_LEVEL=INFO
"""


def _seed_database_dir() -> Path:
    """Cria pasta database/ ao lado do .exe e gera arquivos de ajuda."""
    db_dir = EXE_DIR / 'database'
    db_dir.mkdir(parents=True, exist_ok=True)

    readme = db_dir / 'LEIA-ME.txt'
    if not readme.exists():
        readme.write_text(
            _DATABASE_README.format(interval=POLL_INTERVAL_SECONDS),
            encoding='utf-8',
        )

    # Gera .env.example ao lado do exe (conteúdo embutido — sem dependência de arquivo externo)
    env_example = EXE_DIR / '.env.example'
    if not env_example.exists():
        env_example.write_text(_ENV_EXAMPLE_CONTENT, encoding='utf-8')

    return db_dir



# ---------------------------------------------------------------------------
# Terminal PowerShell de loading (idêntico ao aging_flask)
# ---------------------------------------------------------------------------

def _set_loading(status_file: Path, percent: int, message: str) -> None:
    percent = max(0, min(100, int(percent)))
    try:
        status_file.write_text(f"{percent}|{message}", encoding='utf-8')
    except Exception:
        pass


def _animate_loading(status_file: Path, start: int, end: int,
                     message: str, duration: float) -> None:
    if end <= start:
        _set_loading(status_file, end, message)
        return
    steps = max(1, end - start)
    sleep_per_step = max(0.01, duration / steps)
    for pct in range(start, end + 1):
        _set_loading(status_file, pct, message)
        time.sleep(sleep_per_step)


def _open_loading_terminal(status_file: Path):
    """Abre janela PowerShell com barra de progresso animada."""
    script = "\n".join([
        "$ErrorActionPreference = 'SilentlyContinue'",
        "$host.UI.RawUI.WindowTitle = 'Planilha Sync — dashpesagem'",
        "$frames = @('|', '/', '-', '\\\\')",
        "$i = 0",
        "$start = Get-Date",
        f"$statusFile = '{str(status_file).replace(chr(92), chr(92)*2)}'",
        "$barSize = 30",
        "Clear-Host",
        "Write-Host '=================================================' -ForegroundColor DarkGreen",
        "Write-Host '        Planilha Sync  —  dashpesagem            ' -ForegroundColor Green",
        "Write-Host '=================================================' -ForegroundColor DarkGreen",
        "Write-Host ''",
        "Write-Host 'Inicializando servico de sincronizacao...' -ForegroundColor Gray",
        "Write-Host ''",
        "while ($true) {",
        "    if (Test-Path $statusFile) {",
        "        $raw = Get-Content $statusFile -ErrorAction SilentlyContinue",
        "    } else {",
        "        $raw = '0|Inicializando'",
        "    }",
        "    $parts = $raw -split '\\|', 2",
        "    $pct = [int]$parts[0]",
        "    $msg = if ($parts.Length -gt 1) { $parts[1] } else { 'Inicializando' }",
        "    $fill = [Math]::Min($barSize, [Math]::Floor(($pct / 100.0) * $barSize))",
        "    $bar = ('=' * $fill).PadRight($barSize, '.')",
        "    $f = $frames[$i % 4]",
        "    $elapsed = [int]((Get-Date) - $start).TotalSeconds",
        "    Write-Host \"`r   $f  [$bar] $pct%  $msg  ($elapsed s)\" -NoNewline -ForegroundColor Cyan",
        "    if ($pct -ge 100) { break }",
        "    $i++",
        "    Start-Sleep -Milliseconds 90",
        "}",
        "Write-Host ''",
        "Write-Host ''",
        "Write-Host 'Servico iniciado! Monitorando planilhas em background.' -ForegroundColor Green",
        "Write-Host 'Use o icone na bandeja do sistema para sincronizar ou encerrar.' -ForegroundColor Gray",
        "Write-Host ''",
        "Start-Sleep -Seconds 4",
    ])

    tmp = Path(tempfile.gettempdir()) / '_planilha_sync_load.ps1'
    tmp.write_text(script, encoding='utf-8')

    try:
        proc = subprocess.Popen(
            ['powershell', '-ExecutionPolicy', 'Bypass', '-NoLogo', '-File', str(tmp)],
            creationflags=subprocess.CREATE_NEW_CONSOLE,
        )
        return proc, tmp
    except FileNotFoundError:
        # PowerShell não disponível (Linux/macOS em modo dev)
        return None, tmp


# ---------------------------------------------------------------------------
# Descoberta de planilhas
# ---------------------------------------------------------------------------

def _find_files(directory: Path, pattern: str) -> list[Path]:
    if not directory.exists():
        return []
    return sorted(directory.glob(pattern))


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

    # ── Status file para o terminal de loading ───────────────────────────
    status_file = Path(tempfile.gettempdir()) / '_planilha_sync_status.txt'
    _set_loading(status_file, 3, 'Preparando ambiente')

    # ── Abre terminal PowerShell com animação ────────────────────────────
    loading_proc, loading_tmp = _open_loading_terminal(status_file)
    _animate_loading(status_file, 3, 15, 'Carregando modulos', 0.4)

    # ── Logging ──────────────────────────────────────────────────────────
    _setup_logging()
    logger = logging.getLogger('launcher')
    _set_loading(status_file, 18, 'Logging configurado')

    logger.info("=" * 60)
    logger.info("  Planilha Sync — dashpesagem")
    logger.info("  EXE_DIR      : %s", EXE_DIR)
    logger.info("  DATABASE_DIR : %s", DATABASE_DIR)
    logger.info("  API          : %s", API_BASE_URL)
    logger.info("  Intervalo    : %ss", POLL_INTERVAL_SECONDS)
    logger.info("  Log          : %s", LOG_FILE)
    logger.info("=" * 60)

    # ── Criar pasta database/ ao lado do .exe ────────────────────────────
    _animate_loading(status_file, 18, 28, 'Criando pasta database', 0.3)
    runtime_db = _seed_database_dir()
    logger.info("Pasta database criada/verificada em: %s", runtime_db)

    # ── Inicializar cliente HTTP ──────────────────────────────────────────
    _set_loading(status_file, 30, 'Conectando a API Cloudflare')
    db.init(
        base_url=API_BASE_URL,
        api_key=API_KEY,
        timeout=API_TIMEOUT,
        chunk_size=API_CHUNK_SIZE,
    )

    _animate_loading(status_file, 30, 50, 'Testando conectividade', 0.5)

    if not db.test_connection():
        logger.critical(
            "Não foi possível conectar à API em %s. "
            "Verifique a URL e a conectividade com a internet.", API_BASE_URL
        )
        _set_loading(status_file, 100, 'ERRO: API inacessivel')
        time.sleep(2)
        sys.exit(1)

    logger.info("Conectividade com API OK → %s", API_BASE_URL)
    _set_loading(status_file, 52, 'API OK')

    # ── Configurar watcher ────────────────────────────────────────────────
    _animate_loading(status_file, 52, 65, 'Registrando planilhas', 0.3)
    watcher = FileWatcher(poll_interval=float(POLL_INTERVAL_SECONDS))
    registered_count = 0

    for f in _find_files(DATABASE_DIR, ESTOQUE_FILE_PATTERN):
        watcher.register(f, 'estoque', _on_estoque_change)
        registered_count += 1

    for f in _find_files(DATABASE_DIR, VALOR_UNIT_PATTERN):
        watcher.register(f, 'valor_unitario', _on_valor_unitario_change)
        registered_count += 1

    for f in _find_files(DATABASE_DIR, REMESSAS_FILE_PATTERN):
        watcher.register(f, 'remessas', _on_remessas_change)
        registered_count += 1

    if registered_count == 0:
        logger.warning(
            "Nenhuma planilha encontrada em '%s'. "
            "Coloque os arquivos na pasta database/ e o sync será automático.",
            DATABASE_DIR,
        )
    else:
        logger.info("%d planilha(s) registrada(s) para monitoramento.", registered_count)

    # ── Sincronização inicial ─────────────────────────────────────────────
    _animate_loading(status_file, 65, 85, 'Sincronizacao inicial', 0.2)
    logger.info("Executando sincronização inicial...")
    watcher.force_sync_all()

    # ── Iniciar watcher ───────────────────────────────────────────────────
    watcher.start()
    _animate_loading(status_file, 85, 95, 'Iniciando monitoramento', 0.2)

    # ── Bandeja do sistema ────────────────────────────────────────────────
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
        logger.warning("Não foi possível iniciar bandeja do sistema: %s", exc)

    # ── Fechar terminal de loading ────────────────────────────────────────
    _set_loading(status_file, 100, 'Servico iniciado!')
    time.sleep(0.5)
    if loading_proc is not None:
        # Aguarda o PS1 exibir a mensagem de conclusão antes de fechar
        try:
            loading_proc.wait(timeout=5)
        except Exception:
            loading_proc.kill()
    try:
        loading_tmp.unlink(missing_ok=True)
        status_file.unlink(missing_ok=True)
    except Exception:
        pass

    # ── Loop principal ────────────────────────────────────────────────────
    logger.info("Serviço rodando em background. Use a bandeja ou Ctrl+C para encerrar.")
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
