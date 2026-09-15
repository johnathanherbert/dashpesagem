"""
sap_runner.py — Execução de automações SAP GUI (VBScript) disparadas sob demanda.

Recebe comandos do dashboard (ex: movermigo / mover ajuste /nlt10),
executa o script VBScript na sessão ativa do SAP GUI e reporta o resultado.
"""

from __future__ import annotations

import logging
import os
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path
from typing import Callable, Dict, Any, Optional, Tuple

from app import db, tray

logger = logging.getLogger(__name__)

# Script padrão movermigo: transfere estoque S de PES/PESAGEM para 999/AJUSTE via /nlt10
DEFAULT_MOVERMIGO_SCRIPT = '''If Not IsObject(application) Then
   Set SapGuiAuto  = GetObject("SAPGUI")
   Set application = SapGuiAuto.GetScriptingEngine
End If
If Not IsObject(connection) Then
   Set connection = application.Children(0)
End If
If Not IsObject(session) Then
   Set session    = connection.Children(0)
End If
If IsObject(WScript) Then
   WScript.ConnectObject session,     "on"
   WScript.ConnectObject application, "on"
End If
session.findById("wnd[0]").maximize
session.findById("wnd[0]/tbar[0]/okcd").text = "/nlt10"
session.findById("wnd[0]").sendVKey 0
session.findById("wnd[0]/usr/ctxtS1_LGTYP-LOW").text = "pes"
session.findById("wnd[0]/usr/ctxtS1_LGPLA-LOW").text = "pesagem"
session.findById("wnd[0]/usr/ctxtS1_LGPLA-LOW").setFocus
session.findById("wnd[0]/usr/ctxtS1_LGPLA-LOW").caretPosition = 7
session.findById("wnd[0]/tbar[1]/btn[16]").press
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/cntlSUB_CONTAINER/shellcont/shellcont/shell/shellcont[1]/shell").expandNode "         48"
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/cntlSUB_CONTAINER/shellcont/shellcont/shell/shellcont[1]/shell").selectNode "         54"
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/cntlSUB_CONTAINER/shellcont/shellcont/shell/shellcont[1]/shell").topNode = "         48"
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/cntlSUB_CONTAINER/shellcont/shellcont/shell/shellcont[1]/shell").doubleClickNode "         54"
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/ssubSUBSCREEN_CONTAINER:SAPLSSEL:1106/ctxt%%DYN001-LOW").text = "s"
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/ssubSUBSCREEN_CONTAINER:SAPLSSEL:1106/ctxt%%DYN001-LOW").setFocus
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/ssubSUBSCREEN_CONTAINER:SAPLSSEL:1106/ctxt%%DYN001-LOW").caretPosition = 1
session.findById("wnd[0]/tbar[1]/btn[8]").press
session.findById("wnd[0]/tbar[1]/btn[45]").press
session.findById("wnd[0]/tbar[1]/btn[48]").press
session.findById("wnd[1]/usr/chkRL03T-SQUIT").selected = true
session.findById("wnd[1]/usr/ctxtLAGP-LGTYP").text = "999"
session.findById("wnd[1]/usr/ctxtLAGP-LGPLA").text = "ajuste"
session.findById("wnd[1]/usr/chkRL03T-SQUIT").setFocus
session.findById("wnd[1]/tbar[0]/btn[0]").press
session.findById("wnd[0]/tbar[1]/btn[44]").press
session.findById("wnd[0]/tbar[0]/okcd").text = "/n"
session.findById("wnd[0]").sendVKey 0
'''


def run_sap_vbs_script(vbs_content: str, timeout_seconds: int = 120) -> Tuple[bool, str]:
    """
    Salva o conteúdo em um arquivo VBS temporário e executa via cscript.exe.
    """
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile("w", suffix=".vbs", delete=False, encoding="latin1") as tf:
            tf.write(vbs_content)
            tmp_path = Path(tf.name)

        t0 = time.perf_counter()
        proc = subprocess.run(
            ["cscript.exe", "//nologo", str(tmp_path)],
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        )
        elapsed = time.perf_counter() - t0

        if proc.returncode != 0:
            err_msg = proc.stderr.strip() or proc.stdout.strip() or f"Código de saída: {proc.returncode}"
            logger.error("Execução VBScript SAP falhou em %.1fs: %s", elapsed, err_msg)
            return False, err_msg

        logger.info("VBScript SAP executado com sucesso em %.1fs.", elapsed)
        return True, f"Sucesso em {elapsed:.1f}s"

    except subprocess.TimeoutExpired:
        logger.error("Execução do script SAP excedeu o tempo limite de %ds.", timeout_seconds)
        return False, f"Timeout de {timeout_seconds}s excedido no SAP."
    except Exception as exc:
        logger.error("Erro inesperado ao executar script SAP: %s", exc, exc_info=True)
        return False, str(exc)
    finally:
        if tmp_path and tmp_path.exists():
            try:
                tmp_path.unlink(missing_ok=True)
            except Exception:
                pass


class SapAutomationWorker:
    """
    Worker em background que consulta periodicamente a API do dashboard por
    comandos de automação SAP pendentes (ex: movermigo / mover ajuste / extrair relatório).
    """

    def __init__(
        self,
        poll_interval: float = 4.0,
        on_success_trigger: Optional[Callable[[], None]] = None,
        command_handler: Optional[Callable[[str, Optional[str]], Tuple[bool, str]]] = None,
    ):
        self.poll_interval = poll_interval
        self.on_success_trigger = on_success_trigger
        self.command_handler = command_handler
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_loop, daemon=True, name="sap-automation-worker")
        self._thread.start()
        logger.info("Worker de automações SAP iniciado (polling a cada %.1fs).", self.poll_interval)

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=3)
        logger.info("Worker de automações SAP parado.")

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                job = db.fetch_pending_sap_automation()
                if job:
                    job_id = int(job['id'])
                    command = str(job.get('command', 'movermigo')).lower()
                    requested_by = job.get('requested_by', 'Dashboard')
                    logger.info("Nova solicitação de automação SAP recebida! Job #%d [%s] por %s", job_id, command, requested_by)

                    tray.notify(
                        "Planilha Sync — SAP",
                        f"Executando comando '{command}' solicitado por {requested_by}..."
                    )

                    # Executa via command_handler personalizado ou executa VBScript padrão
                    if self.command_handler:
                        ok, msg = self.command_handler(command, job.get('script_code'))
                    else:
                        vbs_code = job.get('script_code') or DEFAULT_MOVERMIGO_SCRIPT
                        ok, msg = run_sap_vbs_script(vbs_code)

                    status = 'completed' if ok else 'failed'
                    db.complete_sap_automation(job_id, status=status, message=msg)

                    if ok:
                        logger.info("Job SAP #%d concluído com sucesso: %s", job_id, msg)
                        tray.notify(
                            "Planilha Sync — SAP",
                            f"Comando '{command}' executado com sucesso no SAP!"
                        )
                        # Dispara sincronização / extração para atualizar dashboard
                        if self.on_success_trigger:
                            try:
                                self.on_success_trigger()
                            except Exception as e:
                                logger.error("Erro ao disparar callback pós-automação: %s", e)
                    else:
                        logger.error("Job SAP #%d FALHOU: %s", job_id, msg)
                        tray.notify(
                            "Planilha Sync — Erro SAP",
                            f"Falha ao executar '{command}': {msg}"
                        )

            except Exception as exc:
                logger.debug("Erro no loop de automação SAP: %s", exc)

            if self._stop_event.wait(timeout=self.poll_interval):
                break
