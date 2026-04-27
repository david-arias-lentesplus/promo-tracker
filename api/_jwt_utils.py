"""
📄 /api/_jwt_utils.py
JWT puro en Python stdlib — sin dependencia de PyJWT.
Usa HMAC-SHA256. Compatible con cualquier Python 3.6+.
"""
import hmac
import hashlib
import base64
import json
import os
from datetime import datetime, timezone


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')

def _b64url_decode(s: str) -> bytes:
    # Agregar padding si falta
    pad = 4 - len(s) % 4
    if pad != 4:
        s += '=' * pad
    return base64.urlsafe_b64decode(s)

def _secret() -> str:
    return os.environ.get('JWT_SECRET', 'promo-tracker-dev-secret-2026')

def encode(payload: dict) -> str:
    """Genera un JWT firmado con HS256."""
    header  = _b64url_encode(json.dumps({'alg': 'HS256', 'typ': 'JWT'}, separators=(',', ':')).encode())
    body    = _b64url_encode(json.dumps(payload, separators=(',', ':'), default=str).encode())
    msg     = f"{header}.{body}".encode()
    sig     = hmac.new(_secret().encode(), msg, hashlib.sha256).digest()
    return f"{header}.{body}.{_b64url_encode(sig)}"

def decode(token: str) -> dict:
    """
    Verifica y decodifica un JWT.
    Lanza ValueError si el token es inválido o expirado.
    """
    parts = token.split('.')
    if len(parts) != 3:
        raise ValueError("Token malformado")

    header_b64, body_b64, sig_b64 = parts

    # Verificar firma
    msg      = f"{header_b64}.{body_b64}".encode()
    expected = hmac.new(_secret().encode(), msg, hashlib.sha256).digest()
    actual   = _b64url_decode(sig_b64)

    if not hmac.compare_digest(expected, actual):
        raise ValueError("Firma inválida")

    payload = json.loads(_b64url_decode(body_b64))

    # Verificar expiración
    exp = payload.get('exp')
    if exp:
        now = datetime.now(timezone.utc).timestamp()
        if now > exp:
            raise ValueError("Token expirado")

    return payload
