"""
📄 /api/scraper.py  — Motor de verificación de promociones (Playwright)
POST /api/scraper
Body: {
  "url":           "https://...",
  "tipo_promo":    "Precio tachado" | "Tier Price" | ...,
  "sku":           "12345",
  "desc_pct":      25.0,     // descuento esperado (0-100) del CSV
  "qty_max_promo": "2"       // cantidad de cajas para habilitar promo
}

── Precio tachado ────────────────────────────────────────────────
  Selectores específicos del DOM:
    precio_full  (tachado):  div.productFullDetail-marked-rX-
    precio_final (con desc): div:nth-child(1) dentro del mismo container
  Calcula descuento real, compara vs CSV (tolerancia ±2 pp).

── Tier Price ────────────────────────────────────────────────────
  1. Detecta campos de fórmula disponibles (Poder/Cyl/Eje/Add/Dom)
  2. Hace click en cada selector → espera tabla dinámica → elige 1ª opción
  3. Ajusta cantidad (clic "+" hasta qty_max_promo)
  4. Click "AGREGAR A LA BOLSA" → espera redirección al carrito
  5. Verifica carrito: detecta vacío o extrae resumen de precios
  6. Compara descuento del carrito vs CSV
"""
import sys, os, re, json, time
_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

from http.server import BaseHTTPRequestHandler
from _auth import validate_token, json_response

# ── Precio parsing ─────────────────────────────────────────────
def _clean_price(raw: str) -> float | None:
    """Parse price strings from BR/ES/LATAM ecommerce. Removes currency, normalizes separators."""
    if not raw:
        return None
    s = raw.strip()
    # Remove currency symbols and whitespace
    s = re.sub(r'[R$€ \s]', '', s)
    s = re.sub(r'[A-Z]{2,}', '', s)  # COP, CLP, MXN, ARS
    s = s.strip()
    if not s:
        return None
    # BR format: 1.299,90  →  1299.90
    if re.search(r'\d\.\d{3},', s):
        s = s.replace('.', '').replace(',', '.')
    # Mixed: prefer comma as decimal if last separator is comma with 2 digits
    elif ',' in s and '.' in s:
        li, lc = s.rfind('.'), s.rfind(',')
        if lc > li:  # comma is last → decimal
            s = s.replace('.', '').replace(',', '.')
        else:
            s = s.replace(',', '')
    elif ',' in s:
        # Comma only — could be thousands (1,000) or decimal (9,90)
        parts = s.split(',')
        if len(parts) == 2 and len(parts[1]) <= 2:
            s = s.replace(',', '.')  # decimal
        else:
            s = s.replace(',', '')   # thousands
    try:
        return float(re.sub(r'[^\d.]', '', s))
    except Exception:
        return None


def _calc_discount(full: float, final: float) -> float:
    """Returns discount percentage (0-100)."""
    if not full or not final or full <= 0:
        return 0.0
    return round((1 - final / full) * 100, 1)


def _discount_status(real: float, expected: float) -> str:
    diff = abs(real - expected)
    if diff <= 2:
        return 'ok'
    return 'warning'


# ── PRECIO TACHADO ─────────────────────────────────────────────
PRECIO_FULL_SEL  = (
    "#root > main > div.main-page-ioz > form > "
    "section.productFullDetail-productPriceContainer-J9g > div > "
    "div:nth-child(1) > div.productFullDetail-marked-rX-"
)
PRECIO_FINAL_SEL = (
    "#root > main > div.main-page-ioz > form > "
    "section.productFullDetail-productPriceContainer-J9g > div > "
    "div:nth-child(1) > div:nth-child(1)"
)

def scrape_precio_tachado(page, url: str, expected_pct: float) -> dict:
    try:
        page.goto(url, wait_until='domcontentloaded', timeout=30000)
        page.wait_for_selector(PRECIO_FINAL_SEL, timeout=15000)

        raw_full  = ''
        raw_final = ''

        # Precio full (tachado)
        try:
            el_full  = page.query_selector(PRECIO_FULL_SEL)
            raw_full = el_full.inner_text().strip() if el_full else ''
        except Exception:
            pass

        # Precio final
        try:
            el_final  = page.query_selector(PRECIO_FINAL_SEL)
            raw_final = el_final.inner_text().strip() if el_final else ''
        except Exception:
            pass

        price_full  = _clean_price(raw_full)
        price_final = _clean_price(raw_final)

        # If both selectors returned the same element text, try fallback
        # (final price div:nth-child(1) may include the full price text)
        if price_full and price_final and price_full == price_final:
            # Try to get the non-marked child as final price
            try:
                container = page.query_selector(
                    "#root > main > div.main-page-ioz > form > "
                    "section.productFullDetail-productPriceContainer-J9g > div > div:nth-child(1)"
                )
                if container:
                    children = container.query_selector_all('div')
                    prices_found = []
                    for child in children:
                        txt = child.inner_text().strip()
                        p   = _clean_price(txt)
                        if p and p > 0:
                            prices_found.append(p)
                    if len(prices_found) >= 2:
                        price_full  = max(prices_found)
                        price_final = min(prices_found)
            except Exception:
                pass

        # Build result
        details = {
            'raw_full':   raw_full,
            'raw_final':  raw_final,
            'price_full': price_full,
            'price_final':price_final,
        }

        if not price_final:
            return {
                'status':  'warning',
                'message': 'No se encontró el precio final en la página. '
                           'Es posible que el selector haya cambiado o el producto no esté disponible.',
                'details': details,
            }

        if not price_full or price_full <= price_final:
            # No strikethrough found — promo may not be active
            return {
                'status':  'warning',
                'message': (
                    f'Precio final encontrado: {price_final:,.2f} — '
                    'No se detectó precio tachado. La promo puede no estar activa.'
                    if price_full is None else
                    f'Precio full ({price_full:,.2f}) ≤ precio final ({price_final:,.2f}). '
                    'La promo no parece estar activa.'
                ),
                'details': details,
            }

        real_pct   = _calc_discount(price_full, price_final)
        status     = _discount_status(real_pct, expected_pct)
        diff_pp    = round(abs(real_pct - expected_pct), 1)
        details.update({
            'discount_real':    real_pct,
            'discount_csv':     expected_pct,
            'diff_pp':          diff_pp,
        })

        if status == 'ok':
            msg = f'Promo activa ✓ — Descuento real: {real_pct}% (esperado: {expected_pct}%)'
        elif real_pct < expected_pct:
            msg = f'Descuento menor al esperado — Real: {real_pct}% | CSV: {expected_pct}% | Dif: {diff_pp} pp'
        else:
            msg = f'Descuento mayor al esperado — Real: {real_pct}% | CSV: {expected_pct}% | Dif: {diff_pp} pp'

        return {'status': status, 'message': msg, 'details': details}

    except Exception as e:
        return {
            'status':  'error',
            'message': f'Error durante el scraping de precio tachado: {str(e)}',
            'details': {},
        }


# ── TIER PRICE ─────────────────────────────────────────────────

# Selector IDs for prescription fields (special chars need attr selector)
FORMULA_FIELDS = [
    ('Poder (Esfera)', 'select-Poder(Esfera)-izq'),
    ('Cilindro (Cyl)', 'select-Cilindro(Cyl)-izq'),
    ('Eje (Axis)',     'select-Eje(Axis)-izq'),
    ('Adición (Add)',  'select-Adición(Add)-izq'),
    ('Dominance (Dom)','select-Dominance(Dom)-izq'),
]

QTY_PLUS_BTN = (
    "#root > main > div.main-page-ioz > form > "
    "section.productFullDetail-addSection-ZWt > "
    "div.productFullDetail-addSectionContainer-gld > "
    "div.productFullDetail-addFormulaContainer-F5A > "
    "div.pdpglasses-wrapperQuantities-2WZ > div > div > div:nth-child(3)"
)

CART_SUMMARY_SEL = (
    "#root > main > div.main-page-ioz > div > "
    "div.cartPage-body-i6u > "
    "div.cartPage-summary_container-n-G > div > "
    "div.priceSummary-root-95j"
)

CART_EMPTY_TEXT = "Tu bolsa de compras está vacía"
ADD_TO_BAG_TEXT  = "AGREGAR A LA BOLSA"

def _attr_sel(field_id: str) -> str:
    """Build attribute selector for IDs with special characters."""
    return f'[id="{field_id}"]'


def _fill_field(page, field_name: str, field_id: str) -> dict:
    """
    Click the field button → wait for dynamic option table → pick first option.
    Returns {'filled': bool, 'value': str, 'error': str}
    """
    sel = _attr_sel(field_id)
    try:
        btn = page.query_selector(sel)
        if not btn:
            return {'filled': False, 'value': '', 'error': 'campo no encontrado'}

        btn.click()
        # Wait for the options table to appear
        page.wait_for_selector(f'{sel} ~ * tbody tr, {sel} + * tbody tr', timeout=5000)

        # Try different table-finding strategies
        option = None
        # Strategy 1: sibling table after button
        for sibling_sel in [
            f'{sel} ~ div tbody tr:first-child td',
            f'{sel} ~ * tbody tr:first-child td',
            'div[class*="options"] tbody tr:first-child td',
            'table tbody tr:first-child td',
        ]:
            option = page.query_selector(sibling_sel)
            if option:
                break

        if not option:
            # Grab any visible tbody first row
            option = page.query_selector('tbody tr:first-child td')

        if not option:
            return {'filled': False, 'value': '', 'error': 'no se encontraron opciones en la tabla'}

        val = option.inner_text().strip()
        option.click()
        page.wait_for_timeout(400)
        return {'filled': True, 'value': val, 'error': ''}

    except Exception as e:
        return {'filled': False, 'value': '', 'error': str(e)}


def _get_current_qty(page) -> int:
    """Read the current quantity value from the qty input/display."""
    try:
        # The display is in div:nth-child(2) — the element between - and +
        qty_display = page.query_selector(
            "#root > main > div.main-page-ioz > form > "
            "section.productFullDetail-addSection-ZWt > "
            "div.productFullDetail-addSectionContainer-gld > "
            "div.productFullDetail-addFormulaContainer-F5A > "
            "div.pdpglasses-wrapperQuantities-2WZ > div > div > div:nth-child(2)"
        )
        if qty_display:
            return int(qty_display.inner_text().strip())
    except Exception:
        pass
    return 1


def _extract_cart_discount(page) -> dict:
    """Parse the cart price summary div for pricing and discount info."""
    result = {'raw': '', 'prices': [], 'discount_real': None}
    try:
        summary = page.query_selector(CART_SUMMARY_SEL)
        if not summary:
            return result
        raw = summary.inner_text()
        result['raw'] = raw
        # Extract all numbers that look like prices
        prices = []
        for match in re.finditer(
            r'(?:R\$|COP|CLP|MXN|ARS|\$)?\s*(\d[\d.,]{2,})',
            raw
        ):
            p = _clean_price(match.group(0) or match.group(1))
            if p and p > 10:
                prices.append(p)
        result['prices'] = prices
        if len(prices) >= 2:
            full  = max(prices)
            final = min(prices)
            if full > final:
                result['discount_real'] = _calc_discount(full, final)
                result['price_full']    = full
                result['price_final']   = final
    except Exception as e:
        result['error'] = str(e)
    return result


# ── Debug capture ──────────────────────────────────────────────

def _capture_debug(page) -> dict:
    """
    Capture rich debug info from the current page.
    Screenshot saved to /tmp/scraper_debug.png (local dev only).
    Returns: {screenshot_path, page_url, page_title, body_text (truncated),
              selectors_found: {sel: bool}, cart_html}
    """
    debug = {
        'page_url':   page.url,
        'page_title': '',
        'body_text':  '',
        'screenshot': None,
        'selectors_found': {},
        'cart_html':  '',
        'cart_text':  '',
        'all_divs_with_price': [],
    }

    try: debug['page_title'] = page.title()
    except Exception: pass

    try:
        full_text = page.inner_text('body')
        debug['body_text'] = full_text[:3000]
    except Exception: pass

    # Screenshot
    try:
        path = '/tmp/scraper_debug.png'
        page.screenshot(path=path, full_page=True)
        debug['screenshot'] = path
    except Exception as e:
        debug['screenshot'] = f'failed: {e}'

    # Test every cart/price selector we care about
    SELECTORS_TO_TEST = [
        CART_SUMMARY_SEL,
        '[class*="priceSummary"]',
        '[class*="cartPage"]',
        '[class*="summary"]',
        '[class*="price"]',
        '#root > main',
        'body',
    ]
    for sel in SELECTORS_TO_TEST:
        try:
            el = page.query_selector(sel)
            debug['selectors_found'][sel] = el is not None
        except Exception:
            debug['selectors_found'][sel] = False

    # Grab whatever the cart summary area actually contains
    for fallback_sel in [
        CART_SUMMARY_SEL,
        '[class*="priceSummary"]',
        '[class*="cartPage-summary"]',
        '[class*="summary_container"]',
    ]:
        try:
            el = page.query_selector(fallback_sel)
            if el:
                debug['cart_html'] = el.inner_html()[:2000]
                debug['cart_text'] = el.inner_text()[:500]
                break
        except Exception:
            pass

    # All elements containing price-like text
    try:
        price_els = page.query_selector_all('[class*="price"], [class*="Price"]')
        for el in price_els[:20]:
            try:
                txt = el.inner_text().strip()
                cls = el.get_attribute('class') or ''
                if txt and any(c.isdigit() for c in txt):
                    debug['all_divs_with_price'].append({'class': cls[:80], 'text': txt[:80]})
            except Exception:
                pass
    except Exception:
        pass

    return debug



def scrape_tier_price(page, url: str, expected_pct: float, qty_max: int, debug_mode: bool = False) -> dict:
    fields_filled = {}
    try:
        page.goto(url, wait_until='domcontentloaded', timeout=30000)
        page.wait_for_timeout(2000)  # Let React hydrate

        # Step 1 — fill prescription fields
        for field_name, field_id in FORMULA_FIELDS:
            res = _fill_field(page, field_name, field_id)
            if res['filled']:
                fields_filled[field_name] = res['value']

        if not fields_filled:
            return {
                'status':  'warning',
                'message': 'No se encontraron campos de fórmula en este producto. '
                           'Puede que no sea un lente de contacto formulado.',
                'details': {'fields_filled': fields_filled},
            }

        page.wait_for_timeout(500)

        # Step 2 — set quantity
        current_qty = _get_current_qty(page)
        clicks_needed = max(0, qty_max - current_qty)
        plus_btn = page.query_selector(QTY_PLUS_BTN)

        if plus_btn and clicks_needed > 0:
            for _ in range(clicks_needed):
                plus_btn.click()
                page.wait_for_timeout(300)

        final_qty = _get_current_qty(page)

        # Step 3 — find and click "AGREGAR A LA BOLSA"
        add_btn = page.get_by_text(ADD_TO_BAG_TEXT, exact=False).first
        if not add_btn:
            add_btn = page.query_selector('button[class*="addToCart"], button[class*="add-to-cart"]')

        if not add_btn:
            return {
                'status':  'error',
                'message': f'No se encontró el botón "{ADD_TO_BAG_TEXT}". '
                           'Los campos de fórmula pueden no haberse completado correctamente.',
                'details': {'fields_filled': fields_filled, 'qty': final_qty},
            }

        # Click and wait for cart navigation
        with page.expect_navigation(timeout=20000, wait_until='domcontentloaded'):
            add_btn.click()

        page.wait_for_timeout(2000)

        # Step 4 — validate cart
        page_text = page.inner_text('body')

        if CART_EMPTY_TEXT in page_text:
            debug_info = _capture_debug(page) if debug_mode else {}
            return {
                'status':  'error',
                'message': 'El carrito está vacío después de intentar agregar el producto. '
                           'Verifica que los campos de fórmula se hayan completado correctamente.',
                'details': {
                    'fields_filled': fields_filled,
                    'qty':           final_qty,
                    'cart_url':      page.url,
                    'debug':         debug_info,
                },
            }

        # Step 5 — extract cart summary
        cart_info = _extract_cart_discount(page)
        dr        = cart_info.get('discount_real')

        details = {
            'fields_filled':  fields_filled,
            'qty':            final_qty,
            'cart_url':       page.url,
            'cart_raw':       cart_info.get('raw', '')[:400],
            'price_full':     cart_info.get('price_full'),
            'price_final':    cart_info.get('price_final'),
            'discount_real':  dr,
            'discount_csv':   expected_pct,
        }

        if dr is None:
            debug_info = _capture_debug(page) if debug_mode else {}
            details['debug'] = debug_info
            return {
                'status':  'warning',
                'message': 'Producto agregado al carrito pero no se pudo calcular el descuento. '
                           'Revisa el resumen del carrito manualmente.',
                'details': details,
            }

        diff_pp = round(abs(dr - expected_pct), 1)
        details['diff_pp'] = diff_pp
        status  = _discount_status(dr, expected_pct)

        if status == 'ok':
            msg = f'Tier Price activo ✓ — Descuento en carrito: {dr}% (esperado: {expected_pct}%)'
        elif dr < expected_pct:
            msg = f'Descuento menor al esperado en carrito — Real: {dr}% | CSV: {expected_pct}% | Dif: {diff_pp} pp'
        else:
            msg = f'Descuento mayor al esperado en carrito — Real: {dr}% | CSV: {expected_pct}% | Dif: {diff_pp} pp'

        return {'status': status, 'message': msg, 'details': details}

    except Exception as e:
        return {
            'status':  'error',
            'message': f'Error durante scraping Tier Price: {str(e)}',
            'details': {'fields_filled': fields_filled},
        }


# ── Dispatch ───────────────────────────────────────────────────

def _run_with_playwright(tipo_promo: str, url: str,
                         expected_pct: float, qty_max: int,
                         debug_mode: bool = False) -> dict:
    try:
        from playwright.sync_api import sync_playwright, TimeoutError as PwTimeout
    except ImportError:
        return {
            'status':  'error',
            'message': 'Playwright no está instalado. Ejecuta: pip install playwright && playwright install chromium',
            'details': {},
        }

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage',
                  '--disable-gpu', '--single-process'],
        )
        context = browser.new_context(
            user_agent=(
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/124.0.0.0 Safari/537.36'
            ),
            locale='es-419',
            viewport={'width': 1280, 'height': 900},
        )
        page = context.new_page()

        try:
            tipo = tipo_promo.lower().strip()
            if tipo in ('precio tachado', 'tachado', 'strike', 'strike price'):
                result = scrape_precio_tachado(page, url, expected_pct)
            elif tipo in ('tier price', 'tier'):
                result = scrape_tier_price(page, url, expected_pct, qty_max, debug_mode=debug_mode)
            else:
                result = {
                    'status':  'pending',
                    'tipo':    tipo_promo,
                    'message': f'Tipo de promo "{tipo_promo}" aún no tiene verificador implementado.',
                    'details': {},
                }
        finally:
            browser.close()

    result.setdefault('tipo', tipo_promo)
    return result


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

        url          = (body.get('url')          or '').strip()
        tipo_promo   = (body.get('tipo_promo')   or '').strip()
        expected_pct = float(body.get('desc_pct', 0) or 0)
        qty_max_raw  = str(body.get('qty_max_promo', '1') or '1').strip()

        try:
            qty_max = max(1, int(qty_max_raw))
        except ValueError:
            qty_max = 1

        if not url:
            return json_response(self, 400, {'status': 'error', 'message': 'Campo url requerido'})
        if not tipo_promo:
            return json_response(self, 400, {'status': 'error', 'message': 'Campo tipo_promo requerido'})

        t0         = time.time()
        debug_mode = bool(body.get('debug', False))
        result = _run_with_playwright(tipo_promo, url, expected_pct, qty_max, debug_mode=debug_mode)
        result['elapsed_ms'] = round((time.time() - t0) * 1000)
        result['url']        = url
        result['sku']        = body.get('sku', '')

        return json_response(self, 200, result)

    def log_message(self, format, *args):
        pass
