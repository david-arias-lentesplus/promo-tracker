#!/usr/bin/env python3
"""
MCP Connection Diagnostic
Run: python3 api/mcp_test.py
Tests the full SSE handshake → POST flow and prints every step.
"""
import http.client
import json
import os
import ssl
import sys
import urllib.request

MCP_URL = os.environ.get('METABASE_MCP_URL', 'https://mcp.livocompany.com/metabase/mcp')
MCP_KEY = os.environ.get('METABASE_MCP_KEY', 'af7bd32eba834141058b8b453f07db8437dbd140bac1c92499e445e63912776b')
DWH_ID  = int(os.environ.get('METABASE_DWH_ID', '2'))

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode    = ssl.CERT_NONE

# ─── colour helpers ──────────────────────────────────────────────────────────
GRN  = lambda s: f'\033[92m{s}\033[0m'
RED  = lambda s: f'\033[91m{s}\033[0m'
YEL  = lambda s: f'\033[93m{s}\033[0m'
BLD  = lambda s: f'\033[1m{s}\033[0m'

def banner(title):
    print(f'\n{BLD("═"*60)}')
    print(f'  {BLD(title)}')
    print(f'{BLD("═"*60)}')

# ─── STEP 1: plain GET (no SSE) ───────────────────────────────────────────────
banner('STEP 1 — Plain GET (probe)')
url_plain = f'{MCP_URL}?api_key={MCP_KEY}'
print(f'  URL: {url_plain}')
try:
    from urllib.parse import urlparse
    p = urlparse(MCP_URL)
    conn = http.client.HTTPSConnection(p.netloc, timeout=10, context=SSL_CTX)
    conn.request('GET', f'{p.path}?api_key={MCP_KEY}', headers={'Connection': 'close'})
    r = conn.getresponse()
    print(f'  Status : {r.status} {r.reason}')
    hdrs = dict(r.getheaders())
    print(f'  Headers: {json.dumps(hdrs, indent=4)}')
    body = r.read(512)
    print(f'  Body   : {body[:256]!r}')
    conn.close()
except Exception as exc:
    print(RED(f'  ERROR: {exc}'))

# ─── STEP 2: SSE GET — stream until endpoint event ───────────────────────────
banner('STEP 2 — SSE GET (find sessionId)')
from urllib.parse import urlparse
p = urlparse(MCP_URL)
session_endpoint = None
raw_sse = ''

try:
    conn = http.client.HTTPSConnection(p.netloc, timeout=15, context=SSL_CTX)
    conn.request('GET', f'{p.path}?api_key={MCP_KEY}',
                 headers={'Accept': 'text/event-stream',
                           'Cache-Control': 'no-cache',
                           'Connection': 'close'})
    resp = conn.getresponse()
    print(f'  Status : {resp.status} {resp.reason}')
    print(f'  Headers: {json.dumps(dict(resp.getheaders()), indent=4)}')

    if resp.status in (200, 201):
        buf        = ''
        event_type = None
        chunks_read = 0
        found = False

        for _ in range(600):   # up to ~150 KB
            try:
                chunk = resp.read(256)
            except Exception as e:
                print(YEL(f'  read() raised: {e}'))
                break
            if not chunk:
                print(YEL('  Server closed connection (no more chunks)'))
                break
            chunks_read += 1
            decoded = chunk.decode('utf-8', errors='replace')
            raw_sse += decoded
            buf += decoded

            while '\n' in buf:
                line, buf = buf.split('\n', 1)
                line = line.rstrip('\r')
                print(f'  SSE line: {line!r}')

                if line.startswith('event:'):
                    event_type = line[6:].strip()
                elif line.startswith('data:'):
                    data = line[5:].strip()
                    if event_type == 'endpoint' or 'sessionId' in data or '/messages' in data:
                        base = f'{p.scheme}://{p.netloc}'
                        if data.startswith('http'):
                            ep = data
                        elif data.startswith('/'):
                            ep = f'{base}{data}'
                            sep = '&' if '?' in ep else '?'
                            if 'api_key=' not in ep:
                                ep = f'{ep}{sep}api_key={MCP_KEY}'
                        else:
                            ep = None
                        if ep:
                            session_endpoint = ep
                            found = True
                            print(GRN(f'\n  ✅ Found session endpoint: {ep}'))
                            break
                elif line == '':
                    event_type = None

            if found:
                break

        print(f'\n  Chunks read: {chunks_read}')
        if not found:
            print(RED('  ❌ No sessionId/endpoint found in SSE stream'))
            print(f'  Raw SSE (first 1000 chars):\n{raw_sse[:1000]!r}')
    else:
        body = resp.read(512)
        print(RED(f'  ❌ Bad status. Body: {body[:256]!r}'))
    conn.close()
except Exception as exc:
    import traceback
    print(RED(f'  ERROR: {exc}'))
    traceback.print_exc()

# ─── STEP 3: POST JSON-RPC to session endpoint ───────────────────────────────
if not session_endpoint:
    banner('STEP 3 — POST (SKIPPED — no session endpoint)')
    print(RED('  Cannot POST without a valid session endpoint.'))
    print(YEL('  Trying fallback POST directly to MCP_URL…'))
    session_endpoint = f'{MCP_URL}?api_key={MCP_KEY}'

banner(f'STEP 3 — POST JSON-RPC\n  Endpoint: {session_endpoint}')

payload = json.dumps({
    'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
    'params': {
        'name':      'execute',
        'arguments': {
            'database_id': DWH_ID,
            'query':       'SELECT 1 AS test_value',
            'row_limit':   5,
        },
    },
}).encode()

req = urllib.request.Request(
    session_endpoint, data=payload, method='POST',
    headers={'Content-Type': 'application/json',
              'Accept':       'application/json, text/event-stream'},
)
try:
    with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as r:
        status = r.status
        raw = r.read()
    print(f'  HTTP Status: {status}')
    print(f'  Response ({len(raw)} bytes):\n{raw[:1000].decode("utf-8","replace")}')
    try:
        obj = json.loads(raw)
        if 'error' in obj:
            print(RED(f'\n  ❌ JSON-RPC error: {obj["error"]}'))
        else:
            print(GRN('\n  ✅ JSON-RPC success!'))
            print(f'  Result keys: {list(obj.get("result",{}).keys())}')
    except Exception:
        # may be SSE-wrapped
        for line in raw.decode('utf-8','replace').splitlines():
            if line.startswith('data:'):
                try:
                    obj = json.loads(line[5:].strip())
                    if 'error' in obj:
                        print(RED(f'\n  ❌ JSON-RPC error: {obj["error"]}'))
                    else:
                        print(GRN('\n  ✅ JSON-RPC success (SSE-wrapped)!'))
                except Exception:
                    pass
except urllib.error.HTTPError as e:
    body = e.read()
    print(RED(f'  ❌ HTTP {e.code}: {body[:400].decode("utf-8","replace")}'))
except Exception as exc:
    import traceback
    print(RED(f'  ❌ Exception: {exc}'))
    traceback.print_exc()

banner('Done')
