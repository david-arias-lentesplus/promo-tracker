"""
📄 /api/me.py  — Own profile endpoint (any authenticated user)

GET  /api/me → returns own profile data (from token)
PUT  /api/me → update own display_name, email, password
               (current_password required for any update)
"""
import sys, os
_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

import json, hashlib
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse
from _auth import (
    validate_token, get_token_payload, json_response,
    load_users, save_users, find_user_by_id,
)


def _hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


def _safe_user(u: dict) -> dict:
    return {k: v for k, v in u.items() if k != 'password_hash'}


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.end_headers()

    # ─── GET — own profile ─────────────────────────────────────
    def do_GET(self):
        is_valid, msg = validate_token(dict(self.headers))
        if not is_valid:
            return json_response(self, 401, {'status': 'error', 'message': msg})

        payload = get_token_payload(dict(self.headers))
        user_id = payload.get('user_id') if payload else None
        user    = find_user_by_id(user_id) if user_id else None

        if not user:
            return json_response(self, 404, {'status': 'error', 'message': 'Usuario no encontrado'})

        return json_response(self, 200, {
            'status': 'ok',
            'user':   _safe_user(user),
        })

    # ─── PUT — update own profile ──────────────────────────────
    def do_PUT(self):
        is_valid, msg = validate_token(dict(self.headers))
        if not is_valid:
            return json_response(self, 401, {'status': 'error', 'message': msg})

        payload = get_token_payload(dict(self.headers))
        user_id = payload.get('user_id') if payload else None

        try:
            length = int(self.headers.get('Content-Length', 0))
            body   = json.loads(self.rfile.read(length).decode('utf-8')) if length else {}
        except Exception:
            return json_response(self, 400, {'status': 'error', 'message': 'JSON inválido'})

        current_password = (body.get('current_password') or '').strip()
        if not current_password:
            return json_response(self, 400, {'status': 'error', 'message': 'Se requiere la contraseña actual para realizar cambios'})

        users = load_users()
        target = next((u for u in users if u.get('id') == user_id), None)
        if not target:
            return json_response(self, 404, {'status': 'error', 'message': 'Usuario no encontrado'})

        # Verify current password
        if target.get('password_hash') != _hash_pw(current_password):
            return json_response(self, 403, {'status': 'error', 'message': 'Contraseña actual incorrecta'})

        # Apply updates
        if 'display_name' in body and body['display_name'].strip():
            target['display_name'] = body['display_name'].strip()
        if 'email' in body:
            target['email'] = body['email'].strip()
        if 'new_password' in body and body['new_password'].strip():
            new_pw = body['new_password'].strip()
            if len(new_pw) < 6:
                return json_response(self, 400, {'status': 'error', 'message': 'La nueva contraseña debe tener al menos 6 caracteres'})
            target['password_hash'] = _hash_pw(new_pw)

        ok, backend = save_users(users)
        if not ok:
            return json_response(self, 500, {'status':'error','message':'Cambios no guardados permanentemente. Configura GITHUB_TOKEN y GITHUB_REPO en Vercel.'})
        return json_response(self, 200, {
            'status':  'ok',
            'backend': backend,
            'message': 'Perfil actualizado exitosamente',
            'user':    _safe_user(target),
        })

    def log_message(self, format, *args):
        pass
