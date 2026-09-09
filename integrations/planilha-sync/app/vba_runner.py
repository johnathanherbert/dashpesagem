"""
vba_runner.py — Execução e agendamento automático de scripts VBA / VBScript / Macros Excel.

Lê as configurações de um arquivo JSON (vba_config.json), executa o script a cada
intervalo definido (em minutos) e dispara a sincronização automática dos dados gerados.
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
import tempfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional, Tuple

from app import tray

logger = logging.getLogger(__name__)

DEFAULT_CONFIG_FILENAME = "vba_config.json"


@dataclass
class VbaConfig:
    enabled: bool = False
    interval_minutes: int = 15
    vba_script_path: str = ""
    macro_name: str = ""  # Opcional: nome da macro caso seja arquivo .xlsm / .xls
    output_data_path: str = ""  # Caminho onde o script salva o arquivo (ex: dados.txt ou ajuste.xlsx)
    timeout_seconds: int = 180
    run_on_startup: bool = True

    @classmethod
    def from_dict(cls, data: dict) -> "VbaConfig":
        return cls(
            enabled=bool(data.get("enabled", False)),
            interval_minutes=max(1, int(data.get("interval_minutes", 15))),
            vba_script_path=str(data.get("vba_script_path", "")).strip(),
            macro_name=str(data.get("macro_name", "")).strip(),
            output_data_path=str(data.get("output_data_path", "")).strip(),
            timeout_seconds=max(10, int(data.get("timeout_seconds", 180))),
            run_on_startup=bool(data.get("run_on_startup", True)),
        )


def find_or_create_config_file(base_dir: Path) -> Tuple[Path, VbaConfig]:
    """
    Localiza o arquivo vba_config.json ou cria um modelo inicial caso não exista.
    """
    candidate_paths = [
        base_dir / DEFAULT_CONFIG_FILENAME,
        base_dir / "database" / DEFAULT_CONFIG_FILENAME,
    ]

    for p in candidate_paths:
        if p.exists() and p.is_file():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                config = VbaConfig.from_dict(data)
                logger.info("Configuração VBA carregada de: %s (enabled=%s, interval=%d min)", p, config.enabled, config.interval_minutes)
                return p, config
            except Exception as exc:
                logger.error("Erro ao ler %s: %s", p, exc)

    # Cria arquivo padrão em base_dir
    default_path = base_dir / DEFAULT_CONFIG_FILENAME
    sample_config = {
        "enabled": False,
        "interval_minutes": 15,
        "vba_script_path": r"C:\Automacoes\extrair_sap.vbs",
        "macro_name": "",
        "output_data_path": r"database\dados.txt",
        "timeout_seconds": 180,
        "run_on_startup": True,
        "_comentarios": {
            "enabled": "Defina como true para ativar a execução automática do script",
            "interval_minutes": "Intervalo em minutos entre cada extração",
            "vba_script_path": "Caminho do script (.vbs, .xlsm, .xls, .bat ou .ps1)",
            "macro_name": "Se o script for uma planilha .xlsm/.xls, informe o nome da Macro (ex: Modulo1.ExtrairRelatorio)",
            "output_data_path": "Caminho onde o script salva o arquivo de dados (.txt ou .xlsx)",
            "timeout_seconds": "Tempo máximo de espera antes de abortar a execução"
        }
    }

    try:
        with open(default_path, "w", encoding="utf-8") as f:
            json.dump(sample_config, f, indent=2, ensure_ascii=False)
        logger.info("Criado arquivo de configuração VBA modelo: %s", default_path)
    except Exception as exc:
        logger.warning("Não foi possível criar %s: %s", default_path, exc)

    return default_path, VbaConfig()


def execute_vba_script(config: VbaConfig, base_dir: Path) -> Tuple[bool, str]:
    """
    Executa o script configurado (VBS, XLSM, BAT ou PS1) de forma síncrona com timeout.
    """
    if not config.vba_script_path:
        return False, "Caminho do script VBA não informado no vba_config.json."

    raw_path = config.vba_script_path
    script_path = Path(raw_path)
    if not script_path.is_absolute():
        script_path = (base_dir / script_path).resolve()

    if not script_path.exists():
        return False, f"Script VBA não encontrado no caminho: {script_path}"

    ext = script_path.suffix.lower()
    logger.info("Iniciando execução do script VBA: %s (tipo: %s)", script_path, ext)

    t0 = time.perf_counter()
    try:
        if ext == ".vbs":
            cmd = ["cscript.exe", "//nologo", str(script_path)]
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=config.timeout_seconds,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
            )
            elapsed = time.perf_counter() - t0
            if proc.returncode != 0:
                err_msg = proc.stderr.strip() or proc.stdout.strip() or f"Código de saída: {proc.returncode}"
                logger.error("Execução VBS falhou em %.1fs: %s", elapsed, err_msg)
                return False, f"Erro no VBScript: {err_msg}"
            
            logger.info("VBScript executado com sucesso em %.1fs.", elapsed)
            return True, f"Sucesso em {elapsed:.1f}s"

        elif ext in (".xlsm", ".xls", ".xlsb"):
            # Executa macro do Excel via VBScript temporário (nativo do Windows, sem dependência externa)
            macro = config.macro_name or "Auto_Open"
            vbs_code = f'''
On Error Resume Next
Set xlApp = CreateObject("Excel.Application")
xlApp.Visible = False
xlApp.DisplayAlerts = False
Set wb = xlApp.Workbooks.Open("{str(script_path).replace("\\", "\\\\")}")
If Err.Number <> 0 Then
    WScript.Echo "Erro ao abrir pasta de trabalho: " & Err.Description
    WScript.Quit 1
End If
xlApp.Run "{macro}"
If Err.Number <> 0 Then
    WScript.Echo "Erro ao executar macro '{macro}': " & Err.Description
    wb.Close False
    xlApp.Quit
    WScript.Quit 2
End If
wb.Close False
xlApp.Quit
WScript.Echo "Macro executada com sucesso"
WScript.Quit 0
'''
            with tempfile.NamedTemporaryFile("w", suffix=".vbs", delete=False, encoding="utf-8") as tf:
                tf.write(vbs_code)
                tmp_vbs = Path(tf.name)

            try:
                proc = subprocess.run(
                    ["cscript.exe", "//nologo", str(tmp_vbs)],
                    capture_output=True,
                    text=True,
                    timeout=config.timeout_seconds,
                    creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
                )
                elapsed = time.perf_counter() - t0
                if proc.returncode != 0:
                    err_msg = proc.stdout.strip() or proc.stderr.strip() or f"Código: {proc.returncode}"
                    logger.error("Execução da macro Excel falhou em %.1fs: %s", elapsed, err_msg)
                    return False, f"Erro na Macro Excel: {err_msg}"

                logger.info("Macro Excel executada com sucesso em %.1fs.", elapsed)
                return True, f"Sucesso em {elapsed:.1f}s"
            finally:
                try:
                    tmp_vbs.unlink(missing_ok=True)
                except Exception:
                    pass

        elif ext in (".bat", ".cmd"):
            proc = subprocess.run(
                [str(script_path)],
                capture_output=True,
                text=True,
                timeout=config.timeout_seconds,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
            )
            elapsed = time.perf_counter() - t0
            if proc.returncode != 0:
                err_msg = proc.stderr.strip() or proc.stdout.strip()
                return False, f"Erro no BAT: {err_msg}"
            return True, f"Sucesso em {elapsed:.1f}s"

        elif ext == ".ps1":
            proc = subprocess.run(
                ["powershell", "-ExecutionPolicy", "Bypass", "-File", str(script_path)],
                capture_output=True,
                text=True,
                timeout=config.timeout_seconds,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
            )
            elapsed = time.perf_counter() - t0
            if proc.returncode != 0:
                err_msg = proc.stderr.strip() or proc.stdout.strip()
                return False, f"Erro no PowerShell: {err_msg}"
            return True, f"Sucesso em {elapsed:.1f}s"

        else:
            return False, f"Extensão '{ext}' não suportada para execução automatizada."

    except subprocess.TimeoutExpired:
        logger.error("Execução do script VBA excedeu o tempo limite de %ds.", config.timeout_seconds)
        return False, f"Timeout de {config.timeout_seconds}s excedido."
    except Exception as exc:
        logger.error("Erro inesperado ao executar script VBA: %s", exc, exc_info=True)
        return False, str(exc)


class VbaScheduler:
    """
    Agendador em thread que executa o script VBA periodicamente e dispara a sincronização.
    """

    def __init__(
        self,
        base_dir: Path,
        on_sync_trigger: Optional[Callable[[Path], None]] = None,
    ):
        self.base_dir = base_dir
        self.on_sync_trigger = on_sync_trigger
        self.config_path, self.config = find_or_create_config_file(base_dir)

        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._is_running = False

    def reload_config(self) -> VbaConfig:
        with self._lock:
            self.config_path, self.config = find_or_create_config_file(self.base_dir)
            return self.config

    def start(self) -> None:
        if not self.config.enabled:
            logger.info("Agendador VBA desativado no %s (enabled=false).", DEFAULT_CONFIG_FILENAME)
            return

        if self._thread and self._thread.is_alive():
            return

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_loop, daemon=True, name="vba-scheduler")
        self._thread.start()
        logger.info("Agendador VBA iniciado: intervalo de %d minuto(s).", self.config.interval_minutes)

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("Agendador VBA parado.")

    def run_once(self, notify_user: bool = True) -> bool:
        """
        Executa uma extração manual imediatamente.
        """
        self.reload_config()
        if not self.config.vba_script_path:
            msg = "Caminho do script VBA não configurado em vba_config.json."
            logger.warning(msg)
            if notify_user:
                tray.notify("Extração VBA", msg)
            return False

        if notify_user:
            tray.notify("Extração VBA", "Iniciando execução do script...")

        ok, msg = execute_vba_script(self.config, self.base_dir)

        if ok:
            logger.info("Extração VBA concluída com sucesso: %s", msg)
            if notify_user:
                tray.notify("Extração VBA", "Script executado com sucesso! Verificando dados...")

            # Se houver output_data_path configurado, dispara sync diretamente
            if self.config.output_data_path and self.on_sync_trigger:
                out_path = Path(self.config.output_data_path)
                if not out_path.is_absolute():
                    out_path = (self.base_dir / out_path).resolve()
                if out_path.exists():
                    self.on_sync_trigger(out_path)
        else:
            logger.error("Falha na extração VBA: %s", msg)
            if notify_user:
                tray.notify("Extração VBA — Falha", f"Erro: {msg}")

        return ok

    def _run_loop(self) -> None:
        # Se configurado para rodar na inicialização
        if self.config.run_on_startup:
            logger.info("Executando extração VBA inicial (run_on_startup=true)...")
            self.run_once(notify_user=False)

        while not self._stop_event.is_set():
            interval_sec = max(60, self.config.interval_minutes * 60)
            
            # Aguarda pelo intervalo com checagem de cancelamento
            if self._stop_event.wait(timeout=interval_sec):
                break

            logger.info("Executando extração VBA agendada...")
            self.run_once(notify_user=False)
