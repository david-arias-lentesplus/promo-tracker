"""
📄 /api/raw_data.py  — Agente 2: Data Engineer
GET /api/raw_data?page=1&limit=50&search=texto&status=Activo&country=CO&date_from=2024-01-01&date_to=2024-12-31
Descarga el CSV maestro de Google Drive, lo une con las imágenes por SKU
y retorna JSON paginado. Soporta filtros globales de país y rango de fechas.
"""
import sys, os
_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

import json, time
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from _auth         import validate_token, json_response
from _data_service import fetch_csv_text, load_image_map, parse_csv, apply_filters, get_unique_countries, strip_internal

# ─── Handler ──────────────────────────────────────────────────
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
        page      = max(1, int(qs.get('page',      ['1'])[0]))
        limit     = min(200, max(1, int(qs.get('limit', ['50'])[0])))
        search    = qs.get('search',    [''])[0].strip()
        status    = qs.get('status',    [''])[0].strip()
        country   = qs.get('country',   [''])[0].strip()
        date_from = qs.get('date_from', [''])[0].strip()
        date_to   = qs.get('date_to',   [''])[0].strip()

        try:
            t0         = time.time()
            image_map  = load_image_map()
            raw_text   = fetch_csv_text()
            all_rows   = parse_csv(raw_text, image_map)

            # Países disponibles (antes de filtrar)
            countries  = get_unique_countries(all_rows)

            # Aplicar todos los filtros
            filtered   = apply_filters(all_rows, country=country, date_from=date_from,
                                       date_to=date_to, search=search, status=status)
            total      = len(filtered)
            total_pgs  = max(1, -(-total // limit))
            page_rows  = filtered[(page - 1) * limit : page * limit]
            elapsed    = round((time.time() - t0) * 1000)

            return json_response(self, 200, {
                'status': 'ok',
                'data':   [strip_internal(r) for r in page_rows],
                'meta': {
                    'total':          total,
                    'total_all':      len(all_rows),
                    'page':           page,
                    'limit':          limit,
                    'total_pages':    total_pgs,
                    'images_loaded':  len(image_map) // 3,
                    'elapsed_ms':     elapsed,
                    'countries':      countries,
                }
            })

        except Exception as e:
            import traceback; traceback.print_exc()
            return json_response(self, 500, {'status': 'error', 'message': str(e)})

    def log_message(self, format, *args):
        pass
