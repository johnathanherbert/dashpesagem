"""
updater.py — Sistema de Auto-Atualização automática do Planilha Sync via GitHub Releases.

Permite que o executável standalone (.exe) se atualize automaticamente a cada novo commit/release,
sem intervenção manual ou necessidade de compilação local.
"""

from __future__ import annotations

import logging
import os
import re
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Optional, Tuple

import json
import logging
import os
import re
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Optional, Tuple
import urllib.request
import urllib.error

try:
    import requests
    _HAS_REQUESTS = True
except ImportError:
    requests = None
    _HAS_REQUESTS = False

from app import tray
from app.version import VERSION, BUILD_COMMIT, GITHUB_REPO, RELEASE_TAG

logger = logging.getLogger(__name__)


def _http_get_json(url: str, headers: dict, timeout: int = 12) -> Optional[dict]:
    """Executa requisição GET e retorna JSON."""
    if _HAS_REQUESTS and requests is not None:
        try:
            resp = requests.get(url, headers=headers, timeout=timeout)
            if resp.status_code == 200:
                return resp.json()
        except Exception:
            pass
        return None

    # Fallback para urllib
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode('utf-8'))
    except Exception:
        pass
    return None


def _http_download_file(url: str, dest_path: Path, headers: dict, timeout: int = 120) -> bool:
    """Baixa um arquivo de url para dest_path em blocos."""
    if _HAS_REQUESTS and requests is not None:
        try:
            resp = requests.get(url, headers=headers, timeout=timeout, stream=True)
            if resp.status_code != 200:
                return False
            with open(dest_path, 'wb') as f:
                for chunk in resp.iter_content(chunk_size=64 * 1024):
                    if chunk:
                        f.write(chunk)
            return True
        except Exception as exc:
            logger.error("Erro no download via requests: %s", exc)
            return False

    # Fallback para urllib
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status != 200:
                return False
            with open(dest_path, 'wb') as f:
                while True:
                    chunk = resp.read(64 * 1024)
                    if not chunk:
                        break
                    f.write(chunk)
        return True
    except Exception as exc:
        logger.error("Erro no download via urllib: %s", exc)
        return False


def check_for_update(current_version: str = VERSION, current_commit: str = BUILD_COMMIT) -> Optional[dict]:
    """
    Verifica no GitHub se existe uma versão mais recente do planilha_sync.exe.
    Retorna dict com informações do download ou None se já estiver atualizado.
    """
    url = f"https://api.github.com/repos/{GITHUB_REPO}/releases/tags/{RELEASE_TAG}"
    fallback_url = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"

    headers = {
        "User-Agent": f"PlanilhaSync/{current_version}",
        "Accept": "application/vnd.github.v3+json",
    }

    data = _http_get_json(url, headers=headers, timeout=12)
    if not data:
        data = _http_get_json(fallback_url, headers=headers, timeout=12)

    if not data or not isinstance(data, dict):
        logger.debug("Não foi possível obter dados de releases do GitHub.")
        return None

    remote_tag = data.get("tag_name", "")
    body = data.get("body", "")
    published_at = data.get("published_at", "")

    # Localiza o commit hash no corpo da release se disponível
    remote_commit = ""
    commit_match = re.search(r"Commit:\s*([a-f0-9]{7,40})", body, re.IGNORECASE)
    if commit_match:
        remote_commit = commit_match.group(1)[:8]

    # Encontra o asset planilha_sync.exe
    exe_asset = None
    for asset in data.get("assets", []):
        if asset.get("name", "").lower() == "planilha_sync.exe":
            exe_asset = asset
            break

    if not exe_asset:
        logger.debug("Nenhum executável planilha_sync.exe encontrado na release remota.")
        return None

    download_url = exe_asset.get("browser_download_url")
    if not download_url:
        return None

    # Compara se há versão mais recente
    is_newer = False

    if current_commit and current_commit != "dev" and remote_commit:
        if not current_commit.startswith(remote_commit) and not remote_commit.startswith(current_commit):
            is_newer = True
    elif remote_tag and remote_tag != current_version and remote_tag != "latest":
        is_newer = True

    logger.info(
        "Verificação de atualização: local=(versão:%s, commit:%s) vs remoto=(tag:%s, commit:%s, pub:%s) -> Nova versão? %s",
        current_version, current_commit, remote_tag, remote_commit, published_at, is_newer
    )

    if is_newer:
        return {
            "tag": remote_tag,
            "commit": remote_commit,
            "download_url": download_url,
            "size": exe_asset.get("size", 0),
            "published_at": published_at,
        }

    return None


def download_and_apply_update(update_info: dict, exe_dir: Path, current_exe: Path) -> bool:
    """
    Baixa o novo .exe e cria um script batch para substituir o executável e reiniciar.
    """
    download_url = update_info.get("download_url")
    if not download_url:
        return False

    new_exe_path = exe_dir / "planilha_sync.exe.new"
    updater_bat_path = exe_dir / "_planilha_sync_updater.bat"

    logger.info("Baixando atualização de: %s para %s ...", download_url, new_exe_path)

    headers = {"User-Agent": f"PlanilhaSync/{VERSION}"}
    success = _http_download_file(download_url, new_exe_path, headers=headers, timeout=180)

    if not success or not new_exe_path.exists():
        logger.error("Falha ao baixar arquivo de atualização.")
        new_exe_path.unlink(missing_ok=True)
        return False

    downloaded_size = new_exe_path.stat().st_size
    logger.info("Download concluído com sucesso (%d bytes).", downloaded_size)

    if downloaded_size < 1024 * 1024:  # Menor que 1MB é suspeito de erro/HTML
        logger.error("Arquivo baixado parece corrompido ou incompleto (tamanho: %d bytes).", downloaded_size)
        new_exe_path.unlink(missing_ok=True)
        return False

    # Se estiver rodando como standalone .exe no Windows, prepara script batch de troca
    target_exe_name = current_exe.name if current_exe.is_file() else "planilha_sync.exe"

    bat_script = f"""@echo off
chcp 65001 > nul
echo ========================================================
echo   Planilha Sync — Aplicando Atualização Automática
echo ========================================================
echo.
echo Aguardando fechamento do processo anterior...
timeout /t 2 /nobreak > nul

:retry_move
move /y "{new_exe_path.name}" "{target_exe_name}" > nul 2>&1
if errorlevel 1 (
    timeout /t 1 /nobreak > nul
    goto retry_move
)

echo Atualização aplicada com sucesso!
echo Reiniciando o Planilha Sync...
start "" "{target_exe_name}"
del "%~f0"
"""

    try:
        with open(updater_bat_path, "w", encoding="utf-8") as f:
            f.write(bat_script)

        tray.notify(
            "Planilha Sync — Atualização",
            "Nova versão instalada com sucesso! Reiniciando aplicativo..."
        )

        logger.info("Disparando script de atualização e encerrando processo atual...")
        time.sleep(1)

        if sys.platform == "win32":
            subprocess.Popen(
                ["cmd.exe", "/c", str(updater_bat_path)],
                cwd=str(exe_dir),
                creationflags=subprocess.CREATE_NEW_CONSOLE,
            )
        else:
            new_exe_path.replace(current_exe)
            subprocess.Popen([str(current_exe)], cwd=str(exe_dir))

        os._exit(0)
    except Exception as exc:
        logger.error("Falha ao preparar aplicação da atualização: %s", exc, exc_info=True)
        return False


class AutoUpdater:
    """
    Gerencia verificações de atualizações em segundo plano.
    """

    def __init__(self, exe_dir: Path, current_exe: Path, check_interval_hours: int = 4):
        self.exe_dir = exe_dir
        self.current_exe = current_exe
        self.check_interval_sec = max(300, check_interval_hours * 3600)
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def check_now(self, manual: bool = False) -> bool:
        """
        Executa checagem imediata.
        """
        logger.info("Verificando se há atualizações do Planilha Sync no GitHub...")
        if manual:
            tray.notify("Planilha Sync", "Verificando se há novas atualizações...")

        try:
            update = check_for_update()
            if update:
                tag = update.get("tag") or update.get("commit", "nova versão")
                logger.info("Nova versão disponível: %s. Iniciando download...", tag)
                tray.notify("Planilha Sync — Atualização", f"Nova versão encontrada ({tag}). Baixando atualização...")
                return download_and_apply_update(update, self.exe_dir, self.current_exe)
            else:
                logger.info("Planilha Sync já está na versão mais recente.")
                if manual:
                    tray.notify("Planilha Sync", "O aplicativo já está na versão mais recente.")
                return False
        except Exception as exc:
            logger.error("Erro na verificação de atualização: %s", exc)
            if manual:
                tray.notify("Planilha Sync — Erro", f"Não foi possível verificar atualizações: {exc}")
            return False

    def start(self) -> None:
        """Inicia thread de verificação periódica em background."""
        if self._thread and self._thread.is_alive():
            return

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_loop, daemon=True, name="auto-updater")
        self._thread.start()
        logger.info("Auto-updater iniciado (checagem a cada %ds).", self.check_interval_sec)

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=3)
        logger.info("Auto-updater parado.")

    def _run_loop(self) -> None:
        # Aguarda 10 segundos após a inicialização para não competir com o startup
        if self._stop_event.wait(timeout=10):
            return

        # Checagem inicial
        self.check_now(manual=False)

        while not self._stop_event.is_set():
            if self._stop_event.wait(timeout=self.check_interval_sec):
                break
            self.check_now(manual=False)
