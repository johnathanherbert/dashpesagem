"""
watcher.py — Monitor de mudanças nas planilhas.

Estratégia:
  - Polling baseado em mtime (modificação) e tamanho dos arquivos.
  - Quando algum arquivo muda, processa e envia ao banco.
  - Roda em thread daemon, pode ser parado com stop().
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, Optional

logger = logging.getLogger(__name__)


@dataclass
class _FileState:
    mtime_ns: int = 0
    size: int = 0

    @classmethod
    def from_path(cls, path: Path) -> "_FileState":
        try:
            stat = path.stat()
            return cls(mtime_ns=stat.st_mtime_ns, size=stat.st_size)
        except OSError:
            return cls()

    def changed(self, other: "_FileState") -> bool:
        return self.mtime_ns != other.mtime_ns or self.size != other.size


# Tipo de callback: recebe o Path que mudou e retorna True se sincronizou ok
SyncCallback = Callable[[Path, str], bool]


class FileWatcher:
    """
    Monitora um conjunto de arquivos por polling e dispara callbacks quando detecta mudanças.
    """

    def __init__(self, poll_interval: float = 30.0):
        self._poll_interval = poll_interval
        self._entries: Dict[Path, tuple[str, _FileState]] = {}  # path -> (kind, last_state)
        self._callbacks: Dict[str, SyncCallback] = {}           # kind -> callback
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def register(self, path: Path, kind: str, callback: SyncCallback) -> None:
        """
        Registra um arquivo para monitorar.

        :param path:     Caminho do arquivo
        :param kind:     Identificador do tipo ('estoque', 'valor_unitario', 'remessas')
        :param callback: Função chamada quando o arquivo muda: callback(path, kind) -> bool
        """
        with self._lock:
            self._entries[path] = (kind, _FileState.from_path(path))
            self._callbacks[kind] = callback
        logger.info("Watcher: registrado '%s' (%s)", path.name, kind)

    def start(self) -> None:
        """Inicia o loop de polling em thread daemon."""
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True, name="planilha-watcher")
        self._thread.start()
        logger.info("Watcher iniciado (intervalo=%ss)", self._poll_interval)

    def stop(self) -> None:
        """Para o watcher."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("Watcher parado.")

    def force_sync_all(self) -> None:
        """Força sincronização imediata de todos os arquivos registrados."""
        logger.info("Sincronização forçada de todos os arquivos...")
        with self._lock:
            entries = list(self._entries.items())
        for path, (kind, _) in entries:
            self._sync_file(path, kind)

    def _run(self) -> None:
        while not self._stop_event.is_set():
            self._check_all()
            self._stop_event.wait(timeout=self._poll_interval)

    def _check_all(self) -> None:
        with self._lock:
            entries = list(self._entries.items())

        for path, (kind, last_state) in entries:
            current_state = _FileState.from_path(path)
            if not path.exists():
                logger.debug("Watcher: '%s' não encontrado, aguardando...", path.name)
                continue

            if last_state.changed(current_state):
                logger.info(
                    "Mudança detectada: '%s' (mtime: %s → %s, size: %s → %s)",
                    path.name, last_state.mtime_ns, current_state.mtime_ns,
                    last_state.size, current_state.size,
                )
                success = self._sync_file(path, kind)
                if success:
                    # Atualiza estado salvo somente se sync foi bem-sucedido
                    with self._lock:
                        self._entries[path] = (kind, current_state)

    def _sync_file(self, path: Path, kind: str) -> bool:
        callback = self._callbacks.get(kind)
        if callback is None:
            return False
        try:
            return callback(path, kind)
        except Exception as exc:
            logger.error("Erro ao sincronizar '%s' (%s): %s", path.name, kind, exc)
            return False
