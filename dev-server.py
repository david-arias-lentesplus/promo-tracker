#!/usr/bin/env python3
"""
📄 dev-server.py — Servidor de desarrollo local
Simula el runtime de Vercel Python serverless en localhost:8000.
Rutas las peticiones /api/<name> al handler correspondiente en /api/<name>.py

Uso:
  python3 dev-server.py

Requisitos:
  pip install PyJWT requests beautifulsoup4 pandas --break-system-packages
"""
import sys
import os
import importlib.util
from http.server import HTTPServer, BaseHTTPRequestHandler

API_DIR  = os.path.join(os.path.dirname(__file__), 'api')
PORT     = 8000


class DevRouter(BaseHTTPRequestHandler):
    """Enruta /api/<name>[?params] al handler de /api/<name>.py"""

    def _route(self):
        from urllib.parse import urlparse
        path     = urlparse(self.path).path.rstrip('/')
        segments = path.split('/')          # ['', 'api', 'login']

        if len(segments) < 3 or segments[1] != 'api':
            self._not_found()
            return

        name     = segments[2]              # e.g. 'login', 'raw_data'
        mod_path = os.path.join(API_DIR, f'{name}.py')

        if not os.path.isfile(mod_path):
            self._not_found()
            return

        # Agregar /api al path para que los imports relativos funcionen
        if API_DIR not in sys.path:
            sys.path.insert(0, API_DIR)

        try:
            spec = importlib.util.spec_from_file_location(name, mod_path)
            mod  = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)

            # Reutilizar la conexión: copiar __dict__ de self al target
            target = object.__new__(mod.handler)
            target.__dict__.update(self.__dict__)
            target.__class__ = mod.handler

            method_fn = getattr(target, f'do_{self.command}', None)
            if method_fn:
                method_fn()
            else:
                self.send_response(405)
                self.end_headers()

        except Exception as exc:
            import json, traceback
            traceback.print_exc()
            body = json.dumps({'status': 'error', 'message': str(exc)}).encode()
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(body)

    def _not_found(self):
        self.send_response(404)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"status":"error","message":"Endpoint not found"}')

    def do_GET(self):     self._route()
    def do_POST(self):    self._route()
    def do_PUT(self):     self._route()
    def do_PATCH(self):   self._route()
    def do_DELETE(self):  self._route()
    def do_OPTIONS(self): self._route()

    def log_message(self, fmt, *args):
        method = self.command
        path   = self.path
        code   = args[1] if len(args) > 1 else '?'
        color  = '\033[92m' if str(code).startswith('2') else '\033[91m'
        reset  = '\033[0m'
        print(f"  {color}{method:7} {path:<35} {code}{reset}")


if __name__ == '__main__':
    # Cargar variables de entorno desde .env si existe
    env_file = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.isfile(env_file):
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k.strip(), v.strip())
        print('  📄 Variables de .env cargadas')

    server = HTTPServer(('', PORT), DevRouter)
    print(f'\n  🚀 Dev API server corriendo en http://localhost:{PORT}')
    print(f'  📁 Sirviendo endpoints desde: {API_DIR}')
    print(f'  💡 Frontend: npm run dev  (en otra terminal)')
    print(f'  🛑 Ctrl+C para detener\n')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n  Dev server detenido.')
