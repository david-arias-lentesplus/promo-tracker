"""
📄 /api/notifications.py
GET /api/notifications?country=CO&days=7

Retorna promociones activas que vencen en los próximos `days` días
(default 7), una fila por producto, ordenadas por urgencia ascendente.

Cada item incluye:
  id, sku, product_name, fabricante, image_url,
  date_start, date_end, days_remaining, promo_marca, pais, pais_nombre
"""
import sys, os
_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

import time
from datetime import date as _date, datetime, timezone
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from _auth         import validate_token, json_response
from _data_service import (fetch_csv_text, load_image_map, parse_csv,
                           apply_filters, strip_internal)


def _make_id(r: dict) -> str:
    """Unique, stable notification ID for a product+promo combination."""
    key = f"{r.get('sku') or r.get('product_name', '')}_{r.get('date_end', '')}_{r.get('pais', '')}"
    return key.replace(' ', '_')


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

        qs      = parse_qs(urlparse(self.path).query)
        country = qs.get('country', [''])[0].strip()
        try:
            days = int(qs.get('days', ['7'])[0])
        except ValueError:
            days = 7

        try:
            t0        = time.time()
            image_map = load_image_map()
            raw_text  = fetch_csv_text()
            all_rows  = parse_csv(raw_text, image_map)
            today     = datetime.now(timezone.utc).date()

            # Active promos in any date range — we filter by days_remaining ourselves
            pool = apply_filters(all_rows, country=country, status='Activo')

            notifications = []
            seen_ids = set()

            for r in pool:
                dr = r.get('days_remaining')
                if dr is None or dr < 0 or dr > days:
                    continue

                nid = _make_id(r)
                if nid in seen_ids:
                    continue
                seen_ids.add(nid)

                item = strip_internal(r)
                item['id']            = nid
                item['days_remaining']= dr
                notifications.append(item)

            # Sort by urgency: fewest days first, then by product name
            notifications.sort(key=lambda n: (n['days_remaining'], n.get('product_name', '')))

            elapsed = round((time.time() - t0) * 1000)
            return json_response(self, 200, {
                'status':        'ok',
                'notifications': notifications,
                'total':         len(notifications),
                'threshold_days': days,
                'today':         today.isoformat(),
                'elapsed_ms':    elapsed,
            })

        except Exception as e:
            import traceback; traceback.print_exc()
            return json_response(self, 500, {'status': 'error', 'message': str(e)})

    def log_message(self, format, *args):
        pass
