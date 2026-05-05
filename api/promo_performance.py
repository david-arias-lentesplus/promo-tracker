"""
📄 /api/promo_performance.py  — Ventas agrupadas por coupon_code (Metabase DWH)
GET /api/promo_performance?date_from=2026-04-01&date_to=2026-05-01&country=AR

Retorna: coupon_code, country, total_orders, completed_orders,
         canceled_orders, conversion_rate, gmv_usd, avg_order_value

Formato real del MCP (SSE):
  event: message
  data: {"result":{"content":[{"type":"text","text":"{\"success\":true,\"data\":{\"0\":{...},\"1\":{...}}}"}]},...}
"""
import sys, os
_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

import json
import ssl
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from _auth import validate_token, json_response

# ── Config ────────────────────────────────────────────────────
_MCP_URL = (
    os.environ.get('METABASE_MCP_URL', '').strip()
    or 'https://mcp.livocompany.com/metabase/mcp'
)
_MCP_KEY = (
    os.environ.get('METABASE_MCP_KEY', '').strip()
    or 'af7bd32eba834141058b8b453f07db8437dbd140bac1c92499e445e63912776b'
)
_DWH_ID = 2

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode    = ssl.CERT_NONE

# ── SQL ───────────────────────────────────────────────────────
_SQL = """
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
  AND coupon_code IS NOT NULL
  AND coupon_code <> ''
  AND updated_at BETWEEN '{date_from}' AND '{date_to}'
  {country_filter}
GROUP BY coupon_code, country
ORDER BY completed_orders DESC
"""


def _build_sql(date_from, date_to, country):
    cf = (
        f"AND country = '{country}'"
        if country and country.upper() not in ('', 'TODOS', 'ALL')
        else ''
    )
    return _SQL.format(date_from=date_from, date_to=date_to, country_filter=cf)


def _parse_sse(raw_bytes):
    """
    Extrae el primer objeto JSON-RPC de una respuesta SSE.
    Formato observado:
      event: message
      data: {"result":{...},"jsonrpc":"2.0","id":1}
    """
    text = raw_bytes.decode('utf-8', errors='replace')

    # Intento: JSON puro (por si el servidor cambia de transporte)
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass

    # Parseo SSE línea a línea
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith('data:'):
            continue
        chunk = line[5:].strip()
        if not chunk or chunk == '[DONE]':
            continue
        try:
            obj = json.loads(chunk)
            if isinstance(obj, dict):
                return obj
        except Exception:
            continue

    raise ValueError(f'Respuesta MCP no reconocida: {text[:500]}')


def _rows_from_inner(inner_text):
    """
    Extrae lista de dicts desde el JSON interno del MCP.

    Formatos soportados del campo 'data':
      A) {"0": {"col": val}, "1": {...}, ...}   ← formato real observado
      B) [{"col": val}, ...]                    ← lista directa
      C) {"rows": [[...]], "columns": [...]}    ← filas + columnas separadas
    """
    if not inner_text:
        return []

    d = json.loads(inner_text)

    if not isinstance(d, dict):
        if isinstance(d, list):
            return d
        return []

    if not d.get('success', True) is False:
        pass  # continuar aunque success sea True o no exista

    data = d.get('data', None)

    if data is None:
        # Quizás el resultado YA es la estructura de filas directamente
        if 'rows' in d and 'columns' in d:
            return [dict(zip(d['columns'], r)) for r in d['rows']]
        return []

    # Formato A: {"0": {...}, "1": {...}}  (objeto indexado)
    if isinstance(data, dict):
        # Si las keys son dígitos → filas indexadas
        if all(k.isdigit() for k in data.keys()):
            n = len(data)
            return [data[str(i)] for i in range(n) if str(i) in data]
        # Quizás es {"rows": ..., "cols": ...}
        if 'rows' in data:
            rows = data['rows']
            cols = [c['name'] for c in data.get('cols', [])]
            if cols:
                return [dict(zip(cols, r)) for r in rows]
            return rows

    # Formato B: lista directa
    if isinstance(data, list):
        return data

    return []


def _call_metabase(sql):
    payload = json.dumps({
        'jsonrpc': '2.0', 'id': 1,
        'method':  'tools/call',
        'params':  {
            'name':      'execute',
            'arguments': {'database_id': _DWH_ID, 'query': sql, 'row_limit': 500},
        },
    }).encode('utf-8')

    url = f'{_MCP_URL}?api_key={_MCP_KEY}'
    req = urllib.request.Request(
        url, data=payload, method='POST',
        headers={
            'Content-Type': 'application/json',
            'Accept':       'application/json, text/event-stream',
        },
    )

    with urllib.request.urlopen(req, timeout=45, context=_SSL_CTX) as resp:
        raw = resp.read()
    import sys
    print(f'[MCP DEBUG] status=200 len={len(raw)} raw[:300]={raw[:300]}', file=sys.stderr)

    rpc = _parse_sse(raw)

    # Error JSON-RPC estándar
    if 'error' in rpc:
        raise ValueError(f"MCP error: {rpc['error']}")

    result = rpc.get('result', {})

    # Error de aplicación marcado con isError:true
    if result.get('isError'):
        content_err = result.get('content', [])
        msg = content_err[0].get('text', 'Error desconocido del MCP') if content_err else 'Error desconocido del MCP'
        raise ValueError(f"MCP respondió con error: {msg}")

    content = result.get('content', [])
    if not content:
        return []

    inner_text = content[0].get('text', '') if isinstance(content, list) else ''
    return _rows_from_inner(inner_text)


def _format_rows(rows):
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
            'conversion_rate':  round(completed / total * 100, 1) if total else 0.0,
            'gmv_usd':          float(r.get('gmv_usd')         or 0),
            'avg_order_value':  float(r.get('avg_order_value') or 0),
        })
    return out


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
        date_from = (qs.get('date_from', [''])[0] or '').strip()
        date_to   = (qs.get('date_to',   [''])[0] or '').strip()
        country   = (qs.get('country',   [''])[0] or '').strip()

        if not date_from or not date_to:
            from datetime import date, timedelta
            today            = date.today()
            first_day        = today.replace(day=1)
            last_month_end   = first_day - timedelta(days=1)
            last_month_start = last_month_end.replace(day=1)
            date_from        = str(last_month_start)
            date_to          = str(last_month_end)

        try:
            rows = _call_metabase(_build_sql(date_from, date_to, country))
            data = _format_rows(rows)
            return json_response(self, 200, {
                'status': 'ok', 'date_from': date_from,
                'date_to': date_to, 'country': country,
                'total': len(data), 'data': data,
            })
        except urllib.error.HTTPError as e:
            body = ''
            try: body = e.read().decode('utf-8', errors='replace')[:300]
            except Exception: pass
            return json_response(self, 502, {
                'status': 'error',
                'message': f'HTTP {e.code} desde MCP: {e.reason} — {body}',
            })
        except urllib.error.URLError as e:
            return json_response(self, 502, {
                'status': 'error',
                'message': f'No se pudo conectar al DWH: {e.reason}',
            })
        except Exception as e:
            import traceback
            return json_response(self, 500, {
                'status': 'error', 'message': str(e),
                'traceback': traceback.format_exc(),
            })

    def log_message(self, *args):
        pass
