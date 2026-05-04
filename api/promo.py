"""
📄 /api/promo.py  — Endpoint unificado de Promo Performance (Metabase DWH)

Modos (parámetro ?mode=):
  performance  → ventas agrupadas por coupon_code  (Silver.sales)
  orders       → órdenes de un cupón               (Silver.sales)
  products     → productos de una orden             (Silver.sales_products)
"""
import sys, os
_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

import json, ssl, urllib.request, urllib.error
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


# ── MCP core ─────────────────────────────────────────────────
def _mcp_call(sql):
    payload = json.dumps({
        'jsonrpc':'2.0','id':1,'method':'tools/call',
        'params':{'name':'execute','arguments':{'database_id':_DWH_ID,'query':sql,'row_limit':500}},
    }).encode()
    req = urllib.request.Request(
        f'{_MCP_URL}?api_key={_MCP_KEY}', data=payload, method='POST',
        headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream'},
    )
    with urllib.request.urlopen(req, timeout=45, context=_SSL_CTX) as r:
        raw = r.read()
    rpc    = _parse_sse(raw)
    result = rpc.get('result', {})
    if result.get('isError'):
        content = result.get('content', [])
        raise ValueError(content[0].get('text','MCP error') if content else 'MCP error')
    if 'error' in rpc:
        raise ValueError(str(rpc['error']))
    content = result.get('content', [])
    if not content:
        return []
    return _rows_from_text(content[0].get('text','') if isinstance(content,list) else '')


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
