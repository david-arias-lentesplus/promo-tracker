"""
📄 /api/users.py  — Agente: User Management (Admin Only)

GET    /api/users           → list all users
POST   /api/users           → create a new user
PUT    /api/users?id=usr_xx → update user by id
DELETE /api/users?id=usr_xx → delete user by id (cannot delete self)

Requires: role='admin' in JWT token.
Password hashing: SHA-256.
"""
import sys, os
_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

import json, hashlib
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from _auth import (
    validate_admin, get_token_payload, json_response,
    load_users, save_users, find_user_by_id, find_user_by_username,
    generate_user_id,
)

VALID_ROLES = {'admin', 'user'}


def _hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


def _safe_user(u: dict) -> dict:
    """Return user dict without password_hash."""
    return {k: v for k, v in u.items() if k != 'password_hash'}


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.end_headers()

    # ─── GET — list all users ──────────────────────────────────
    def do_GET(self):
        is_admin, msg, payload = validate_admin(dict(self.headers))
        if not is_admin:
            return json_response(self, 403, {'status': 'error', 'message': msg})

        users = load_users()
        return json_response(self, 200, {
            'status': 'ok',
            'users':  [_safe_user(u) for u in users],
            'total':  len(users),
        })

    # ─── POST — create user ────────────────────────────────────
    def do_POST(self):
        is_admin, msg, payload = validate_admin(dict(self.headers))
        if not is_admin:
            return json_response(self, 403, {'status': 'error', 'message': msg})

        try:
            length = int(self.headers.get('Content-Length', 0))
            body   = json.loads(self.rfile.read(length).decode('utf-8')) if length else {}
        except Exception:
            return json_response(self, 400, {'status': 'error', 'message': 'JSON inválido'})

        username     = (body.get('username') or '').strip()
        password     = (body.get('password') or '').strip()
        display_name = (body.get('display_name') or '').strip()
        email        = (body.get('email') or '').strip()
        role         = (body.get('role') or 'user').strip()

        if not username or not password:
            return json_response(self, 400, {'status': 'error', 'message': 'username y password son obligatorios'})
        if role not in VALID_ROLES:
            return json_response(self, 400, {'status': 'error', 'message': f'Rol inválido. Valores aceptados: {", ".join(VALID_ROLES)}'})

        users = load_users()
        if find_user_by_username(username):
            return json_response(self, 409, {'status': 'error', 'message': 'El username ya existe'})

        import datetime
        new_user = {
            'id':            generate_user_id(),
            'username':      username,
            'password_hash': _hash_pw(password),
            'display_name':  display_name or username,
            'email':         email,
            'role':          role,
            'created_at':    datetime.date.today().isoformat(),
        }
        users.append(new_user)
        save_users(users)

        return json_response(self, 201, {
            'status': 'ok',
            'message': 'Usuario creado exitosamente',
            'user':    _safe_user(new_user),
        })

    # ─── PUT — update user ─────────────────────────────────────
    def do_PUT(self):
        is_admin, msg, payload = validate_admin(dict(self.headers))
        if not is_admin:
            return json_response(self, 403, {'status': 'error', 'message': msg})

        qs      = parse_qs(urlparse(self.path).query)
        user_id = qs.get('id', [''])[0].strip()
        if not user_id:
            return json_response(self, 400, {'status': 'error', 'message': 'Parámetro id requerido'})

        try:
            length = int(self.headers.get('Content-Length', 0))
            body   = json.loads(self.rfile.read(length).decode('utf-8')) if length else {}
        except Exception:
            return json_response(self, 400, {'status': 'error', 'message': 'JSON inválido'})

        users = load_users()
        target = next((u for u in users if u.get('id') == user_id), None)
        if not target:
            return json_response(self, 404, {'status': 'error', 'message': 'Usuario no encontrado'})

        if 'display_name' in body and body['display_name'].strip():
            target['display_name'] = body['display_name'].strip()
        if 'email' in body:
            target['email'] = body['email'].strip()
        if 'role' in body:
            if body['role'] not in VALID_ROLES:
                return json_response(self, 400, {'status': 'error', 'message': 'Rol inválido'})
            target['role'] = body['role']
        if 'username' in body and body['username'].strip():
            new_uname = body['username'].strip()
            if any(u.get('username') == new_uname and u.get('id') != user_id for u in users):
                return json_response(self, 409, {'status': 'error', 'message': 'El username ya está en uso'})
            target['username'] = new_uname
        if 'password' in body and body['password'].strip():
            target['password_hash'] = _hash_pw(body['password'].strip())

        save_users(users)
        return json_response(self, 200, {
            'status':  'ok',
            'message': 'Usuario actualizado',
            'user':    _safe_user(target),
        })

    # ─── DELETE — remove user ──────────────────────────────────
    def do_DELETE(self):
        is_admin, msg, payload = validate_admin(dict(self.headers))
        if not is_admin:
            return json_response(self, 403, {'status': 'error', 'message': msg})

        qs      = parse_qs(urlparse(self.path).query)
        user_id = qs.get('id', [''])[0].strip()
        if not user_id:
            return json_response(self, 400, {'status': 'error', 'message': 'Parámetro id requerido'})

        if payload and payload.get('user_id') == user_id:
            return json_response(self, 400, {'status': 'error', 'message': 'No puedes eliminar tu propia cuenta'})

        users = load_users()
        original_count = len(users)
        users = [u for u in users if u.get('id') != user_id]

        if len(users) == original_count:
            return json_response(self, 404, {'status': 'error', 'message': 'Usuario no encontrado'})

        save_users(users)
        return json_response(self, 200, {
            'status':  'ok',
            'message': 'Usuario eliminado',
        })

    def log_message(self, format, *args):
        pass
