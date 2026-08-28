"""
build.py — Gera o executavel standalone do Planilha Sync com PyInstaller.

Uso:
  python build.py           # onefile (padrao)
  python build.py --onedir  # pasta com dependencias (inicializacao mais rapida)
  python build.py --all     # ambos
"""

import argparse
import os
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
    'console': False,          # windowed — o loading terminal PowerShell cuida do feedback visual
    'add_data': [
        f"{BASE_DIR / 'app'}{os.pathsep}app",
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
        'requests',
        'requests.adapters',
        'urllib3',
        'urllib3.util.retry',
        'certifi',
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
        'psycopg2',
        'fastparquet',
        'scipy',
        'numba',
        'matplotlib',
        'tkinter',
        'pytest',
        'unittest',
        'IPython',
        'notebook',
    ],
}


def build_variant(onefile: bool = True) -> bool:
    mode = "One-File (.exe unico)" if onefile else "One-Dir (pasta)"
    print(f"\n{'=' * 50}")
    print(f"[*] Compilando: {mode}")
    print(f"[*] Base: {BASE_DIR}")
    print('=' * 50)

    dist_dir = BASE_DIR / 'dist'
    work_dir = BASE_DIR / 'build' / ('onefile' if onefile else 'onedir')

    args = [
        str(BASE_DIR / 'launcher.py'),
        f'--name={SPEC_CONFIG["name"]}',
        f'--distpath={dist_dir}',
        f'--workpath={work_dir}',
        '--specpath=.',
        '--onefile' if onefile else '--onedir',
        '--windowed',            # sem janela de console dupla
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

        exe_suffix = '.exe' if sys.platform == 'win32' else ''
        if onefile:
            exe_path = dist_dir / f"{SPEC_CONFIG['name']}{exe_suffix}"
        else:
            exe_path = dist_dir / SPEC_CONFIG['name'] / f"{SPEC_CONFIG['name']}{exe_suffix}"

        if exe_path.exists():
            print(f"\n[OK] Executavel: {exe_path}")
            print("[INFO] Copie o .exe para a maquina de destino e execute.")
            print("[INFO] A pasta database/ e o log sao criados automaticamente.")
            return True
        else:
            print(f"\n[ERROR] Executavel nao encontrado em {exe_path}")
            return False
    except Exception as e:
        print(f"\n[ERROR] Falha no build: {e}")
        return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--onefile', action='store_true')
    parser.add_argument('--onedir',  action='store_true')
    parser.add_argument('--all',     action='store_true')
    args = parser.parse_args()
    os.chdir(BASE_DIR)

    if not (args.onefile or args.onedir or args.all):
        args.onefile = True

    if args.all:
        return 0 if (build_variant(True) and build_variant(False)) else 1
    elif args.onedir:
        return 0 if build_variant(False) else 1
    return 0 if build_variant(True) else 1


if __name__ == '__main__':
    sys.exit(main())
