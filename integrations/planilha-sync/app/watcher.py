"""
watcher.py — Monitor dinâmico de diretórios e planilhas.

Estratégia:
  - Monitora diretórios procurando por padrões de arquivo (ex: ajuste.xlsx, *unit*.xlsx, *remessa*.xlsx).
  - Escaneia dinamicamente os diretórios a cada ciclo de polling (detecta arquivos novos adicionados depois).
  - Roda em thread daemon e suporta sincronização forçada manual.
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, List, Optional

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


@dataclass
class _WatchRule:
    kind: str
    pattern: str
    callback: SyncCallback


class DirectoryWatcher:
    """
    Monitora diretórios em busca de padrões de planilhas e dispara callbacks quando arquivos mudam ou surgem.
    """

    def __init__(self, directories: List[Path], poll_interval: float = 15.0):
        self._directories = directories
        self._poll_interval = poll_interval
        self._rules: List[_WatchRule] = []
        self._file_states: Dict[Path, tuple[str, _FileState]] = {}
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def add_rule(self, kind: str, pattern: str, callback: SyncCallback) -> None:
        """Registra uma regra de monitoramento (ex: 'estoque', 'ajuste.xlsx', callback)."""
        with self._lock:
            self._rules.append(_WatchRule(kind=kind, pattern=pattern, callback=callback))
        logger.info("Watcher: regra registrada '%s' com padrão '%s'", kind, pattern)

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

    def scan_and_sync_all(self, force: bool = False) -> int:
        """
        Varre todos os diretórios monitorados e sincroniza os arquivos encontrados.
        Se force=True, sincroniza mesmo que o arquivo não tenha sido modificado.
        Retorna o número de arquivos sincronizados.
        """
        synced_count = 0
        with self._lock:
            rules = list(self._rules)
            dirs = list(self._directories)

        found_any = False
        for d in dirs:
            if not d.exists() or not d.is_dir():
                continue

            for rule in rules:
                matches = list(d.glob(rule.pattern))
                if matches:
                    found_any = True

                for file_path in matches:
                    if not file_path.is_file():
                        continue

                    current_state = _FileState.from_path(file_path)
                    
                    with self._lock:
                        last_info = self._file_states.get(file_path)

                    should_sync = force
                    if not should_sync:
                        if last_info is None:
                            logger.info("Novo arquivo detectado: '%s' (%s)", file_path.name, rule.kind)
                            should_sync = True
                        elif last_info[1].changed(current_state):
                            logger.info(
                                "Modificação detectada em '%s': mtime=%s, size=%s",
                                file_path.name, current_state.mtime_ns, current_state.size
                            )
                            should_sync = True

                    if should_sync:
                        logger.info("Processando '%s' (%s)...", file_path.name, rule.kind)
                        try:
                            ok = rule.callback(file_path, rule.kind)
                            if ok:
                                with self._lock:
                                    self._file_states[file_path] = (rule.kind, current_state)
                                synced_count += 1
                                logger.info("Sincronização de '%s' concluída com sucesso.", file_path.name)
                            else:
                                logger.warning("Sincronização de '%s' retornou status de falha.", file_path.name)
                        except Exception as exc:
                            logger.error("Erro ao executar callback de sync em '%s': %s", file_path.name, exc, exc_info=True)

        if not found_any and force:
            logger.warning("Nenhuma planilha encontrada nos diretórios monitorados: %s", [str(d) for d in dirs if d.exists()])

        return synced_count

    def force_sync_all(self) -> int:
        """Força a sincronização imediata de todas as planilhas existentes."""
        logger.info("Sincronização forçada iniciada...")
        return self.scan_and_sync_all(force=True)

    def _run(self) -> None:
        while not self._stop_event.is_set():
            try:
                self.scan_and_sync_all(force=False)
            except Exception as exc:
                logger.error("Erro no ciclo de monitoramento: %s", exc)
            self._stop_event.wait(timeout=self._poll_interval)
