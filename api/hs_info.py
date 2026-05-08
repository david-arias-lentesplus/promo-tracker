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

import json, time, ssl, urllib.request, urllib.error
from datetime import date as _date, datetime, timezone
from collections import defaultdict
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from _auth         import validate_token, json_response
from _data_service import fetch_csv_text, load_image_map, parse_csv, apply_filters

# ── ClickUp config ────────────────────────────────────────────
_CU_LIST_ID  = '11443787'   # Lista LENTESPLUS en espacio DISEÑO
_CU_ASSIGNEE = 3079982      # David Arias

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



# ─── Helpers ClickUp ─────────────────────────────────────────
_MESES_ES = ['ene','feb','mar','abr','may','jun',
             'jul','ago','sep','oct','nov','dic']

def _fmt_date(date_str: str) -> str:
    """2026-05-06  →  06 de may de 2026"""
    try:
        d = _date.fromisoformat(date_str)
        return f"{d.day:02d} de {_MESES_ES[d.month-1]} de {d.year}"
    except Exception:
        return date_str or ''

def build_task_description(groups: list) -> str:
    """
    Genera la descripción markdown de la tarea ClickUp.
    Estructura: país → fabricante → promo con fechas → productos.
    """
    by_country: dict[str, list] = {}
    for g in groups:
        pais = g.get('pais_nombre') or g.get('pais', 'Sin país')
        by_country.setdefault(pais, []).append(g)

    lines: list[str] = []
    for pais in sorted(by_country.keys()):
        lines.append('---')
        lines.append(f'🌎 {pais.upper()}')
        lines.append('---')
        lines.append('')

        by_fab: dict[str, list] = {}
        for g in by_country[pais]:
            by_fab.setdefault(g['fabricante'], []).append(g)

        for fab in sorted(by_fab.keys()):
            lines.append(f'**{fab}**')
            lines.append('')
            for g in by_fab[fab]:
                date_range = f"{_fmt_date(g['date_start'])} – {_fmt_date(g['date_end'])}"
                lines.append(f"  • {g['promo_marca']}  |  {date_range}")
                if g.get('nombre_campana'):
                    lines.append(f"    📋 {g['nombre_campana']}")
                lines.append('')
                lines.append('    Productos:')
                for p in g.get('products', []):
                    lines.append(f"    - {p['product_name']}")
            lines.append('')

    return '\n'.join(lines).rstrip()


def _cu_ssl_ctx():
    """SSL context sin verificación para llamadas a ClickUp (macOS local)."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx

def _cu_request(url: str, method: str = 'GET', data: bytes = None, api_token: str = '') -> dict:
    """Ejecuta una petición a la API de ClickUp y retorna el JSON."""
    headers = {'Authorization': api_token, 'Content-Type': 'application/json'}
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=15, context=_cu_ssl_ctx()) as r:
        return json.loads(r.read())

# ─── Handler ──────────────────────────────────────────────────
class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.end_headers()

    def do_POST(self):
        is_valid, msg = validate_token(dict(self.headers))
        if not is_valid:
            return json_response(self, 401, {'status': 'error', 'message': msg})

        try:
            length = int(self.headers.get('Content-Length', 0))
            body   = json.loads(self.rfile.read(length)) if length else {}
        except Exception:
            return json_response(self, 400, {'status': 'error', 'message': 'Body JSON inválido'})

        action = body.get('action', '')

        if action == 'create_clickup_task':
            date_from  = (body.get('date_from') or '').strip()
            task_name  = f"HS | SS | {date_from}" if date_from else "HS | SS"
            api_token  = os.environ.get('CLICKUP_API_TOKEN', '').strip()

            if not api_token:
                return json_response(self, 500, {
                    'status': 'error',
                    'message': 'CLICKUP_API_TOKEN no está configurado en el servidor.',
                })

            groups      = body.get('groups', [])
            description = build_task_description(groups) if groups else ''

            payload = json.dumps({
                'name':        task_name,
                'assignees':   [_CU_ASSIGNEE],
                'status':      'DAVID',
                'description': description,
            }).encode()

            try:
                result = _cu_request(
                    f'https://api.clickup.com/api/v2/list/{_CU_LIST_ID}/task',
                    method='POST', data=payload, api_token=api_token,
                )
            except urllib.error.HTTPError as e:
                body_err = ''
                try: body_err = e.read().decode('utf-8', errors='replace')[:300]
                except Exception: pass
                return json_response(self, 502, {
                    'status':  'error',
                    'message': f'ClickUp API error {e.code}: {body_err}',
                })

            return json_response(self, 200, {
                'status':    'ok',
                'task_id':   result.get('id'),
                'task_url':  result.get('url'),
                'task_name': task_name,
            })

        return json_response(self, 400, {'status': 'error', 'message': f'Acción desconocida: {action}'})

    def do_GET(self):
        is_valid, msg = validate_token(dict(self.headers))
        if not is_valid:
            return json_response(self, 401, {'status': 'error', 'message': msg})

        qs        = parse_qs(urlparse(self.path).query)
        country   = qs.get('country',   [''])[0].strip()
        date_from = qs.get('date_from', [''])[0].strip()
        date_to   = qs.get('date_to',   [''])[0].strip()

        # ── Listar tareas HS existentes en ClickUp ───────────────────
        mode = qs.get('mode', [''])[0].strip()
        if mode == 'tasks':
            api_token = os.environ.get('CLICKUP_API_TOKEN', '').strip()
            if not api_token:
                return json_response(self, 500, {'status': 'error', 'message': 'CLICKUP_API_TOKEN no configurado'})
            try:
                data = _cu_request(
                    f'https://api.clickup.com/api/v2/list/{_CU_LIST_ID}/task?include_closed=true&page=0',
                    api_token=api_token,
                )
                tasks = [
                    {
                        'id':     t.get('id'),
                        'name':   t.get('name'),
                        'status': t.get('status', {}).get('status', ''),
                        'color':  t.get('status', {}).get('color', '#6b7280'),
                        'url':    t.get('url'),
                    }
                    for t in data.get('tasks', [])
                    if (t.get('name') or '').startswith('HS | SS |')
                ]
                # Ordenar por nombre desc (más reciente primero)
                tasks.sort(key=lambda t: t['name'], reverse=True)
                return json_response(self, 200, {'status': 'ok', 'tasks': tasks})
            except urllib.error.HTTPError as e:
                body_err = ''
                try: body_err = e.read().decode('utf-8', errors='replace')[:300]
                except Exception: pass
                return json_response(self, 502, {'status': 'error', 'message': f'ClickUp error {e.code}: {body_err}'})
            except Exception as e:
                return json_response(self, 500, {'status': 'error', 'message': str(e)})

        try:
            t0        = time.time()
            image_map = load_image_map()
            raw_text  = fetch_csv_text()
            all_rows  = parse_csv(raw_text, image_map)

            # Filtrar: país + fechas
            # No se filtra por status='Activo' porque el campo refleja el estado *hoy*;
            # cuando se selecciona una fecha futura, las promos de ese período aún aparecen
            # como 'Inactivo' en el CSV aunque deban mostrarse. El solapamiento de fechas
            # ya garantiza que solo se muestran las promos vigentes en el rango elegido.
            filtered = apply_filters(
                all_rows,
                country=country,
                date_from=date_from,
                date_to=date_to,
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
