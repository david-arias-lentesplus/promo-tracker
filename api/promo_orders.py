"""
📄 /api/promo_orders.py  — Órdenes y productos de promos (Metabase DWH)

Modos:
  GET /api/promo_orders?mode=orders&coupon_code=XXX&date_from=&date_to=&country=
      → órdenes de Silver.sales para ese cupón

  GET /api/promo_orders?mode=products&order_number=XXX
      → productos de Silver.sales_products para esa orden
"""
import sys, os
_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

import json, time, ssl, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from _auth import validate_token, json_response

_MCP_URL = (os.environ.get('METABASE_MCP_URL', '') or 'https://mcp.livocompany.com/metabase/mcp')
_MCP_KEY = (os.environ.get('METABASE_MCP_KEY', '') or 'af7bd32eba834141058b8b453f07db8437dbd140bac1c92499e445e63912776b')
_DWH_ID  = 2

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode    = ssl.CERT_NONE

# ── SQL ───────────────────────────────────────────────────────
_SQL_ORDERS = """
SELECT
    order_number,
    status,
    ROUND(total::numeric,    2) AS total,
    ROUND(gmv_usd::numeric,  2) AS gmv_usd,
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
    name,
    sku,
    type,
    use_type,
    use_duration,
    manufacturer,
    formula,
    quantity_actual,
    ROUND(price_actual::numeric, 2) AS price_actual,
    ROUND(total::numeric,         2) AS total,
    status
FROM Silver.sales_products
WHERE order_number = '{order_number}'
  AND empresa = 'lentesplus'
ORDER BY name
"""


# ── MCP helpers ───────────────────────────────────────────────
# ── MCP session cache ────────────────────────────────────────────────────────
_mcp_session = {'endpoint': None, 'ts': 0}
_SESSION_TTL  = 25 * 60   # 25 min


def _sse_get_endpoint():
    """
    Open the MCP SSE stream with http.client (true streaming), read line-by-line
    until we find the 'endpoint' event, return the full POST URL with api_key.
    Returns None if the server rejects (bad key / unavailable).
    """
    import http.client as _hc
    parsed  = urlparse(_MCP_URL)
    host    = parsed.netloc
    path    = f'{parsed.path}?api_key={_MCP_KEY}'
    base    = f'{parsed.scheme}://{parsed.netloc}'

    try:
        conn = (_hc.HTTPSConnection(host, timeout=15, context=_SSL_CTX)
                if parsed.scheme == 'https' else _hc.HTTPConnection(host, timeout=15))
        conn.request('GET', path,
                     headers={'Accept': 'text/event-stream', 'Cache-Control': 'no-cache',
                               'Connection': 'close'})
        resp = conn.getresponse()

        if resp.status not in (200, 201):
            conn.close()
            return None          # bad API key or server error

        buf        = ''
        event_type = None

        for _ in range(400):    # read up to ~100 KB in 256-byte chunks
            try:
                chunk = resp.read(256)
            except Exception:
                break
            if not chunk:
                break
            buf += chunk.decode('utf-8', errors='replace')

            while '\n' in buf:
                line, buf = buf.split('\n', 1)
                line = line.rstrip('\r')

                if line.startswith('event:'):
                    event_type = line[6:].strip()
                elif line.startswith('data:'):
                    data = line[5:].strip()
                    if event_type == 'endpoint' or 'sessionId' in data or '/messages' in data:
                        conn.close()
                        if data.startswith('http'):
                            return data
                        if data.startswith('/'):
                            ep  = f'{base}{data}'
                            sep = '&' if '?' in ep else '?'
                            if 'api_key=' not in ep:
                                ep = f'{ep}{sep}api_key={_MCP_KEY}'
                            return ep
                elif line == '':
                    event_type = None   # blank line = end of SSE event block

        conn.close()
    except Exception:
        pass
    return None


def _mcp_call(sql):
    """Execute SQL via MCP with automatic SSE session establishment + retry."""
    global _mcp_session

    now = time.time()
    if not (_mcp_session['endpoint'] and (now - _mcp_session['ts']) < _SESSION_TTL):
        ep = _sse_get_endpoint()
        _mcp_session = {
            'endpoint': ep or f'{_MCP_URL}?api_key={_MCP_KEY}',
            'ts': now,
        }

    endpoint = _mcp_session['endpoint']

    payload = json.dumps({
        'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
        'params': {
            'name':      'execute',
            'arguments': {'database_id': _DWH_ID, 'query': sql, 'row_limit': 500},
        },
    }).encode()

    def _post(ep):
        req = urllib.request.Request(
            ep, data=payload, method='POST',
            headers={'Content-Type': 'application/json',
                     'Accept':       'application/json, text/event-stream'},
        )
        with urllib.request.urlopen(req, timeout=45, context=_SSL_CTX) as r:
            return r.read()

    # First attempt
    try:
        raw = _post(endpoint)
    except urllib.error.HTTPError as e:
        if e.code in (400, 401, 403, 404):
            _mcp_session['endpoint'] = None
            ep  = _sse_get_endpoint() or f'{_MCP_URL}?api_key={_MCP_KEY}'
            _mcp_session = {'endpoint': ep, 'ts': time.time()}
            raw = _post(ep)
        else:
            raise

    rpc = _parse_sse(raw)

    # Retry once on session-related JSON-RPC error
    if 'error' in rpc:
        err = rpc['error']
        msg = str(err.get('message', '') if isinstance(err, dict) else err)
        if 'session' in msg.lower() or 'bad request' in msg.lower():
            _mcp_session['endpoint'] = None
            ep  = _sse_get_endpoint() or f'{_MCP_URL}?api_key={_MCP_KEY}'
            _mcp_session = {'endpoint': ep, 'ts': time.time()}
            raw = _post(ep)
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


def _get_session_endpoint():
    """GET the MCP SSE URL, parse the 'endpoint' event, return the POST URL."""
    parsed  = urlparse(_MCP_URL)
    base    = f'{parsed.scheme}://{parsed.netloc}'
    sse_url = f'{_MCP_URL}?api_key={_MCP_KEY}'

    req = urllib.request.Request(
        sse_url, method='GET',
        headers={
            'Accept':        'text/event-stream',
            'Cache-Control': 'no-cache',
        },
    )
    buf = b''
    try:
        with urllib.request.urlopen(req, timeout=12, context=_SSL_CTX) as r:
            # Read up to 8 KB — enough to capture the endpoint event
            while len(buf) < 8192:
                chunk = r.read(512)
                if not chunk:
                    break
                buf += chunk
                # Stop as soon as we see a sessionId
                if b'sessionId' in buf or b'/messages' in buf:
                    break
    except Exception:
        return sse_url  # fallback: direct POST (old behaviour)

    text = buf.decode('utf-8', errors='replace')
    # SSE lines: "data: /metabase/mcp/messages?sessionId=abc123"
    for line in text.splitlines():
        line = line.strip()
        if line.startswith('data:'):
            data = line[5:].strip()
            if 'sessionId' in data or '/messages' in data:
                if data.startswith('http'):
                    ep = data
                elif data.startswith('/'):
                    ep = f'{base}{data}'
                    if 'api_key=' not in ep:
                        sep = '&' if '?' in ep else '?'
                        ep += f'{sep}api_key={_MCP_KEY}'
                else:
                    continue
                return ep

    return sse_url  # fallback


def _mcp_call(sql):
    """Execute SQL via MCP with automatic session establishment + retry."""
    global _mcp_session

    # Use cached endpoint if still fresh
    now = time.time()
    if _mcp_session['endpoint'] and (now - _mcp_session['ts']) < _SESSION_TTL:
        endpoint = _mcp_session['endpoint']
    else:
        endpoint = _get_session_endpoint()
        _mcp_session = {'endpoint': endpoint, 'ts': now}

    def _do_call(ep):
        payload = json.dumps({
            'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
            'params': {
                'name':      'execute',
                'arguments': {'database_id': _DWH_ID, 'query': sql, 'row_limit': 500},
            },
        }).encode()
        req = urllib.request.Request(
            ep, data=payload, method='POST',
            headers={
                'Content-Type': 'application/json',
                'Accept':       'application/json, text/event-stream',
            },
        )
        with urllib.request.urlopen(req, timeout=45, context=_SSL_CTX) as r:
            return r.read()

    try:
        raw = _do_call(endpoint)
    except urllib.error.HTTPError as e:
        if e.code in (400, 401, 403):
            # Session probably expired — refresh and retry once
            endpoint = _get_session_endpoint()
            _mcp_session = {'endpoint': endpoint, 'ts': time.time()}
            raw = _do_call(endpoint)
        else:
            raise

    rpc = _parse_sse(raw)

    # Retry once if session-related error in JSON-RPC body
    if 'error' in rpc:
        err_msg = str(rpc['error'].get('message', ''))
        if 'session' in err_msg.lower() or 'Bad Request' in err_msg:
            endpoint = _get_session_endpoint()
            _mcp_session = {'endpoint': endpoint, 'ts': time.time()}
            raw  = _do_call(endpoint)
            rpc  = _parse_sse(raw)
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
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass
    for line in text.splitlines():
        line = line.strip()
        if line.startswith('data:'):
            chunk = line[5:].strip()
            if not chunk or chunk == '[DONE]':
                continue
            try:
                obj = json.loads(chunk)
                if isinstance(obj, dict):
                    return obj
            except Exception:
                continue
    raise ValueError(f'Respuesta MCP no reconocida: {text[:300]}')


def _rows_from_text(inner_text):
    if not inner_text:
        return []
    d = json.loads(inner_text)
    if isinstance(d, list):
        return d
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
                cols = [c['name'] for c in data.get('cols', [])]
                rows = data['rows']
                return [dict(zip(cols, r)) for r in rows] if cols else rows
        if isinstance(data, list):
            return data
    return []


# ── Formatters ────────────────────────────────────────────────
def _fmt_orders(rows):
    out = []
    for r in rows:
        out.append({
            'order_number':   str(r.get('order_number') or ''),
            'status':         str(r.get('status')       or ''),
            'total':          float(r.get('total')        or 0),
            'gmv_usd':        float(r.get('gmv_usd')     or 0),
            'discount_total': float(r.get('discount_total') or 0),
            'updated_at':     str(r.get('updated_at')   or ''),
            'country':        str(r.get('country')       or ''),
        })
    return out


def _fmt_products(rows):
    out = []
    for r in rows:
        out.append({
            'name':           str(r.get('name')           or ''),
            'sku':            str(r.get('sku')            or ''),
            'type':           str(r.get('type')           or ''),
            'use_type':       str(r.get('use_type')       or ''),
            'use_duration':   str(r.get('use_duration')   or ''),
            'manufacturer':   str(r.get('manufacturer')   or ''),
            'formula':        str(r.get('formula')        or ''),
            'quantity':       int(r.get('quantity_actual') or 0),
            'price':          float(r.get('price_actual') or 0),
            'total':          float(r.get('total')        or 0),
            'status':         str(r.get('status')         or ''),
        })
    return out


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
            return json_response(self, 401, {'status': 'error', 'message': msg})

        qs   = parse_qs(urlparse(self.path).query)
        mode = (qs.get('mode', ['orders'])[0] or 'orders').strip()

        try:
            if mode == 'products':
                order_number = (qs.get('order_number', [''])[0] or '').strip()
                if not order_number:
                    return json_response(self, 400, {'status': 'error', 'message': 'order_number requerido'})
                sql  = _SQL_PRODUCTS.format(order_number=order_number.replace("'", "''"))
                rows = _mcp_call(sql)
                data = _fmt_products(rows)
                return json_response(self, 200, {'status': 'ok', 'order_number': order_number, 'data': data})

            else:  # mode == 'orders'
                coupon_code = (qs.get('coupon_code', [''])[0] or '').strip()
                date_from   = (qs.get('date_from',   [''])[0] or '').strip()
                date_to     = (qs.get('date_to',     [''])[0] or '').strip()
                country     = (qs.get('country',     [''])[0] or '').strip()

                if not coupon_code:
                    return json_response(self, 400, {'status': 'error', 'message': 'coupon_code requerido'})

                if not date_from or not date_to:
                    from datetime import date, timedelta
                    today = date.today(); first = today.replace(day=1)
                    end   = first - timedelta(days=1); start = end.replace(day=1)
                    date_from = str(start); date_to = str(end)

                cf  = f"AND country = '{country}'" if country and country.upper() not in ('','TODOS','ALL') else ''
                sql = _SQL_ORDERS.format(
                    coupon_code=coupon_code.replace("'", "''"),
                    date_from=date_from, date_to=date_to,
                    country_filter=cf,
                )
                rows = _mcp_call(sql)
                data = _fmt_orders(rows)
                return json_response(self, 200, {
                    'status': 'ok', 'coupon_code': coupon_code,
                    'total': len(data), 'data': data,
                })

        except urllib.error.HTTPError as e:
            body = ''
            try: body = e.read().decode('utf-8', errors='replace')[:200]
            except Exception: pass
            return json_response(self, 502, {'status': 'error', 'message': f'HTTP {e.code}: {body}'})
        except urllib.error.URLError as e:
            return json_response(self, 502, {'status': 'error', 'message': f'URLError: {e.reason}'})
        except Exception as e:
            import traceback
            return json_response(self, 500, {'status': 'error', 'message': str(e),
                                             'traceback': traceback.format_exc()})

    def log_message(self, *args):
        pass
