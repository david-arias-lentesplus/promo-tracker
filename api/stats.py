"""
📄 /api/stats.py  — Agente 2: Data Engineer
GET /api/stats?country=CO&date_from=2024-01-01&date_to=2024-12-31
Retorna KPIs del dashboard: total_promos y active_promos
aplicando los mismos filtros globales que raw_data.
"""
import sys, os
_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

import time
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from _auth         import validate_token, json_response
from _data_service import fetch_csv_text, load_image_map, parse_csv, apply_filters, get_unique_countries

class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.end_headers()

    def do_GET(self):
        is_valid, msg = validate_token(dict(self.headers))
        if not is_valid:
            return json_response(self, 401, {'status': 'error', 'message': msg})

        qs        = parse_qs(urlparse(self.path).query)
        country   = qs.get('country',   [''])[0].strip()
        date_from = qs.get('date_from', [''])[0].strip()
        date_to   = qs.get('date_to',   [''])[0].strip()

        try:
            t0        = time.time()
            image_map = load_image_map()
            raw_text  = fetch_csv_text()
            all_rows  = parse_csv(raw_text, image_map)
            countries = get_unique_countries(all_rows)

            # Aplicar filtros de país + fecha (sin status ni search)
            filtered  = apply_filters(all_rows, country=country,
                                      date_from=date_from, date_to=date_to)

            total_promos  = len(filtered)
            active_promos = sum(
                1 for r in filtered
                if 'activo' in r.get('status', '').lower()
                and 'no' not in r.get('status', '').lower()
            )
            elapsed = round((time.time() - t0) * 1000)

            return json_response(self, 200, {
                'status': 'ok',
                'total_promos':  total_promos,
                'active_promos': active_promos,
                'total_all':     len(all_rows),
                'countries':     countries,
                'elapsed_ms':    elapsed,
            })

        except Exception as e:
            import traceback; traceback.print_exc()
            return json_response(self, 500, {'status': 'error', 'message': str(e)})

    def log_message(self, format, *args):
        pass
