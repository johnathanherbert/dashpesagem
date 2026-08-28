"""
build.py — Gera o executável standalone do Planilha Sync com PyInstaller.

Uso:
  python build.py --onefile   # Um único .exe standalone
  python build.py --onedir    # Pasta com executável + dependências
  python build.py --all       # Ambos os formatos
"""

import argparse
import os
import shutil
import sys
from pathlib import Path

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import PyInstaller.__main__

BASE_DIR = Path(__file__).parent.resolve()
BUILD_ASSETS_DIR = BASE_DIR / 'build_assets'

SPEC_CONFIG = {
    'name': 'planilha_sync',
    'console': True,   # True = janela de console visível (útil para debug em produção)
    'add_data': [
        f"{BASE_DIR / 'app'}{os.pathsep}app",
        f"{BASE_DIR / '.env.example'}{os.pathsep}.",
    ],
    'hidden_imports': [
        'pandas',
        'pandas._libs',
        'pandas._libs.tslibs',
        'pandas.io.formats.excel',
        'openpyxl',
        'openpyxl.cell',
        'openpyxl.styles',
        'openpyxl.utils',
        'psycopg2',
        'psycopg2.extras',
        'psycopg2.pool',
        'pystray',
        'PIL',
        'PIL.Image',
        'PIL.ImageDraw',
        'app',
        'app.config',
        'app.parser',
        'app.db',
        'app.sync',
        'app.watcher',
        'app.tray',
    ],
    'exclude_modules': [
        'flask',
        'jinja2',
        'werkzeug',
        'fastparquet',
        'scipy',
        'numba',
        'matplotlib',
        'tkinter',
        'pytest',
        'unittest',
    ],
}


def build_variant(onefile: bool = True) -> bool:
    mode_str = "One-File (.exe único)" if onefile else "One-Dir (pasta)"
    print(f"\n{'=' * 55}")
    print(f"[*] Compilando: {mode_str}")
    print(f"[*] Diretório base: {BASE_DIR}")
    print('=' * 55)

    dist_dir = BASE_DIR / 'dist'
    work_dir = BASE_DIR / 'build' / ('onefile' if onefile else 'onedir')

    args = [
        str(BASE_DIR / 'launcher.py'),
        f'--name={SPEC_CONFIG["name"]}',
        f'--distpath={dist_dir}',
        f'--workpath={work_dir}',
        '--specpath=.',
        '--onefile' if onefile else '--onedir',
        '--console' if SPEC_CONFIG['console'] else '--windowed',
        '--noconfirm',
        '--clean',
    ]

    for data in SPEC_CONFIG['add_data']:
        args.append(f'--add-data={data}')

    for imp in SPEC_CONFIG['hidden_imports']:
        args.append(f'--hidden-import={imp}')

    for exc in SPEC_CONFIG['exclude_modules']:
        args.append(f'--exclude-module={exc}')

    rthook = BUILD_ASSETS_DIR / 'rthooks' / 'pyi_rth_pyarrow_compat.py'
    if rthook.exists():
        args.append(f'--runtime-hook={rthook}')

    args.append('--copy-metadata=pandas')

    try:
        PyInstaller.__main__.run(args)

        is_win = sys.platform == 'win32'
        exe_suffix = '.exe' if is_win else ''

        if onefile:
            exe_path = dist_dir / f"{SPEC_CONFIG['name']}{exe_suffix}"
        else:
            exe_path = dist_dir / SPEC_CONFIG['name'] / f"{SPEC_CONFIG['name']}{exe_suffix}"

        if exe_path.exists():
            print(f"\n[OK] Build concluído!")
            print(f"[+] Executável: {exe_path}")
            print("[INFO] Copie o executável para a máquina de destino.")
            print("[INFO] Configure DATABASE_DIR e variáveis de banco via arquivo .env ou variáveis de ambiente.")
            return True
        else:
            print(f"\n[ERROR] Executável não encontrado em {exe_path}")
            return False

    except Exception as e:
        print(f"\n[ERROR] Falha durante o build: {e}")
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Build Planilha Sync Standalone")
    parser.add_argument('--onefile', action='store_true')
    parser.add_argument('--onedir',  action='store_true')
    parser.add_argument('--all',     action='store_true')
    args = parser.parse_args()

    os.chdir(BASE_DIR)

    if not (args.onefile or args.onedir or args.all):
        args.onefile = True

    success = True
    if args.all:
        success = build_variant(True) and build_variant(False)
    elif args.onefile:
        success = build_variant(True)
    elif args.onedir:
        success = build_variant(False)

    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
