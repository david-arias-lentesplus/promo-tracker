"""
📄 /api/_auth.py  — Autenticación y persistencia de usuarios

Backends de escritura (por prioridad):
  1. GitHub API  — si GITHUB_TOKEN + GITHUB_REPO están en env (Vercel prod)
                   Escribe data/users.json directo al repo → persiste entre Lambdas.
  2. data/users.json local — desarrollo local.
  3. /tmp/users.json — fallback efímero (mismo Lambda únicamente).
"""
import os, json, hashlib, sys, uuid, urllib.request, base64
from datetime import datetime, timezone

_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

import _jwt_utils as jwt_utils

# ── GitHub API config ─────────────────────────────────────────
_GH_TOKEN  = os.environ.get('GITHUB_TOKEN',  '').strip()
_GH_REPO   = os.environ.get('GITHUB_REPO',   '').strip()   # "org/repo"
_GH_BRANCH = os.environ.get('GITHUB_BRANCH', 'main').strip()
_GH_PATH   = 'data/users.json'

_gh_cache: dict | None = None   # {'data': {...}, 'sha': '...'}


def _get_header(headers, name: str) -> str:
    if hasattr(headers, 'get'):
        val = headers.get(name, '') or headers.get(name.lower(), '')
        if val: return val
    if isinstance(headers, dict):
        return (headers.get(name) or headers.get(name.lower())
                or headers.get(name.upper()) or '')
    return ''


def _users_data_path():
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, 'data', 'users.json')


# ── GitHub API helpers ────────────────────────────────────────

def _gh_available() -> bool:
    return bool(_GH_TOKEN and _GH_REPO)


def _gh_headers() -> dict:
    return {
        'Authorization': f'token {_GH_TOKEN}',
        'Accept':        'application/vnd.github.v3+json',
        'User-Agent':    'PromoTracker/1.0',
        'Content-Type':  'application/json',
    }


def _gh_load() -> tuple:
    """Descarga data/users.json desde GitHub. Retorna (data_dict, sha)."""
    global _gh_cache
    if _gh_cache:
        return _gh_cache['data'], _gh_cache['sha']
    try:
        url = (f"https://api.github.com/repos/{_GH_REPO}"
               f"/contents/{_GH_PATH}?ref={_GH_BRANCH}")
        req = urllib.request.Request(url, headers=_gh_headers())
        with urllib.request.urlopen(req, timeout=10) as resp:
            payload = json.loads(resp.read())
        content = base64.b64decode(payload['content']).decode('utf-8')
        data = json.loads(content)
        sha  = payload['sha']
        _gh_cache = {'data': data, 'sha': sha}
        return data, sha
    except Exception as e:
        print(f"[_auth] GitHub load error: {e}")
        return None, None


def _gh_save(data: dict, sha: str) -> bool:
    """Escribe data/users.json en GitHub vía API (commit directo al repo)."""
    global _gh_cache
    try:
        content_b64 = base64.b64encode(
            json.dumps(data, indent=2, ensure_ascii=False).encode('utf-8')
        ).decode('ascii')
        body = json.dumps({
            'message': 'chore: update users [skip ci]',
            'content': content_b64,
            'sha':     sha,
            'branch':  _GH_BRANCH,
        }).encode('utf-8')
        url = f"https://api.github.com/repos/{_GH_REPO}/contents/{_GH_PATH}"
        req = urllib.request.Request(url, data=body, method='PUT',
                                     headers=_gh_headers())
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
        new_sha = result.get('content', {}).get('sha', sha)
        _gh_cache = {'data': data, 'sha': new_sha}
        return True
    except Exception as e:
        print(f"[_auth] GitHub save error: {e}")
        return False


# ── Storage: load / save ──────────────────────────────────────

def _load_users_raw() -> dict:
    global _gh_cache
    _gh_cache = None   # Invalidar cache en cada carga fresca

    # 1. GitHub API
    if _gh_available():
        data, sha = _gh_load()
        if data is not None:
            return data
        print("[_auth] GitHub load failed → fallback a archivo local")

    # 2. Archivo local (dev)
    base: dict = {'users': []}
    try:
        with open(_users_data_path(), 'r', encoding='utf-8') as f:
            base = json.load(f)
    except Exception:
        pass

    # 3. Merge con /tmp si existe (mismo Lambda, sin GitHub)
    if os.path.exists('/tmp/users.json'):
        try:
            with open('/tmp/users.json', 'r', encoding='utf-8') as f:
                tmp_data = json.load(f)
            base_usernames = {u['username'] for u in base.get('users', [])}
            for u in tmp_data.get('users', []):
                if u['username'] not in base_usernames:
                    base.setdefault('users', []).append(u)
                else:
                    for i, bu in enumerate(base['users']):
                        if bu['username'] == u['username']:
                            base['users'][i] = u
                            break
        except Exception:
            pass

    return base


def _save_users_raw(data: dict) -> tuple[bool, str]:
    """
    Guarda usuarios. Retorna (persistido: bool, backend: str).
    backend = 'github' | 'local' | 'tmp'
    persistido=False → /tmp efímero, no sobrevivirá a otra Lambda.
    """
    # 1. GitHub API
    if _gh_available():
        _, sha = _gh_load()
        if sha and _gh_save(data, sha):
            return True, 'github'
        print("[_auth] GitHub save failed → fallback a local")

    # 2. Archivo local (dev)
    try:
        with open(_users_data_path(), 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        try:
            with open('/tmp/users.json', 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception:
            pass
        return True, 'local'
    except (PermissionError, OSError):
        pass

    # 3. /tmp fallback
    try:
        with open('/tmp/users.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return False, 'tmp'
    except Exception as e:
        print(f"[_auth] /tmp save error: {e}")
        return False, 'error'


# ── Public API ────────────────────────────────────────────────

def load_users() -> list:
    return _load_users_raw().get('users', [])


def save_users(users_list: list) -> tuple[bool, str]:
    """
    Guarda la lista de usuarios.
    Retorna (ok: bool, backend: str).
    ok=False → no persistirá entre invocaciones de Lambda en Vercel.
    """
    raw = _load_users_raw()
    raw['users'] = users_list
    return _save_users_raw(raw)


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


# ── Token helpers ─────────────────────────────────────────────

def validate_token(headers) -> tuple:
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
    auth = _get_header(headers, 'Authorization')
    if not auth or not auth.startswith('Bearer '):
        return None
    token = auth.split(' ', 1)[1].strip()
    try:
        return jwt_utils.decode(token)
    except ValueError:
        return None


def validate_admin(headers) -> tuple:
    payload = get_token_payload(headers)
    if not payload:
        return False, "Token inválido o no proporcionado", None
    if payload.get('role') != 'admin':
        return False, "Acceso restringido a administradores", None
    return True, payload.get('sub', ''), payload


# ── JSON response helper ──────────────────────────────────────

def json_response(handler, status: int, body: dict):
    data = json.dumps(body, default=str, ensure_ascii=False).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type',   'application/json; charset=utf-8')
    handler.send_header('Content-Length', str(len(data)))
    handler.send_header('Access-Control-Allow-Origin',  '*')
    handler.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    handler.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    handler.end_headers()
    handler.wfile.write(data)
