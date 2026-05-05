"""
Temporary diagnostic endpoint — GET /api/mcp_debug
Shows exactly what the MCP server returns for SSE GET and direct POST.
Remove after debugging.
"""
import json, ssl, os, sys, http.client, time
import urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse

_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)
from _auth import json_response

_MCP_URL = os.environ.get('METABASE_MCP_URL','') or 'https://mcp.livocompany.com/metabase/mcp'
_MCP_KEY = os.environ.get('METABASE_MCP_KEY','') or 'af7bd32eba834141058b8b453f07db8437dbd140bac1c92499e445e63912776b'

_SSL = ssl.create_default_context()
_SSL.check_hostname = False
_SSL.verify_mode    = ssl.CERT_NONE


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin','*')
        self.send_header('Access-Control-Allow-Methods','GET,OPTIONS')
        self.send_header('Access-Control-Allow-Headers','Authorization,Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(_MCP_URL)
        host   = parsed.netloc
        base   = f'{parsed.scheme}://{parsed.netloc}'
        path   = f'{parsed.path}?api_key={_MCP_KEY}'
        result = {'mcp_url': _MCP_URL, 'key_prefix': _MCP_KEY[:8]+'...'}

        # ── Test 1: SSE streaming GET ─────────────────────────────
        try:
            conn = (http.client.HTTPSConnection(host, timeout=12, context=_SSL)
                    if parsed.scheme=='https' else http.client.HTTPConnection(host,timeout=12))
            conn.request('GET', path,
                headers={'Accept':'text/event-stream','Cache-Control':'no-cache','Connection':'close'})
            resp = conn.getresponse()
            result['get_status']  = resp.status
            result['get_headers'] = dict(resp.getheaders())

            buf = b''
            for _ in range(100):
                chunk = resp.read(512)
                if not chunk: break
                buf += chunk
                if b'sessionId' in buf or b'endpoint' in buf or len(buf) > 4096: break
            conn.close()
            result['get_body_preview'] = buf.decode('utf-8','replace')
            result['found_session_id'] = 'sessionId' in buf.decode()
            result['found_messages']   = '/messages' in buf.decode()
        except Exception as ex:
            result['get_error'] = str(ex)

        # ── Test 2: Direct POST (old approach — expected to fail) ─
        payload = json.dumps({
            'jsonrpc':'2.0','id':1,'method':'tools/call',
            'params':{'name':'execute','arguments':{'database_id':2,'query':'SELECT 1 AS ok','row_limit':1}}
        }).encode()
        direct_url = f'{_MCP_URL}?api_key={_MCP_KEY}'
        try:
            req = urllib.request.Request(direct_url, data=payload, method='POST',
                headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream'})
            with urllib.request.urlopen(req, timeout=10, context=_SSL) as r:
                result['direct_post_status']  = r.status
                result['direct_post_body']    = r.read(1024).decode('utf-8','replace')
        except urllib.error.HTTPError as e:
            result['direct_post_http_error'] = e.code
            result['direct_post_body']       = e.read(512).decode('utf-8','replace')
        except Exception as ex:
            result['direct_post_error'] = str(ex)

        # ── Test 3: POST to session endpoint (if found) ───────────
        session_ep = None
        body_text  = result.get('get_body_preview','')
        for line in body_text.splitlines():
            line = line.strip()
            if line.startswith('data:'):
                data = line[5:].strip()
                if 'sessionId' in data or '/messages' in data:
                    session_ep = (data if data.startswith('http')
                                  else f'{base}{data}' if data.startswith('/') else None)
                    if session_ep and 'api_key=' not in session_ep:
                        session_ep += f'&api_key={_MCP_KEY}'
                    break

        if session_ep:
            result['session_endpoint_found'] = session_ep
            try:
                req2 = urllib.request.Request(session_ep, data=payload, method='POST',
                    headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream'})
                with urllib.request.urlopen(req2, timeout=15, context=_SSL) as r:
                    result['session_post_status'] = r.status
                    result['session_post_body']   = r.read(1024).decode('utf-8','replace')
            except urllib.error.HTTPError as e:
                result['session_post_http_error'] = e.code
                result['session_post_body']       = e.read(512).decode('utf-8','replace')
            except Exception as ex:
                result['session_post_error'] = str(ex)
        else:
            result['session_endpoint_found'] = None

        json_response(self, 200, result)

    def log_message(self, *a): pass
