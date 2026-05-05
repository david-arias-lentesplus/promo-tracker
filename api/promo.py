"""
📄 /api/promo.py  — Endpoint unificado de Promo Performance (Metabase DWH)

Modos (parámetro ?mode=):
  performance  → ventas agrupadas por coupon_code  (Silver.sales)
  orders       → órdenes de un cupón               (Silver.sales)
  products     → productos de una orden             (Silver.sales_products)
  tier_filters → fabricantes/tipos/duraciones únicos para dropdowns
  product_tier → top productos vendidos con promos (Silver.sales_products)

Análisis estadístico: 100% client-side en PromoPerformance.jsx (sin API externa).
"""
import sys, os
_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

import json, time, ssl, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from _auth import validate_token, json_response

_MCP_URL = (os.environ.get('METABASE_MCP_URL','') or 'https://mcp.livocompany.com/metabase/mcp')
_MCP_KEY = (os.environ.get('METABASE_MCP_KEY','') or 'af7bd32eba834141058b8b453f07db8437dbd140bac1c92499e445e63912776b')
_DWH_ID  = 2

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode    = ssl.CERT_NONE

# ── SQL ───────────────────────────────────────────────────────
_SQL_PERFORMANCE = """
SELECT
    coupon_code,
    country,
    COUNT(order_number)                                                              AS total_orders,
    COUNT(CASE WHEN status = 'complete'  THEN 1 END)                                 AS completed_orders,
    COUNT(CASE WHEN status = 'canceled'  THEN 1 END)                                 AS canceled_orders,
    ROUND(100.0 * COUNT(CASE WHEN status = 'complete' THEN 1 END) / NULLIF(COUNT(order_number),0), 2) AS conversion_rate,
    ROUND(SUM(CASE WHEN status = 'complete' THEN gmv_usd   ELSE 0 END)::numeric, 2)  AS gmv_usd,
    ROUND(AVG(CASE WHEN status = 'complete' THEN total     ELSE NULL END)::numeric, 2) AS avg_order_value
FROM Silver.sales
WHERE empresa = 'lentesplus'
  AND coupon_code IS NOT NULL AND coupon_code <> ''
  AND updated_at BETWEEN '{date_from}' AND '{date_to}'
  {country_filter}
GROUP BY coupon_code, country
ORDER BY completed_orders DESC
"""

_SQL_ORDERS = """
SELECT
    order_number,
    status,
    ROUND(total::numeric,         2) AS total,
    ROUND(gmv_usd::numeric,       2) AS gmv_usd,
    ROUND(discount_total::numeric, 2) AS discount_total,
    updated_at,
    country
FROM Silver.sales
WHERE empresa = 'lentesplus'
  AND coupon_code = '{coupon_code}'
  AND updated_at BETWEEN '{date_from}' AND '{date_to}'
  {country_filter}
ORDER BY updated_at DESC
"""

_SQL_PRODUCTS = """
SELECT
    name, sku, type, use_type, use_duration, manufacturer, formula,
    quantity_actual,
    ROUND(price_actual::numeric, 2) AS price_actual,
    ROUND(total::numeric,         2) AS total,
    status
FROM Silver.sales_products
WHERE order_number = '{order_number}'
  AND empresa = 'lentesplus'
ORDER BY name
"""


# ── MCP session cache ────────────────────────────────────────────────────────
_mcp_session = {'session_id': None, 'ts': 0}
_SESSION_TTL  = 25 * 60   # 25 min


def _mcp_init():
    """
    POST an MCP initialize request to get a session ID from the mcp-session-id header.
    Returns the session ID string, or None on failure.
    """
    import http.client as _hc
    from urllib.parse import urlparse as _up
    parsed = _up(_MCP_URL)
    host   = parsed.netloc

    payload = json.dumps({
        'jsonrpc': '2.0', 'id': 0, 'method': 'initialize',
        'params': {
            'protocolVersion': '2024-11-05',
            'capabilities':    {},
            'clientInfo':      {'name': 'livo-dashboard', 'version': '1.0'},
        },
    }).encode()

    try:
        conn = (_hc.HTTPSConnection(host, timeout=15, context=_SSL_CTX)
                if parsed.scheme == 'https' else _hc.HTTPConnection(host, timeout=15))
        conn.request('POST', f'{parsed.path}?api_key={_MCP_KEY}', body=payload,
                     headers={'Content-Type': 'application/json',
                               'Accept': 'application/json, text/event-stream',
                               'Connection': 'close'})
        resp = conn.getresponse()
        if resp.status not in (200, 201):
            conn.close()
            return None
        sid = None
        for hdr, val in resp.getheaders():
            if hdr.lower() == 'mcp-session-id':
                sid = val
                break
        resp.read()   # drain body
        conn.close()
        return sid
    except Exception:
        return None


def _mcp_call(sql):
    """Execute SQL via MCP: initialize to get session ID, then POST tools/call."""
    global _mcp_session

    now = time.time()
    if not (_mcp_session['session_id'] and (now - _mcp_session['ts']) < _SESSION_TTL):
        sid = _mcp_init()
        _mcp_session = {'session_id': sid, 'ts': now}

    session_id = _mcp_session['session_id']

    payload = json.dumps({
        'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
        'params': {
            'name':      'execute',
            'arguments': {'database_id': _DWH_ID, 'query': sql, 'row_limit': 500},
        },
    }).encode()

    def _do_post(sid):
        hdrs = {
            'Content-Type': 'application/json',
            'Accept':       'application/json, text/event-stream',
        }
        if sid:
            hdrs['Mcp-Session-Id'] = sid
        req = urllib.request.Request(
            f'{_MCP_URL}?api_key={_MCP_KEY}',
            data=payload, method='POST', headers=hdrs,
        )
        with urllib.request.urlopen(req, timeout=45, context=_SSL_CTX) as r:
            return r.read()

    try:
        raw = _do_post(session_id)
    except urllib.error.HTTPError as e:
        if e.code in (400, 401, 403):
            # Session expired — re-initialize and retry
            sid = _mcp_init()
            _mcp_session = {'session_id': sid, 'ts': time.time()}
            raw = _do_post(sid)
        else:
            raise

    rpc = _parse_sse(raw)

    # Retry once on session-related JSON-RPC error
    if 'error' in rpc:
        err = rpc['error']
        msg = str(err.get('message', '') if isinstance(err, dict) else err)
        if 'session' in msg.lower() or 'bad request' in msg.lower():
            sid = _mcp_init()
            _mcp_session = {'session_id': sid, 'ts': time.time()}
            raw = _do_post(sid)
            rpc = _parse_sse(raw)
        if 'error' in rpc:
            raise ValueError(str(rpc['error']))

    result = rpc.get('result', {})
    if result.get('isError'):
        content = result.get('content', [])
        raise ValueError(content[0].get('text', 'MCP error') if content else 'MCP error')

    content = result.get('content', [])
    if not content:
        return []
    return _rows_from_text(content[0].get('text', '') if isinstance(content, list) else '')


def _parse_sse(raw_bytes):
    text = raw_bytes.decode('utf-8', errors='replace')
    try:
        obj = json.loads(text)
        if isinstance(obj, dict): return obj
    except Exception: pass
    for line in text.splitlines():
        line = line.strip()
        if line.startswith('data:'):
            chunk = line[5:].strip()
            if not chunk or chunk == '[DONE]': continue
            try:
                obj = json.loads(chunk)
                if isinstance(obj, dict): return obj
            except Exception: continue
    raise ValueError(f'Respuesta MCP no reconocida: {text[:300]}')


def _rows_from_text(inner_text):
    if not inner_text: return []
    d = json.loads(inner_text)
    if isinstance(d, list): return d
    if isinstance(d, dict):
        data = d.get('data', None)
        if data is None:
            if 'rows' in d and 'columns' in d:
                return [dict(zip(d['columns'], r)) for r in d['rows']]
            return []
        if isinstance(data, dict):
            if all(k.isdigit() for k in data.keys()):
                return [data[str(i)] for i in range(len(data)) if str(i) in data]
            if 'rows' in data:
                cols = [c['name'] for c in data.get('cols',[])]
                rows = data['rows']
                return [dict(zip(cols,r)) for r in rows] if cols else rows
        if isinstance(data, list): return data
    return []


# ── Formatters ────────────────────────────────────────────────
def _fmt_performance(rows):
    out = []
    for r in rows:
        completed = int(r.get('completed_orders') or 0)
        total     = int(r.get('total_orders')     or 0)
        out.append({
            'coupon_code':      str(r.get('coupon_code') or ''),
            'country':          str(r.get('country')     or ''),
            'total_orders':     total,
            'completed_orders': completed,
            'canceled_orders':  int(r.get('canceled_orders') or 0),
            'conversion_rate':  round(completed/total*100,1) if total else 0.0,
            'gmv_usd':          float(r.get('gmv_usd')         or 0),
            'avg_order_value':  float(r.get('avg_order_value') or 0),
        })
    return out


def _fmt_orders(rows):
    return [{
        'order_number':   str(r.get('order_number') or ''),
        'status':         str(r.get('status')       or ''),
        'total':          float(r.get('total')        or 0),
        'gmv_usd':        float(r.get('gmv_usd')     or 0),
        'discount_total': float(r.get('discount_total') or 0),
        'updated_at':     str(r.get('updated_at')   or ''),
        'country':        str(r.get('country')       or ''),
    } for r in rows]


def _fmt_products(rows):
    return [{
        'name':         str(r.get('name')           or ''),
        'sku':          str(r.get('sku')            or ''),
        'type':         str(r.get('type')           or ''),
        'use_type':     str(r.get('use_type')       or ''),
        'use_duration': str(r.get('use_duration')   or ''),
        'manufacturer': str(r.get('manufacturer')   or ''),
        'formula':      str(r.get('formula')        or ''),
        'quantity':     int(r.get('quantity_actual') or 0),
        'price':        float(r.get('price_actual') or 0),
        'total':        float(r.get('total')        or 0),
        'status':       str(r.get('status')         or ''),
    } for r in rows]


def _default_dates():
    from datetime import date, timedelta
    today = date.today(); first = today.replace(day=1)
    end = first - timedelta(days=1); start = end.replace(day=1)
    return str(start), str(end)


def _country_filter(country):
    return f"AND country = '{country}'" if country and country.upper() not in ('','TODOS','ALL') else ''


# ── Handler ───────────────────────────────────────────────────
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
            return json_response(self, 401, {'status':'error','message':msg})

        qs      = parse_qs(urlparse(self.path).query)
        mode    = (qs.get('mode',['performance'])[0] or 'performance').strip()
        country = (qs.get('country',[''])[0] or '').strip()

        try:
            # ── mode=products ─────────────────────────────────
            if mode == 'products':
                order_number = (qs.get('order_number',[''])[0] or '').strip()
                if not order_number:
                    return json_response(self,400,{'status':'error','message':'order_number requerido'})
                rows = _mcp_call(_SQL_PRODUCTS.format(order_number=order_number.replace("'","''")))
                return json_response(self,200,{'status':'ok','order_number':order_number,'data':_fmt_products(rows)})

            # ── mode=orders ───────────────────────────────────
            elif mode == 'orders':
                coupon_code = (qs.get('coupon_code',[''])[0] or '').strip()
                if not coupon_code:
                    return json_response(self,400,{'status':'error','message':'coupon_code requerido'})
                date_from = (qs.get('date_from',[''])[0] or '').strip()
                date_to   = (qs.get('date_to',  [''])[0] or '').strip()
                if not date_from or not date_to:
                    date_from, date_to = _default_dates()
                sql  = _SQL_ORDERS.format(
                    coupon_code=coupon_code.replace("'","''"),
                    date_from=date_from, date_to=date_to,
                    country_filter=_country_filter(country),
                )
                rows = _mcp_call(sql)
                return json_response(self,200,{'status':'ok','coupon_code':coupon_code,
                                               'total':len(rows),'data':_fmt_orders(rows)})

            # ── mode=tier_filters ────────────────────────────
            elif mode == 'tier_filters':
                date_from = (qs.get('date_from',[''])[0] or '').strip()
                date_to   = (qs.get('date_to',  [''])[0] or '').strip()
                if not date_from or not date_to:
                    date_from, date_to = _default_dates()
                sql  = _SQL_TIER_FILTERS.format(
                    date_from=date_from, date_to=date_to,
                    country_filter=_country_filter(country),
                )
                rows = _mcp_call(sql)
                mfr = sorted({r.get('manufacturer','') for r in rows if r.get('manufacturer')})
                typ = sorted({r.get('product_type','')  for r in rows if r.get('product_type')})
                dur = sorted({r.get('use_duration','')  for r in rows if r.get('use_duration')})
                return json_response(self,200,{'status':'ok',
                    'manufacturers':mfr,'product_types':typ,'use_durations':dur})

            # ── mode=product_tier ────────────────────────────
            elif mode == 'product_tier':
                date_from    = (qs.get('date_from',    [''])[0] or '').strip()
                date_to      = (qs.get('date_to',      [''])[0] or '').strip()
                manufacturer = (qs.get('manufacturer', [''])[0] or '').strip()
                product_type = (qs.get('product_type', [''])[0] or '').strip()
                use_duration = (qs.get('use_duration', [''])[0] or '').strip()
                if not date_from or not date_to:
                    date_from, date_to = _default_dates()
                mf = f"AND sp.manufacturer = '{manufacturer.replace(chr(39),chr(39)*2)}'" if manufacturer else ''
                tf = f"AND sp.type = '{product_type.replace(chr(39),chr(39)*2)}'"         if product_type else ''
                uf = f"AND sp.use_duration = '{use_duration.replace(chr(39),chr(39)*2)}'" if use_duration else ''
                sql  = _SQL_PRODUCT_TIER.format(
                    date_from=date_from, date_to=date_to,
                    country_filter=_country_filter(country),
                    manufacturer_filter=mf, type_filter=tf, use_duration_filter=uf,
                )
                rows = _mcp_call(sql)
                data = [{'name':str(r.get('name') or ''),'sku':str(r.get('sku') or ''),
                          'product_type':str(r.get('product_type') or ''),
                          'use_type':str(r.get('use_type') or ''),
                          'use_duration':str(r.get('use_duration') or ''),
                          'manufacturer':str(r.get('manufacturer') or ''),
                          'order_count':int(r.get('order_count') or 0),
                          'total_quantity':int(r.get('total_quantity') or 0),
                          'total_gmv_usd':float(r.get('total_gmv_usd') or 0),
                          'avg_price':float(r.get('avg_price') or 0)} for r in rows]
                return json_response(self,200,{'status':'ok','date_from':date_from,
                    'date_to':date_to,'country':country,'total':len(data),'data':data})

            # ── mode=performance (default) ────────────────────
            else:
                date_from = (qs.get('date_from',[''])[0] or '').strip()
                date_to   = (qs.get('date_to',  [''])[0] or '').strip()
                if not date_from or not date_to:
                    date_from, date_to = _default_dates()
                sql  = _SQL_PERFORMANCE.format(
                    date_from=date_from, date_to=date_to,
                    country_filter=_country_filter(country),
                )
                rows = _mcp_call(sql)
                data = _fmt_performance(rows)
                return json_response(self,200,{'status':'ok','date_from':date_from,
                                               'date_to':date_to,'country':country,
                                               'total':len(data),'data':data})

        except urllib.error.HTTPError as e:
            body=''
            try: body=e.read().decode('utf-8',errors='replace')[:200]
            except Exception: pass
            return json_response(self,502,{'status':'error','message':f'HTTP {e.code}: {body}'})
        except urllib.error.URLError as e:
            return json_response(self,502,{'status':'error','message':f'URLError: {e.reason}'})
        except Exception as e:
            import traceback
            return json_response(self,500,{'status':'error','message':str(e),
                                           'traceback':traceback.format_exc()})

    def log_message(self, *args):
        pass


# ═══════════════════════════════════════════════════════════════
# MODO: product_tier
# Top productos vendidos en órdenes con cupón (Silver.sales_products)
# ═══════════════════════════════════════════════════════════════
_SQL_PRODUCT_TIER = """
SELECT
    sp.name,
    sp.sku,
    sp.type                         AS product_type,
    sp.use_type,
    sp.use_duration,
    sp.manufacturer,
    COUNT(DISTINCT sp.order_number) AS order_count,
    SUM(sp.quantity_actual)         AS total_quantity,
    ROUND(SUM(sp.gmv_usd)::numeric, 2) AS total_gmv_usd,
    ROUND(AVG(sp.price_actual)::numeric, 2) AS avg_price
FROM Silver.sales_products sp
WHERE sp.order_number IN (
    SELECT order_number FROM Silver.sales
    WHERE empresa = 'lentesplus'
      AND status = 'complete'
      AND coupon_code IS NOT NULL AND coupon_code <> ''
      AND updated_at BETWEEN '{date_from}' AND '{date_to}'
      {country_filter}
)
AND sp.empresa = 'lentesplus'
AND sp.name NOT ILIKE '%envío%'
AND sp.name NOT ILIKE '%envio%'
AND sp.name NOT ILIKE '%shipping%'
AND sp.name NOT ILIKE '%flete%'
AND (sp.type IS NOT NULL AND sp.type <> '')
{manufacturer_filter}
{type_filter}
{use_duration_filter}
GROUP BY sp.name, sp.sku, sp.type, sp.use_type, sp.use_duration, sp.manufacturer
ORDER BY total_quantity DESC
"""

_SQL_TIER_FILTERS = """
SELECT DISTINCT
    sp.manufacturer,
    sp.type   AS product_type,
    sp.use_duration
FROM Silver.sales_products sp
WHERE sp.order_number IN (
    SELECT order_number FROM Silver.sales
    WHERE empresa = 'lentesplus'
      AND status = 'complete'
      AND coupon_code IS NOT NULL AND coupon_code <> ''
      AND updated_at BETWEEN '{date_from}' AND '{date_to}'
      {country_filter}
)
AND sp.empresa = 'lentesplus'
AND sp.name NOT ILIKE '%envío%'
AND sp.name NOT ILIKE '%envio%'
AND (sp.type IS NOT NULL AND sp.type <> '')
ORDER BY sp.manufacturer, sp.type, sp.use_duration
"""
