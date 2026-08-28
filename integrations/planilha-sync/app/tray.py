"""
tray.py — Ícone na bandeja do sistema (Windows system tray).
Permite ao usuário abrir o log, forçar sync ou encerrar o serviço.
"""

from __future__ import annotations

import logging
import threading
from typing import Callable, Optional

logger = logging.getLogger(__name__)


def _create_tray_image():
    from PIL import Image, ImageDraw
    image = Image.new('RGBA', (64, 64), (255, 255, 255, 0))
    draw = ImageDraw.Draw(image)
    # Fundo azul arredondado
    draw.rounded_rectangle((4, 4, 60, 60), radius=14, fill=(0, 100, 60, 255))
    draw.rounded_rectangle((12, 12, 52, 52), radius=10, fill=(248, 250, 252, 255))
    # Ícone de planilha
    draw.rectangle((18, 20, 46, 26), fill=(0, 160, 80, 255))
    draw.rectangle((18, 30, 46, 36), fill=(0, 100, 60, 255))
    draw.rectangle((18, 40, 36, 46), fill=(80, 200, 120, 255))
    return image


def start_tray(
    shutdown_callback: Callable,
    force_sync_callback: Optional[Callable] = None,
    log_path: Optional[str] = None,
) -> bool:
    """
    Inicia o ícone na bandeja do sistema em thread daemon.

    :param shutdown_callback:   Chamado ao clicar "Encerrar"
    :param force_sync_callback: Chamado ao clicar "Sincronizar agora"
    :param log_path:            Caminho do arquivo de log (para "Abrir log")
    :return: True se pystray estiver disponível
    """
    try:
        import pystray
    except ImportError:
        logger.warning("pystray não disponível — sem ícone na bandeja.")
        return False

    def _quit(icon=None, item=None):
        shutdown_callback()
        if icon is not None:
            icon.stop()

    def _force_sync(icon=None, item=None):
        if force_sync_callback:
            threading.Thread(target=force_sync_callback, daemon=True).start()

    def _open_log(icon=None, item=None):
        if log_path:
            import subprocess, sys
            if sys.platform == 'win32':
                subprocess.Popen(['notepad', log_path])
            else:
                subprocess.Popen(['xdg-open', log_path])

    menu_items = [
        pystray.MenuItem('Planilha Sync — dashpesagem', None, enabled=False),
        pystray.Menu.SEPARATOR,
    ]
    if force_sync_callback:
        menu_items.append(pystray.MenuItem('Sincronizar agora', _force_sync))
    if log_path:
        menu_items.append(pystray.MenuItem('Abrir log', _open_log))
    menu_items.append(pystray.Menu.SEPARATOR)
    menu_items.append(pystray.MenuItem('Encerrar', _quit))

    icon = pystray.Icon(
        'planilha-sync',
        _create_tray_image(),
        'Planilha Sync',
        menu=pystray.Menu(*menu_items),
    )
    threading.Thread(target=icon.run, daemon=True, name="tray-thread").start()
    logger.info("Ícone de bandeja iniciado.")
    return True
