"""
📄 /api/analytics.py  — Lista de productos para auditoría de promos
GET /api/analytics?country=CO&date_from=&date_to=
                  &status=&fabricante=&tipo_promo=&product_type=
                  &page=1&limit=50&search=

Retorna lista paginada de productos con:
  imagen, nombre, product_url, sku, status, fabricante,
  promo_marca, tipo_promo, tipo_campana, date_start, date_end,
  days_remaining, total_desc_pct, pais
"""
import sys, os
_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

import time
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from _auth         import validate_token, json_response
from _data_service import (fetch_csv_text, load_image_map, parse_csv,
                           apply_filters, strip_internal,
                           get_unique_types)


def _get_unique_fabricantes(records: list) -> list:
    seen = set()
    out  = []
    for r in records:
        f = r.get('fabricante', '')
        if f and f not in seen:
            seen.add(f)
            out.append(f)
    return sorted(out)


def _get_unique_tipo_promo(records: list) -> list:
    seen = set()
    out  = []
    for r in records:
        t = r.get('tipo_promo', '')
        if t and t not in seen:
            seen.add(t)
            out.append(t)
    return sorted(out)


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

        qs           = parse_qs(urlparse(self.path).query)
        country      = qs.get('country',      [''])[0].strip()
        date_from    = qs.get('date_from',    [''])[0].strip()
        date_to      = qs.get('date_to',      [''])[0].strip()
        status       = qs.get('status',       [''])[0].strip()
        fabricante   = qs.get('fabricante',   [''])[0].strip()
        tipo_promo   = qs.get('tipo_promo',   [''])[0].strip()
        product_type = qs.get('product_type', [''])[0].strip()
        search       = qs.get('search',       [''])[0].strip()
        try:
            page  = max(1, int(qs.get('page',  ['1'])[0]))
            limit = min(200, max(1, int(qs.get('limit', ['50'])[0])))
        except ValueError:
            page, limit = 1, 50

        try:
            t0        = time.time()
            image_map = load_image_map()
            raw_text  = fetch_csv_text()
            all_rows  = parse_csv(raw_text, image_map)

            # Filter options from full dataset
            all_fabricantes = _get_unique_fabricantes(all_rows)
            all_tipo_promos = _get_unique_tipo_promo(all_rows)
            all_types       = get_unique_types(all_rows)

            # Apply standard filters
            filtered = apply_filters(
                all_rows,
                country=country, date_from=date_from, date_to=date_to,
                status=status, search=search, product_type=product_type,
            )

            # Extra filters: fabricante and tipo_promo (not in apply_filters)
            if fabricante:
                filtered = [r for r in filtered if r.get('fabricante', '').lower() == fabricante.lower()]
            if tipo_promo:
                filtered = [r for r in filtered if r.get('tipo_promo', '').lower() == tipo_promo.lower()]

            total     = len(filtered)
            total_pgs = max(1, -(-total // limit))
            page_rows = filtered[(page - 1) * limit : page * limit]
            elapsed   = round((time.time() - t0) * 1000)

            # Build clean output — only the fields Analytics needs
            def _fmt(r):
                s = strip_internal(r)
                return {
                    'sku':           s.get('sku', ''),
                    'product_name':  s.get('product_name', ''),
                    'product_url':   s.get('product_url', ''),
                    'image_url':     s.get('url_image', ''),
                    'fabricante':    s.get('fabricante', ''),
                    'pais':          s.get('pais', ''),
                    'pais_nombre':   s.get('pais_nombre', ''),
                    'status':        s.get('status', ''),
                    'promo_marca':   s.get('promo_marca', ''),
                    'tipo_promo':    s.get('tipo_promo', ''),
                    'tipo_campana':  s.get('tipo_campana', ''),
                    'nombre_campana':s.get('nombre_campana', ''),
                    'product_type':  s.get('product_type', ''),
                    'date_start':    s.get('date_start', ''),
                    'date_end':      s.get('date_end', ''),
                    'days_remaining':s.get('days_remaining'),
                    'total_desc_pct':s.get('total_desc_pct', 0),
                }

            return json_response(self, 200, {
                'status': 'ok',
                'data':   [_fmt(r) for r in page_rows],
                'meta': {
                    'total':            total,
                    'total_all':        len(all_rows),
                    'page':             page,
                    'limit':            limit,
                    'total_pages':      total_pgs,
                    'elapsed_ms':       elapsed,
                    'fabricantes':      all_fabricantes,
                    'tipo_promos':      all_tipo_promos,
                    'product_types':    all_types,
                },
            })

        except Exception as e:
            import traceback; traceback.print_exc()
            return json_response(self, 500, {'status': 'error', 'message': str(e)})

    def log_message(self, format, *args):
        pass
