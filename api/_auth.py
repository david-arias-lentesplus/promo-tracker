"""
📄 /api/_auth.py  — Utilidad compartida de autenticación
Headers case-insensitive (Node.js/Vite proxy envía headers en lowercase).
"""
import os, json, hashlib, sys

_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

import _jwt_utils as jwt_utils


def _get_header(headers, name: str) -> str:
    """Lookup case-insensitive en dict o HTTPMessage."""
    # HTTPMessage (objeto de Python) — case-insensitive nativo
    if hasattr(headers, 'get'):
        val = headers.get(name, '')
        if val:
            return val
        val = headers.get(name.lower(), '')
        if val:
            return val
    # dict plano — probar nombre original y lowercase
    if isinstance(headers, dict):
        return (headers.get(name)
                or headers.get(name.lower())
                or headers.get(name.upper())
                or '')
    return ''


def _users_path():
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, 'data', 'users.json')


def load_users() -> list:
    try:
        with open(_users_path(), 'r', encoding='utf-8') as f:
            return json.load(f).get('users', [])
    except Exception:
        return []


def find_user(username: str, password: str):
    pw_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()
    for user in load_users():
        if user['username'] == username and user['password_hash'] == pw_hash:
            return user
    return None


def validate_token(headers) -> tuple:
    """
    Valida JWT del header Authorization (case-insensitive).
    Devuelve (is_valid: bool, username_or_error: str)
    """
    auth = _get_header(headers, 'Authorization')
    if not auth or not auth.startswith('Bearer '):
        return False, "Token no proporcionado"
    token = auth.split(' ', 1)[1].strip()
    try:
        payload = jwt_utils.decode(token)
        return True, payload.get('sub', 'unknown')
    except ValueError as e:
        return False, str(e)


def json_response(handler, status: int, body: dict):
    """Envía respuesta JSON desde un BaseHTTPRequestHandler."""
    data = json.dumps(body, default=str, ensure_ascii=False).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type',  'application/json; charset=utf-8')
    handler.send_header('Content-Length', str(len(data)))
    handler.send_header('Access-Control-Allow-Origin',  '*')
    handler.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    handler.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    handler.end_headers()
    handler.wfile.write(data)
