"""
📄 /api/scraper.py  — Motor de verificación de promociones (scraping)
POST /api/scraper
Body: {
  "url":         "https://...",
  "tipo_promo":  "Precio tachado" | "Tier Price" | ...,
  "sku":         "12345",
  "desc_pct":    25.0    (descuento esperado según CSV, 0-100)
}

Retorna:
  {
    "status":  "ok" | "warning" | "error" | "pending",
    "tipo":    "precio_tachado" | "tier_price" | "unknown",
    "details": { ... },
    "message": "texto legible"
  }

── Precio tachado ────────────────────────────────────────────────
  Busca en la página de producto:
    · precio original (tachado / listPrice / fromPrice)
    · precio actual (salePrice / currentPrice)
  Calcula descuento real y lo compara con el descuento del CSV.
  Tolerancia: ±2 pp

── Tier Price ────────────────────────────────────────────────────
  (Implementación paso a paso en fases siguientes)
  Requiere simular sesión de compra hasta el carrito.
  Por ahora retorna status='pending'.
"""
import sys, os
_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

import json, re, time
from http.server import BaseHTTPRequestHandler
from _auth import validate_token, json_response

# ── HTTP helpers ───────────────────────────────────────────────
import urllib.request, urllib.error

_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

def _fetch_html(url: str, timeout: int = 15) -> str:
    req = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        charset = 'utf-8'
        ct = resp.headers.get_content_charset()
        if ct: charset = ct
        return resp.read().decode(charset, errors='replace')


# ── Price extraction helpers ───────────────────────────────────
# Patterns for prices in Brazilian/Spanish ecommerce sites
# Captures values like: R$ 1.299,90 | $299.990 | 299,90 | 1299.90
_PRICE_RE = re.compile(
    r'(?:R\$|COP|CLP|MXN|ARS|USD|\$|€)?\s*'
    r'(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)',
    re.IGNORECASE
)

def _parse_price(s: str) -> float | None:
    """Parse a price string (any locale) to float."""
    s = s.strip().replace('\xa0', '')
    # Remove currency symbols
    s = re.sub(r'[R$€COPMXNAR]+', '', s).strip()
    # Handle BR format: 1.299,90 → 1299.90
    if re.search(r'\d\.\d{3},', s):
        s = s.replace('.', '').replace(',', '.')
    # Handle ES format: 1.299,90 or 1,299.90
    elif ',' in s and '.' in s:
        if s.index(',') > s.index('.'):   # 1.299,90
            s = s.replace('.', '').replace(',', '.')
        else:                              # 1,299.90
            s = s.replace(',', '')
    elif ',' in s:                         # 299,90
        s = s.replace(',', '.')
    try:
        return float(re.sub(r'[^\d.]', '', s))
    except Exception:
        return None


def _extract_prices_from_html(html: str) -> dict:
    """
    Try multiple strategies to find original + sale price.
    Returns {'original': float|None, 'sale': float|None, 'method': str}
    """
    original = None
    sale     = None
    method   = 'none'

    # Strategy 1: JSON-LD schema.org/Product
    ld_blocks = re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
                           html, re.DOTALL | re.IGNORECASE)
    for block in ld_blocks:
        try:
            data = json.loads(block)
            if isinstance(data, list): data = data[0]
            offers = data.get('offers') or data.get('Offers')
            if not offers: continue
            if isinstance(offers, list): offers = offers[0]
            price     = offers.get('price') or offers.get('lowPrice')
            high      = offers.get('highPrice')
            if price:
                sale = float(price)
                if high: original = float(high)
                method = 'json-ld'
                break
        except Exception:
            pass

    if sale and not original:
        # Strategy 2: meta og:price / product:price
        m = re.search(r'<meta[^>]+property=["\']og:price:amount["\'][^>]*content=["\']([^"\']+)["\']', html)
        if m: original = _parse_price(m.group(1))

    # Strategy 3: HTML element patterns (most ecommerce use specific classes)
    if not sale:
        # Common sale price selectors (Fbit/LIVO/Newlentes pattern)
        for pat in [
            r'class=["\'][^"\']*(?:sale[-_]?price|preco[-_]?atual|price[-_]?sale|de[-_]?promo|preco-por)[^"\']*["\'][^>]*>\s*(?:<[^>]+>)*\s*([R$\d.,\s]+)',
            r'class=["\'][^"\']*(?:product-price|sale_price|currentprice|priceSpecial)[^"\']*["\'][^>]*>\s*(?:<[^>]+>)*\s*([R$\d.,\s]+)',
            r'itemprop=["\']price["\'][^>]*content=["\']([^"\']+)["\']',
            r'itemprop=["\']price["\'][^>]*>\s*([R$\d.,\s]+)',
        ]:
            m = re.search(pat, html, re.IGNORECASE)
            if m:
                v = _parse_price(m.group(1))
                if v and v > 0:
                    sale = v
                    method = 'html-sale'
                    break

    # Strategy 4: original/strike-through price
    if not original:
        for pat in [
            r'class=["\'][^"\']*(?:list[-_]?price|preco[-_]?de|old[-_]?price|price[-_]?old|original[-_]?price|from[-_]?price|preco-de)[^"\']*["\'][^>]*>\s*(?:<[^>]+>)*\s*([R$\d.,\s]+)',
            r'<(?:del|s|strike)[^>]*>\s*(?:<[^>]+>)*\s*([R$\d.,\s]{4,})\s*(?:</[^>]+>)*\s*</(?:del|s|strike)>',
            r'itemprop=["\']highPrice["\'][^>]*content=["\']([^"\']+)["\']',
        ]:
            m = re.search(pat, html, re.IGNORECASE)
            if m:
                v = _parse_price(m.group(1))
                if v and v > 0:
                    original = v
                    if method == 'none': method = 'html-original'
                    break

    return {'original': original, 'sale': sale, 'method': method}


# ── Verificación: precio tachado ───────────────────────────────

def verify_precio_tachado(url: str, expected_pct: float) -> dict:
    """
    Fetches product page, finds prices, calculates real discount,
    compares to expected (from CSV). Tolerance: ±2 pp.
    """
    try:
        html   = _fetch_html(url)
        prices = _extract_prices_from_html(html)

        original = prices['original']
        sale     = prices['sale']

        if not sale:
            return {
                'status':  'warning',
                'tipo':    'precio_tachado',
                'message': 'No se encontró el precio de venta en la página.',
                'details': prices,
            }

        if not original:
            return {
                'status':  'warning',
                'tipo':    'precio_tachado',
                'message': 'Precio de venta encontrado pero no se detectó precio tachado (precio original).',
                'details': {'sale': sale, 'method': prices['method']},
            }

        if original <= sale:
            return {
                'status':  'error',
                'tipo':    'precio_tachado',
                'message': f'Precio original ({original}) ≤ precio actual ({sale}). La promo no está activa o los precios son incorrectos.',
                'details': {'original': original, 'sale': sale},
            }

        real_pct = round((1 - sale / original) * 100, 1)
        diff     = abs(real_pct - expected_pct)

        if diff <= 2:
            status  = 'ok'
            message = f'Promo activa ✓ — Descuento real: {real_pct}% (esperado: {expected_pct}%)'
        elif real_pct < expected_pct:
            status  = 'warning'
            message = f'Descuento menor al esperado — Real: {real_pct}% | CSV: {expected_pct}%'
        else:
            status  = 'warning'
            message = f'Descuento mayor al esperado — Real: {real_pct}% | CSV: {expected_pct}%'

        return {
            'status':   status,
            'tipo':     'precio_tachado',
            'message':  message,
            'details': {
                'price_original': original,
                'price_sale':     sale,
                'discount_real':  real_pct,
                'discount_csv':   expected_pct,
                'diff_pp':        round(diff, 1),
                'method':         prices['method'],
            },
        }

    except urllib.error.HTTPError as e:
        return {'status': 'error', 'tipo': 'precio_tachado',
                'message': f'Error HTTP {e.code} al acceder a la página.', 'details': {}}
    except urllib.error.URLError as e:
        return {'status': 'error', 'tipo': 'precio_tachado',
                'message': f'No se pudo acceder a la URL: {e.reason}', 'details': {}}
    except Exception as e:
        return {'status': 'error', 'tipo': 'precio_tachado',
                'message': f'Error inesperado: {str(e)}', 'details': {}}


# ── Verificación: Tier Price (STUB) ────────────────────────────

def verify_tier_price(url: str, expected_pct: float) -> dict:
    """
    Tier Price requires simulating a full purchase session to the cart page.
    Implementation: step-by-step in next phase.
    """
    return {
        'status':  'pending',
        'tipo':    'tier_price',
        'message': 'Verificación de Tier Price en desarrollo. Esta promo requiere simular el carrito de compra.',
        'details': {'url': url, 'expected_pct': expected_pct},
    }


# ── Dispatch ───────────────────────────────────────────────────

TIPO_DISPATCH = {
    'precio tachado':   verify_precio_tachado,
    'tachado':          verify_precio_tachado,
    'strike':           verify_precio_tachado,
    'strike price':     verify_precio_tachado,
    'tier price':       verify_tier_price,
    'tier':             verify_tier_price,
}

def dispatch(tipo_promo: str, url: str, expected_pct: float) -> dict:
    key = tipo_promo.lower().strip()
    fn  = TIPO_DISPATCH.get(key)
    if fn:
        return fn(url, expected_pct)
    return {
        'status':  'pending',
        'tipo':    'unknown',
        'message': f'Tipo de promo "{tipo_promo}" aún no tiene verificador implementado.',
        'details': {},
    }


# ── Handler ────────────────────────────────────────────────────

class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.end_headers()

    def do_POST(self):
        is_valid, msg = validate_token(dict(self.headers))
        if not is_valid:
            return json_response(self, 401, {'status': 'error', 'message': msg})

        try:
            length = int(self.headers.get('Content-Length', 0))
            body   = json.loads(self.rfile.read(length).decode('utf-8')) if length else {}
        except Exception:
            return json_response(self, 400, {'status': 'error', 'message': 'JSON inválido'})

        url         = (body.get('url')        or '').strip()
        tipo_promo  = (body.get('tipo_promo') or '').strip()
        expected_pct= float(body.get('desc_pct', 0) or 0)

        if not url:
            return json_response(self, 400, {'status': 'error', 'message': 'Campo url requerido'})
        if not tipo_promo:
            return json_response(self, 400, {'status': 'error', 'message': 'Campo tipo_promo requerido'})

        t0     = time.time()
        result = dispatch(tipo_promo, url, expected_pct)
        result['elapsed_ms'] = round((time.time() - t0) * 1000)
        result['url']        = url
        result['sku']        = body.get('sku', '')

        return json_response(self, 200, result)

    def log_message(self, format, *args):
        pass
