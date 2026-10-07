"""Serve the compiled demo on this computer, without Node.js dependencies."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import argparse
import os
import shutil
import subprocess
import sys
import threading
import webbrowser

parser = argparse.ArgumentParser(description='Iniciar demo local de dotación CMEstudios')
parser.add_argument('--port', type=int, default=5173)
parser.add_argument('--open', action='store_true', help='Abrir Google Chrome al iniciar')
args = parser.parse_args()
directory = Path(__file__).resolve().parent / 'dist'
if not (directory / 'index.html').is_file():
    raise SystemExit('Falta la carpeta dist. Descomprime el paquete completo o ejecuta npm run build.')
handler = partial(SimpleHTTPRequestHandler, directory=str(directory))
try:
    server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
except OSError as exc:
    raise SystemExit(f'No se pudo abrir el puerto {args.port}: {exc}. Prueba --port 5174.')
print(f'Demo CMEstudios: http://localhost:{args.port}', flush=True)
print('Abre esa dirección en tu navegador. Para detener: Ctrl+C.', flush=True)
def open_browser():
    url = f'http://localhost:{args.port}'
    try:
        if sys.platform == 'darwin':
            result = subprocess.run(['open', '-a', 'Google Chrome', url], check=False)
            if result.returncode == 0:
                return
        elif sys.platform == 'win32':
            for variable, suffix in [('PROGRAMFILES', 'Google/Chrome/Application/chrome.exe'),
                                     ('PROGRAMFILES(X86)', 'Google/Chrome/Application/chrome.exe'),
                                     ('LOCALAPPDATA', 'Google/Chrome/Application/chrome.exe')]:
                base = os.environ.get(variable)
                if base:
                    chrome = Path(base) / suffix
                    if chrome.is_file():
                        subprocess.Popen([str(chrome), url])
                        return
        else:
            for name in ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']:
                chrome = shutil.which(name)
                if chrome:
                    subprocess.Popen([chrome, url])
                    return
        webbrowser.open(url)
    except OSError:
        print(f'Abre manualmente {url} en Chrome.', flush=True)

if args.open:
    threading.Timer(0.5, open_browser).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
