"""
📄 /api/hs_info.py  — Agente 3: Home Sliders Info
GET /api/hs_info?country=CO&date_from=2026-04-01&date_to=2026-04-30

Retorna los banners/home-sliders que deben estar activos en el e-commerce,
agrupados por Fabricante + Promocion marca + Rango de fechas.
Incluye alerta si la promo vence en 3 días o menos.
"""
import sys, os
_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

import time
from datetime import date as _date, datetime, timezone
from collections import defaultdict
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from _auth         import validate_token, json_response
from _data_service import fetch_csv_text, load_image_map, parse_csv, apply_filters

# ─── Helpers ──────────────────────────────────────────────────

def _today() -> _date:
    return datetime.now(timezone.utc).date()

def _days_remaining(date_end_str: str) -> int | None:
    """Días hasta el vencimiento de la promo (negativo = ya venció)."""
    if not date_end_str:
        return None
    try:
        de = _date.fromisoformat(date_end_str)
        return (de - _today()).days
    except Exception:
        return None

def _group_key(row: dict) -> tuple:
    return (
        row['fabricante'],
        row['promo_marca'],
        row['date_start'],
        row['date_end'],
    )

def build_slider_groups(records: list) -> list:
    """
    Agrupa registros por (fabricante, promo_marca, date_start, date_end).
    Dentro de cada grupo lista todos los productos únicos.
    """
    groups: dict[tuple, dict] = {}

    for r in records:
        key = _group_key(r)
        if key not in groups:
            dr = _days_remaining(r['date_end'])
            groups[key] = {
                'fabricante':       r['fabricante'],
                'promo_marca':      r['promo_marca'],
                'tipo_promo':       r['tipo_promo'],
                'tipo_campana':     r['tipo_campana'],
                'nombre_campana':   r['nombre_campana'],
                'date_start':       r['date_start'],
                'date_end':         r['date_end'],
                'days_remaining':   dr,
                'is_expiring_soon': dr is not None and 0 <= dr <= 3,
                'is_expired':       dr is not None and dr < 0,
                'pais':             r['pais'],
                'pais_nombre':      r['pais_nombre'],
                'products':         [],
                '_seen_skus':       set(),
            }
        grp = groups[key]
        sku = r['sku']
        if sku not in grp['_seen_skus']:
            grp['_seen_skus'].add(sku)
            grp['products'].append({
                'sku':          sku,
                'product_name': r['product_name'],
                'url_image':    r['url_image'],
                'desc_pct':     r['total_desc_pct'],
            })

    # Ordenar: vence antes primero, luego alfabético por fabricante
    result = []
    for g in groups.values():
        del g['_seen_skus']  # limpiar campo interno
        result.append(g)

    result.sort(key=lambda g: (
        g['is_expired'],                         # expirados al final
        g['days_remaining'] if g['days_remaining'] is not None else 9999,
        g['fabricante'].lower(),
    ))
    return result


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
        country   = qs.get('country',   [''])[0].strip()
        date_from = qs.get('date_from', [''])[0].strip()
        date_to   = qs.get('date_to',   [''])[0].strip()

        try:
            t0        = time.time()
            image_map = load_image_map()
            raw_text  = fetch_csv_text()
            all_rows  = parse_csv(raw_text, image_map)

            # Filtrar: país + fechas + solo Activos
            filtered = apply_filters(
                all_rows,
                country=country,
                date_from=date_from,
                date_to=date_to,
                status='Activo',
            )

            groups  = build_slider_groups(filtered)
            elapsed = round((time.time() - t0) * 1000)

            total_products = sum(len(g['products']) for g in groups)
            expiring_soon  = sum(1 for g in groups if g['is_expiring_soon'])

            return json_response(self, 200, {
                'status': 'ok',
                'data':   groups,
                'meta': {
                    'total_groups':    len(groups),
                    'total_products':  total_products,
                    'expiring_soon':   expiring_soon,
                    'today':           _today().isoformat(),
                    'elapsed_ms':      elapsed,
                }
            })

        except Exception as e:
            import traceback; traceback.print_exc()
            return json_response(self, 500, {'status': 'error', 'message': str(e)})

    def log_message(self, format, *args):
        pass
