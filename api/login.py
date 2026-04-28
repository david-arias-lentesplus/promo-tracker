"""
📄 /api/login.py  — Agente 4: Security & DevOps
POST /api/login  →  { token, user }
Sin dependencias externas (usa _jwt_utils.py stdlib puro).
"""
import sys, os
_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

import json
from http.server import BaseHTTPRequestHandler
from datetime import datetime, timedelta, timezone
from _auth import find_user, json_response
import _jwt_utils as jwt_utils


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.end_headers()

    def do_POST(self):
        try:
            length   = int(self.headers.get('Content-Length', 0))
            body     = json.loads(self.rfile.read(length) if length else b'{}')
            username = str(body.get('username', '')).strip()
            password = str(body.get('password', ''))

            if not username or not password:
                return json_response(self, 400, {
                    'status': 'error', 'message': 'Usuario y contraseña requeridos'
                })

            user = find_user(username, password)
            if not user:
                return json_response(self, 401, {
                    'status': 'error', 'message': 'Credenciales inválidas'
                })

            now = datetime.now(timezone.utc)
            payload = {
                'sub':          user['username'],
                'user_id':      user.get('id', ''),
                'display_name': user.get('display_name', username),
                'role':         user.get('role', 'viewer'),
                'iat':          int(now.timestamp()),
                'exp':          int((now + timedelta(hours=8)).timestamp()),
            }
            token = jwt_utils.encode(payload)

            return json_response(self, 200, {
                'status':     'ok',
                'token':       token,
                'expires_in': 28800,
                'user': {
                    'username':     user['username'],
                    'display_name': user.get('display_name', username),
                    'email':        user.get('email', ''),
                    'role':         user.get('role', 'viewer'),
                }
            })

        except json.JSONDecodeError:
            return json_response(self, 400, {'status': 'error', 'message': 'JSON inválido'})
        except Exception as e:
            return json_response(self, 500, {'status': 'error', 'message': str(e)})

    def log_message(self, format, *args):
        pass
