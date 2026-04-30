"""
📄 /api/scraper_stats.py — Browserless usage stats (admin only)

GET /api/scraper_stats → devuelve historial y consumo mensual de Browserless
"""
import sys, os
_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

from http.server import BaseHTTPRequestHandler
from _auth import validate_admin, json_response, load_scraper_stats


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.end_headers()

    def do_GET(self):
        is_admin, msg, _ = validate_admin(dict(self.headers))
        if not is_admin:
            return json_response(self, 403, {'status': 'error', 'message': msg})

        try:
            stats = load_scraper_stats()
            return json_response(self, 200, {'status': 'ok', 'stats': stats})
        except Exception as e:
            return json_response(self, 500, {'status': 'error', 'message': str(e)})

    def log_message(self, format, *args):
        pass
