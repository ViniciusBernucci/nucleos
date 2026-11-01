"""Compatibilidade: delega ao sincronizador único; diagnóstico por padrão."""
from pathlib import Path
import shutil
import subprocess
import sys

def main():
    node = shutil.which('node')
    if not node:
        raise SystemExit('Node.js não encontrado no PATH')
    script = Path(__file__).with_suffix('.mjs')
    return subprocess.run([node, str(script), *(sys.argv[1:] or ['--check'])], check=False).returncode

if __name__ == '__main__':
    raise SystemExit(main())
