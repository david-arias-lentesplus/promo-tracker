"""
📄 /api/campaigns.py  — Agente 2: Email Marketing Campaigns
GET /api/campaigns?country=CO&date_from=2026-04-01&date_to=2026-04-30&product_type=

Retorna tres modelos de campaña:
  · bestseller  — 6 productos top de diferentes fabricantes (J&J prioritario)
  · fabricantes — grupos por fabricante+promo, igual que HS Info
  · gafas       — productos tipo=Gafas con promo activa (si existen)

Cada modelo/grupo incluye email_copy generado (Asunto, Asunto2, Preheader, Body, Botón).
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
from _data_service import (fetch_csv_text, load_image_map, parse_csv,
                           apply_filters, get_unique_types, strip_internal)

# ─── Email copy generator ─────────────────────────────────────

def _fmt_date(iso: str) -> str:
    if not iso: return ''
    try:
        d = _date.fromisoformat(iso)
        months = ['enero','febrero','marzo','abril','mayo','junio',
                  'julio','agosto','septiembre','octubre','noviembre','diciembre']
        return f"{d.day} de {months[d.month-1]}"
    except Exception:
        return iso

def _days_rem(date_end: str):
    try:
        return (_date.fromisoformat(date_end) - datetime.now(timezone.utc).date()).days
    except Exception:
        return None

def gen_copy_bestseller(products: list) -> dict:
    fabs      = list(dict.fromkeys(p['fabricante'] for p in products))[:3]
    fab_str   = ', '.join(fabs)
    max_desc  = max((p['total_desc_pct'] for p in products), default=0)
    promo_ex  = products[0]['promo_marca'] if products else ''
    return {
        'asunto':    f"¡Las mejores promos de lentes te esperan!",
        'asunto2':   f"Hasta {max_desc}% OFF — {fabs[0]} y más marcas premium" if max_desc else f"Promos exclusivas de {fabs[0]} y más",
        'preheader': f"Encuentra descuentos exclusivos de {fab_str} y más marcas en un solo correo.",
        'body':      (
            f"Hola,\n\n"
            f"Este mes llegaron las mejores promos en lentes de contacto. "
            f"Descuentos de hasta {max_desc}% OFF en marcas como {fab_str}.\n\n"
            f"{'• ' + chr(10).join('• ' + p['product_name'] + ' — ' + p['promo_marca'] for p in products[:6])}\n\n"
            f"¡No dejes pasar estas ofertas por tiempo limitado!"
        ),
        'boton':     "Ver todas las promos",
    }

def gen_copy_fabricante(group: dict) -> dict:
    fab      = group['fabricante']
    promo    = group['promo_marca']
    ds       = _fmt_date(group['date_start'])
    de       = _fmt_date(group['date_end'])
    prods    = group['products']
    n        = len(prods)
    sku_list = ', '.join(p['sku'] or p['product_name'] for p in prods[:5])
    return {
        'asunto':    f"{fab}: {promo}",
        'asunto2':   f"¡Aprovecha la promo de {fab} antes de que termine!",
        'preheader': f"{promo} — Válida del {ds} al {de} en {n} producto{'s' if n!=1 else ''}.",
        'body':      (
            f"Hola,\n\n"
            f"{fab} tiene una oferta especial para ti: {promo}.\n\n"
            f"Aplica en {n} producto{'s' if n!=1 else ''} seleccionado{'s' if n!=1 else ''}. "
            f"Válida del {ds} al {de}.\n\n"
            f"Productos incluidos: {sku_list}{'...' if n>5 else ''}.\n\n"
            f"¡No dejes pasar esta oportunidad!"
        ),
        'boton':     f"Ver productos {fab}",
    }

def gen_copy_gafas(group: dict) -> dict:
    fab   = group.get('fabricante', '')
    promo = group.get('promo_marca', '')
    de    = _fmt_date(group.get('date_end', ''))
    return {
        'asunto':    f"Promos especiales en Gafas — ¡No te las pierdas!",
        'asunto2':   f"{fab}: {promo}" if fab and promo else "Descuentos en gafas seleccionadas",
        'preheader': f"{promo} — Válida hasta el {de}." if promo else "Aprovecha los descuentos en gafas.",
        'body':      (
            f"Hola,\n\n"
            f"Tenemos promos increíbles en gafas para ti. "
            f"{'• ' + promo if promo else 'Descuentos especiales'} en productos de "
            f"{fab if fab else 'marcas seleccionadas'}.\n\n"
            f"¡Entra y encuentra las gafas perfectas!"
        ),
        'boton':     "Ver gafas en promo",
    }

# ─── BestSeller builder ───────────────────────────────────────

def build_bestseller(records: list, max_count: int = 6) -> list:
    # Excluir Gafas del BestSeller (tienen su propio modelo)
    pool = [r for r in records if r.get('product_type', '').lower() != 'gafas']

    by_fab: dict = defaultdict(list)
    for r in pool:
        by_fab[r['fabricante']].append(r)

    # Mejor producto por fabricante (mayor descuento)
    best: dict = {}
    for fab, prods in by_fab.items():
        best[fab] = max(prods, key=lambda p: p['total_desc_pct'])

    result = []
    jnj_prods = []  # todos los productos J&J, para rellenar si faltan slots

    # 1. J&J primero — guardar todos sus productos para el relleno
    jnj_key = next((k for k in best if 'johnson' in k.lower()), None)
    if jnj_key:
        result.append(strip_internal(best.pop(jnj_key)))
        # Todos los J&J ordenados por descuento (para usar como relleno)
        jnj_all = sorted(by_fab.get(jnj_key, []), key=lambda p: -p['total_desc_pct'])
        already = {result[0]['sku']} if result else set()
        jnj_prods = [strip_internal(p) for p in jnj_all if p['sku'] not in already]

    # 2. Resto de fabricantes ordenados por descuento desc
    remaining = sorted(best.values(), key=lambda p: -p['total_desc_pct'])
    result.extend(strip_internal(p) for p in remaining[:max_count - len(result)])

    # 3. Si no llegamos a max_count, rellenar con más productos J&J
    if len(result) < max_count and jnj_prods:
        needed = max_count - len(result)
        result.extend(jnj_prods[:needed])

    return result[:max_count]

# ─── Fabricantes builder ──────────────────────────────────────

def build_fabricantes(records: list) -> list:
    groups: dict = {}
    for r in records:
        key = (r['fabricante'], r['promo_marca'], r['date_start'], r['date_end'])
        if key not in groups:
            dr = _days_rem(r['date_end'])
            groups[key] = {
                'fabricante':       r['fabricante'],
                'promo_marca':      r['promo_marca'],
                'nombre_campana':   r['nombre_campana'],
                'tipo_promo':       r['tipo_promo'],
                'date_start':       r['date_start'],
                'date_end':         r['date_end'],
                'days_remaining':   dr,
                'is_expiring_soon': dr is not None and 0 <= dr <= 3,
                'pais':             r['pais'],
                'pais_nombre':      r['pais_nombre'],
                'products':         [],
                '_seen':            set(),
            }
        g = groups[key]
        # Para Gafas sin SKU, usar product_name como clave de deduplicación
        dedup_key = r['sku'] if r['sku'] else r['product_name']
        if dedup_key not in g['_seen']:
            g['_seen'].add(dedup_key)
            g['products'].append(strip_internal(r))

    result = []
    for g in groups.values():
        del g['_seen']
        g['email_copy'] = gen_copy_fabricante(g)
        result.append(g)

    result.sort(key=lambda g: (
        g['days_remaining'] if g['days_remaining'] is not None else 9999,
        g['fabricante'].lower(),
    ))
    return result

# ─── Gafas builder ────────────────────────────────────────────

def build_gafas(records: list) -> list:
    gafas = [r for r in records if r.get('product_type', '').lower() == 'gafas']
    groups = build_fabricantes(gafas)
    # Override email_copy con copia especializada para Gafas
    for g in groups:
        g['email_copy'] = gen_copy_gafas(g)
    return groups

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

        qs           = parse_qs(urlparse(self.path).query)
        country      = qs.get('country',      [''])[0].strip()
        date_from    = qs.get('date_from',    [''])[0].strip()
        date_to      = qs.get('date_to',      [''])[0].strip()
        product_type = qs.get('product_type', [''])[0].strip()

        try:
            t0        = time.time()
            image_map = load_image_map()
            raw_text  = fetch_csv_text()
            all_rows  = parse_csv(raw_text, image_map)

            # Pool: activos en el rango de fechas + país + tipo opcional
            pool = apply_filters(
                all_rows,
                country=country,
                date_from=date_from,
                date_to=date_to,
                status='Activo',
                product_type=product_type,
            )

            # Construir los tres modelos
            bs_products   = build_bestseller(pool)
            fab_groups    = build_fabricantes(pool)
            gafas_groups  = build_gafas(all_rows if not product_type else pool)

            # Email copy
            bs_copy = gen_copy_bestseller(bs_products) if bs_products else {}

            # Marcas únicas para filtro de fabricantes
            fab_names = sorted(set(r['fabricante'] for r in pool))

            elapsed = round((time.time() - t0) * 1000)
            return json_response(self, 200, {
                'status': 'ok',
                'bestseller': {
                    'products':   bs_products,
                    'email_copy': bs_copy,
                },
                'fabricantes': {
                    'groups':      fab_groups,
                    'brand_names': fab_names,
                },
                'gafas': {
                    'has_data': len(gafas_groups) > 0,
                    'groups':   gafas_groups,
                },
                'meta': {
                    'total_active': len(pool),
                    'unique_types': get_unique_types(all_rows),
                    'today':        datetime.now(timezone.utc).date().isoformat(),
                    'elapsed_ms':   elapsed,
                }
            })

        except Exception as e:
            import traceback; traceback.print_exc()
            return json_response(self, 500, {'status': 'error', 'message': str(e)})

    def log_message(self, format, *args):
        pass
