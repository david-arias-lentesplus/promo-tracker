"""
📄 /api/_auth.py  — Utilidad compartida de autenticación
Headers case-insensitive (Node.js/Vite proxy envía headers en lowercase).
Soporta CRUD de usuarios con escritura a /tmp (Vercel) o data/ (dev).
"""
import os, json, hashlib, sys, uuid
from datetime import datetime, timezone

_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

import _jwt_utils as jwt_utils


def _get_header(headers, name: str) -> str:
    """Lookup case-insensitive en dict o HTTPMessage."""
    if hasattr(headers, 'get'):
        val = headers.get(name, '')
        if val: return val
        val = headers.get(name.lower(), '')
        if val: return val
    if isinstance(headers, dict):
        return (headers.get(name)
                or headers.get(name.lower())
                or headers.get(name.upper())
                or '')
    return ''


def _users_data_path():
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, 'data', 'users.json')


# ─── User storage (dev: data/users.json · prod: /tmp/users.json) ─

def _load_users_raw() -> dict:
    """
    Carga usuarios combinando data/users.json (fuente base, siempre committeada)
    con /tmp/users.json (adiciones en runtime de Vercel).

    Estrategia de merge:
      · data/users.json  → fuente de verdad (usuarios committeados)
      · /tmp/users.json  → usuarios creados via UI en runtime (efímeros por Lambda)
    Los usuarios de data/ siempre están disponibles; los de /tmp se agregan encima.
    Así un /tmp viejo (Lambda caliente) no oculta usuarios nuevos committeados.
    """
    # Leer fuente base (committeada al repo)
    base: dict = {'users': []}
    try:
        with open(_users_data_path(), 'r', encoding='utf-8') as f:
            base = json.load(f)
    except Exception:
        pass

    # Agregar usuarios de /tmp que no existan en la base (creados en runtime)
    if os.path.exists('/tmp/users.json'):
        try:
            with open('/tmp/users.json', 'r', encoding='utf-8') as f:
                tmp_data = json.load(f)
            base_usernames = {u['username'] for u in base.get('users', [])}
            base_ids       = {u.get('id','') for u in base.get('users', [])}
            for u in tmp_data.get('users', []):
                # Incluir solo si no está ya en la base (por username o id)
                if u['username'] not in base_usernames and u.get('id','') not in base_ids:
                    base.setdefault('users', []).append(u)
                else:
                    # Actualizar datos si el usuario base fue modificado en /tmp
                    for i, bu in enumerate(base['users']):
                        if bu['username'] == u['username']:
                            base['users'][i] = u
                            break
        except Exception:
            pass

    return base


def _save_users_raw(data: dict) -> None:
    """Save users dict. Tries data/ (dev), falls back to /tmp (Vercel)."""
    try:
        with open(_users_data_path(), 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        # Also keep /tmp in sync if it exists
        if os.path.exists('/tmp/users.json'):
            with open('/tmp/users.json', 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        return
    except (PermissionError, OSError):
        pass
    # Vercel: write to /tmp
    with open('/tmp/users.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_users() -> list:
    """Returns list of user dicts."""
    return _load_users_raw().get('users', [])


def save_users(users_list: list) -> None:
    """Persist user list preserving meta keys."""
    raw = _load_users_raw()
    raw['users'] = users_list
    _save_users_raw(raw)


def find_user(username: str, password: str):
    pw_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()
    for user in load_users():
        if user['username'] == username and user['password_hash'] == pw_hash:
            return user
    return None


def find_user_by_id(user_id: str):
    for user in load_users():
        if user.get('id') == user_id:
            return user
    return None


def find_user_by_username(username: str):
    for user in load_users():
        if user.get('username') == username:
            return user
    return None


def generate_user_id() -> str:
    return 'usr_' + uuid.uuid4().hex[:8]


# ─── Token helpers ────────────────────────────────────────────

def validate_token(headers) -> tuple:
    """
    Valida JWT del header Authorization.
    Retorna (is_valid: bool, username_or_error: str)
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


def get_token_payload(headers) -> dict | None:
    """
    Decodifica y retorna el payload del JWT, o None si inválido.
    """
    auth = _get_header(headers, 'Authorization')
    if not auth or not auth.startswith('Bearer '):
        return None
    token = auth.split(' ', 1)[1].strip()
    try:
        return jwt_utils.decode(token)
    except ValueError:
        return None


def validate_admin(headers) -> tuple:
    """
    Valida que el token pertenezca a un usuario con role='admin'.
    Retorna (is_admin: bool, message: str, payload: dict|None)
    """
    payload = get_token_payload(headers)
    if not payload:
        return False, "Token inválido o no proporcionado", None
    if payload.get('role') != 'admin':
        return False, "Acceso restringido a administradores", None
    return True, payload.get('sub', ''), payload


# ─── JSON response helper ─────────────────────────────────────

def json_response(handler, status: int, body: dict):
    """Envía respuesta JSON desde un BaseHTTPRequestHandler."""
    data = json.dumps(body, default=str, ensure_ascii=False).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type',   'application/json; charset=utf-8')
    handler.send_header('Content-Length', str(len(data)))
    handler.send_header('Access-Control-Allow-Origin',  '*')
    handler.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    handler.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    handler.end_headers()
    handler.wfile.write(data)
