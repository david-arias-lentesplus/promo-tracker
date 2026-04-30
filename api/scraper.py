"""
📄 /api/scraper.py  — Motor de verificación de promociones (Playwright)
POST /api/scraper
Body: {
  "url":           "https://...",
  "tipo_promo":    "Precio tachado" | "Tier Price" | ...,
  "sku":           "12345",
  "desc_pct":      25.0,     // descuento esperado (0-100) del CSV
  "qty_max_promo": "2",      // cantidad para activar tier price
  "debug":         true      // captura screenshots paso a paso
}
"""
import sys, os, re, json, time, base64
_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

from http.server import BaseHTTPRequestHandler
from _auth import validate_token, json_response


# ── Price helpers ───────────────────────────────────────────────

def _clean_price(raw: str) -> float | None:
    if not raw:
        return None
    s = raw.strip()
    s = re.sub(r'[R$€\s]', '', s)
    s = re.sub(r'[A-Z]{2,}', '', s)
    s = s.strip()
    if not s:
        return None
    if re.search(r'\d\.\d{3},', s):
        s = s.replace('.', '').replace(',', '.')
    elif ',' in s and '.' in s:
        li, lc = s.rfind('.'), s.rfind(',')
        if lc > li:
            s = s.replace('.', '').replace(',', '.')
        else:
            s = s.replace(',', '')
    elif ',' in s:
        parts = s.split(',')
        if len(parts) == 2 and len(parts[1]) <= 2:
            s = s.replace(',', '.')
        else:
            s = s.replace(',', '')
    try:
        return float(re.sub(r'[^\d.]', '', s))
    except Exception:
        return None


def _calc_discount(full: float, final: float) -> float:
    if not full or not final or full <= 0:
        return 0.0
    return round((1 - final / full) * 100, 1)


def _discount_status(real: float, expected: float) -> str:
    return 'ok' if abs(real - expected) <= 2 else 'warning'


# ── PRECIO TACHADO ──────────────────────────────────────────────

PRECIO_FULL_SEL = (
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

        raw_full, raw_final = '', ''
        try:
            el = page.query_selector(PRECIO_FULL_SEL)
            raw_full = el.inner_text().strip() if el else ''
        except Exception:
            pass
        try:
            el = page.query_selector(PRECIO_FINAL_SEL)
            raw_final = el.inner_text().strip() if el else ''
        except Exception:
            pass

        price_full  = _clean_price(raw_full)
        price_final = _clean_price(raw_final)

        if price_full and price_final and price_full == price_final:
            try:
                container = page.query_selector(
                    "#root > main > div.main-page-ioz > form > "
                    "section.productFullDetail-productPriceContainer-J9g > div > div:nth-child(1)"
                )
                if container:
                    children = container.query_selector_all('div')
                    prices_found = [p for c in children
                                    if (p := _clean_price(c.inner_text().strip())) and p > 0]
                    if len(prices_found) >= 2:
                        price_full  = max(prices_found)
                        price_final = min(prices_found)
            except Exception:
                pass

        details = {'raw_full': raw_full, 'raw_final': raw_final,
                   'price_full': price_full, 'price_final': price_final}

        if not price_final:
            return {'status': 'warning',
                    'message': 'No se encontró el precio final en la página.',
                    'details': details}
        if not price_full or price_full <= price_final:
            return {'status': 'warning',
                    'message': (f'Precio final: {price_final:,.0f} — sin precio tachado detectado.'
                                if price_full is None else
                                f'Precio full ({price_full:,.0f}) ≤ final ({price_final:,.0f}). Promo no activa.'),
                    'details': details}

        real_pct = _calc_discount(price_full, price_final)
        diff_pp  = round(abs(real_pct - expected_pct), 1)
        details.update({'discount_real': real_pct, 'discount_csv': expected_pct, 'diff_pp': diff_pp})
        status = _discount_status(real_pct, expected_pct)
        msg    = (f'Promo activa ✓ — {real_pct}% (esperado {expected_pct}%)' if status == 'ok'
                  else f'Descuento real {real_pct}% vs esperado {expected_pct}% — dif: {diff_pp} pp')
        return {'status': status, 'message': msg, 'details': details}

    except Exception as e:
        return {'status': 'error', 'message': f'Error precio tachado: {str(e)}', 'details': {}}


# ── TIER PRICE ──────────────────────────────────────────────────

FORMULA_FIELDS = [
    ('Poder (Esfera)', 'select-Poder(Esfera)-izq'),
    ('Cilindro (Cyl)', 'select-Cilindro(Cyl)-izq'),
    ('Eje (Axis)',     'select-Eje(Axis)-izq'),
    ('Adición (Add)',  'select-Adición(Add)-izq'),
    ('Dominance (Dom)','select-Dominance(Dom)-izq'),
]

QTY_PLUS_SELECTORS = [
    (
        "#root > main > div.main-page-ioz > form > "
        "section.productFullDetail-addSection-ZWt > "
        "div.productFullDetail-addSectionContainer-gld > "
        "div.productFullDetail-addFormulaContainer-F5A > "
        "div.pdpglasses-wrapperQuantities-2WZ > div > div > div:nth-child(3)"
    ),
    '[class*="wrapperQuantities"] div:last-child',
    '[class*="Quantities"] div:last-child',
    '[class*="quantity"] button:last-child',
    'button[aria-label*="increase"], button[aria-label*="más"], button[aria-label*="aumentar"]',
]

ADD_TO_BAG_TEXTS = [
    'AGREGAR A LA BOLSA', 'Agregar a la bolsa', 'AGREGAR', 'AÑADIR AL CARRITO',
    'ADD TO BAG', 'Añadir al carrito', 'Comprar',
]

CART_SUMMARY_SELECTORS = [
    (
        "#root > main > div.main-page-ioz > div > "
        "div.cartPage-body-i6u > div.cartPage-summary_container-n-G > "
        "div > div.priceSummary-root-95j"
    ),
    '[class*="priceSummary"]',
    '[class*="price-summary"]',
    '[class*="orderSummary"]',
    '[class*="cartPage-summary"]',
    '[class*="cart"] [class*="summary"]',
    '[class*="cart"] [class*="total"]',
]

CART_EMPTY_PHRASES = [
    'tu bolsa de compras está vacía', 'bolsa vacía', 'carrito vacío',
    'your cart is empty', 'tu carrito está vacío',
]


def _snap(page, debug_mode: bool) -> str | None:
    """Take screenshot → return base64 string, or None."""
    if not debug_mode:
        return None
    try:
        data = page.screenshot(full_page=False, timeout=5000)
        return base64.b64encode(data).decode()
    except Exception:
        return None


def _fill_field_v2(page, field_name: str, field_id: str) -> dict:
    """
    Multi-strategy field filler.
    Tries: ID selector (native select or custom button) → name/label fallbacks.
    """
    attr_sel = f'[id="{field_id}"]'

    # Strategy 1: find by ID
    try:
        el = page.query_selector(attr_sel)
        if el:
            tag = el.evaluate('e => e.tagName').upper()

            if tag == 'SELECT':
                # Native <select>: pick first non-empty option
                options = el.query_selector_all('option')
                for opt in options:
                    val = opt.get_attribute('value') or ''
                    if val and val not in ('0', '', 'null', 'undefined'):
                        el.select_option(value=val)
                        page.wait_for_timeout(400)
                        return {'filled': True, 'value': opt.inner_text().strip(), 'error': ''}
                return {'filled': False, 'value': '', 'error': 'select sin opciones válidas'}

            else:
                # Custom button/div: click → wait for dropdown → pick first option
                el.scroll_into_view_if_needed()
                el.click()
                page.wait_for_timeout(1000)

                # Try several selectors for the opened options container
                option_selectors = [
                    # Table row pattern (current site)
                    'tbody tr:first-child td:first-child',
                    'tbody tr:first-child td',
                    # List pattern
                    'ul[class*="option"] li:first-child:not([class*="disabled"])',
                    'ul[class*="Option"] li:first-child',
                    '[class*="dropdown"] li:first-child',
                    '[class*="Dropdown"] li:first-child',
                    '[class*="option"]:not([class*="disabled"]):not([class*="header"]):first-child',
                    # Generic visible list item
                    'li:not([class*="disabled"]):not([aria-disabled="true"]):first-child',
                ]
                for opt_sel in option_selectors:
                    try:
                        opt = page.query_selector(opt_sel)
                        if opt and opt.is_visible():
                            val = opt.inner_text().strip()
                            if val and len(val) < 30:  # sanity: options should be short
                                opt.click()
                                page.wait_for_timeout(500)
                                return {'filled': True, 'value': val, 'error': ''}
                    except Exception:
                        continue

                # Close any open dropdown before giving up
                try:
                    page.keyboard.press('Escape')
                except Exception:
                    pass
                return {'filled': False, 'value': '', 'error': 'elemento encontrado pero sin opciones visibles'}
    except Exception as e:
        pass

    # Strategy 2: by select[name] containing key word
    key = field_id.split('-')[1].split('(')[0].lower()  # 'Poder' → 'poder'
    for name_sel in [
        f'select[name*="{key}"]',
        f'select[id*="{key}"]',
        f'select[name*="{key.capitalize()}"]',
    ]:
        try:
            el = page.query_selector(name_sel)
            if el:
                options = el.query_selector_all('option')
                for opt in options:
                    val = opt.get_attribute('value') or ''
                    if val and val not in ('0', '', 'null'):
                        el.select_option(value=val)
                        page.wait_for_timeout(400)
                        return {'filled': True, 'value': opt.inner_text().strip(), 'error': ''}
        except Exception:
            continue

    return {'filled': False, 'value': '', 'error': f'campo "{field_name}" no encontrado en la página'}


# Selectores exactos del stepper de cantidad (el usuario confirmó esta estructura)
QTY_DISPLAY_SEL = (
    "#root > main > div.main-page-ioz > form > "
    "section.productFullDetail-addSection-ZWt > "
    "div.productFullDetail-addSectionContainer-gld > "
    "div.productFullDetail-addFormulaContainer-F5A > "
    "div.pdpglasses-wrapperQuantities-2WZ > div > div > div:nth-child(2)"
)
QTY_PLUS_SEL = (
    "#root > main > div.main-page-ioz > form > "
    "section.productFullDetail-addSection-ZWt > "
    "div.productFullDetail-addSectionContainer-gld > "
    "div.productFullDetail-addFormulaContainer-F5A > "
    "div.pdpglasses-wrapperQuantities-2WZ > div > div > div:nth-child(3)"
)

# Fallbacks por clase (resistentes a cambios de hash en CSS modules)
QTY_DISPLAY_FALLBACKS = [
    QTY_DISPLAY_SEL,
    '[class*="wrapperQuantities"] div:nth-child(2)',
    '[class*="Quantities"] div:nth-child(2)',
    '[class*="quantities"] div:nth-child(2)',
]
QTY_PLUS_FALLBACKS = [
    QTY_PLUS_SEL,
    '[class*="wrapperQuantities"] div:nth-child(3)',
    '[class*="wrapperQuantities"] div:last-child',
    '[class*="Quantities"] div:last-child',
    '[class*="quantities"] div:last-child',
]


def _get_current_qty(page) -> int:
    """Lee la cantidad actual del stepper. Re-consulta el DOM en cada llamada."""
    for sel in QTY_DISPLAY_FALLBACKS:
        try:
            el = page.query_selector(sel)
            if not el:
                continue
            txt = el.inner_text().strip()
            num = re.sub(r'\D', '', txt)
            if num:
                return int(num)
        except Exception:
            continue
    # Fallback: buscar cualquier div que contenga solo un número entre 1-99
    try:
        result = page.evaluate("""
            () => {
                const divs = document.querySelectorAll('div');
                for (const d of divs) {
                    const t = d.innerText.trim();
                    if (/^\\d{1,2}$/.test(t) && d.children.length === 0) {
                        return parseInt(t);
                    }
                }
                return 1;
            }
        """)
        return int(result or 1)
    except Exception:
        return 1


def _click_plus_until_qty(page, target_qty: int, log_fn=None) -> int:
    """
    Hace click en "+" hasta que el display muestre target_qty.
    IMPORTANTE: re-consulta el elemento en cada iteración para evitar
    referencias stale después del re-render de React.
    """
    # Verificar que el stepper existe antes de empezar
    plus_sel_found = None
    for sel in QTY_PLUS_FALLBACKS:
        try:
            el = page.query_selector(sel)
            if el and el.is_visible():
                plus_sel_found = sel
                break
        except Exception:
            continue

    current = _get_current_qty(page)

    if log_fn:
        log_fn(3, f'Cantidad inicial: {current} | objetivo: {target_qty}')
        if plus_sel_found:
            log_fn(3, f'Selector "+" activo: {plus_sel_found}')
        else:
            log_fn(3, 'Selector "+" no encontrado', ok=False)

    if not plus_sel_found:
        return current

    if current >= target_qty:
        log_fn and log_fn(3, f'Cantidad ya correcta: {current} ≥ {target_qty} ✓')
        return current

    max_attempts = (target_qty - current) + 10  # margen de seguridad
    attempts = 0
    consecutive_fails = 0

    while current < target_qty and attempts < max_attempts:
        attempts += 1

        # ── Re-consultar el botón en CADA iteración (evita stale reference) ──
        plus_btn = None
        for sel in QTY_PLUS_FALLBACKS:
            try:
                btn = page.query_selector(sel)
                if btn and btn.is_visible():
                    plus_btn = btn
                    break
            except Exception:
                continue

        if not plus_btn:
            log_fn and log_fn(3, f'Botón "+" desapareció en iteración {attempts}', ok=False)
            break

        # ── Click con múltiples estrategias ──────────────────────────────────
        clicked = False
        try:
            plus_btn.click(timeout=2000)
            clicked = True
        except Exception as e1:
            try:
                # JS click directo sobre el nodo
                page.evaluate('btn => btn.click()', plus_btn)
                clicked = True
            except Exception as e2:
                try:
                    # Dispara el evento de forma manual (React escucha esto)
                    page.evaluate(
                        'btn => btn.dispatchEvent(new MouseEvent("click", {bubbles:true, cancelable:true}))',
                        plus_btn
                    )
                    clicked = True
                except Exception:
                    pass

        if not clicked:
            log_fn and log_fn(3, f'No se pudo hacer click (intento {attempts})', ok=False)
            break

        # Esperar a que React actualice el estado
        page.wait_for_timeout(500)

        new_qty = _get_current_qty(page)

        if new_qty > current:
            current = new_qty
            consecutive_fails = 0
            log_fn and log_fn(3, f'  click #{attempts} → cantidad: {current}')
        else:
            consecutive_fails += 1
            log_fn and log_fn(3, f'  click #{attempts} → cantidad sin cambio ({current})', ok=False)
            if consecutive_fails >= 3:
                log_fn and log_fn(3, '3 clicks consecutivos sin efecto, deteniendo', ok=False)
                break
            page.wait_for_timeout(300)  # pequeña espera extra antes de reintentar

    if log_fn:
        if current >= target_qty:
            log_fn(3, f'✓ Cantidad final: {current} (objetivo {target_qty} alcanzado)')
        else:
            log_fn(3, f'✗ Cantidad final: {current} — no se alcanzó el objetivo {target_qty}', ok=False)

    return current


def _extract_prices_from_text(raw: str) -> list[float]:
    """Extrae todos los números que parecen precios del texto dado."""
    prices = []
    for m in re.finditer(
        r'(?:COP|CLP|MXN|ARS|\$|€)?\s*(\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{0,2})?|\d{4,}(?:[.,]\d{1,2})?)',
        raw
    ):
        p = _clean_price(m.group(0) or m.group(1))
        if p and p > 100:
            prices.append(p)
    return prices


def _parse_labeled_prices(raw: str) -> dict:
    """
    Intenta extraer subtotal y total buscando etiquetas como:
      'Subtotal', 'Total', 'Descuento', 'Total a pagar', etc.
    Retorna dict con keys: subtotal, total, discount_amount (todos float o None).
    Lógica:
      - subtotal  = precio base antes del descuento
      - total     = lo que el cliente paga (subtotal - descuento)
      - discount_amount = monto descontado (subtotal - total)
    """
    lines = raw.replace('\r', '').split('\n')
    found = {}

    # Patrones de etiquetas → clasificación
    LABEL_PATTERNS = [
        # subtotal / precio base
        (r'sub.?total|precio.base|precio.sin.descuento|antes', 'subtotal'),
        # total final a pagar (buscar primero 'total a pagar' antes que 'total' solo)
        (r'total.a.pagar|total.con.descuento|total.final|importe.total', 'total'),
        (r'(?<![a-z])total(?![a-z])', 'total'),
        # descuento / ahorro
        (r'descuento|ahorro|discount|savings', 'discount'),
    ]

    for line in lines:
        line_clean = line.strip()
        if not line_clean:
            continue
        line_low = line_clean.lower()

        for pattern, key in LABEL_PATTERNS:
            if re.search(pattern, line_low):
                # Extraer el primer precio de esta línea
                nums = _extract_prices_from_text(line_clean)
                if nums and key not in found:
                    found[key] = nums[0]
                break  # una etiqueta por línea

    return {
        'subtotal':        found.get('subtotal'),
        'total':           found.get('total'),
        'discount_amount': found.get('discount'),
    }


# ── Selectores del carrito ───────────────────────────────────────────────

# SUBTOTAL: precio del ítem en la lista (sin impuestos variables)
CART_ITEM_PRICE_SEL = (
    "#root > main > div.main-page-ioz > div > "
    "div.cartPage-body-i6u > div.cartPage-items_container-GWu > "
    "ul > li:nth-child(1) > div.product-details-pck > span.product-price-bEh"
)
CART_ITEM_PRICE_FALLBACKS = [
    CART_ITEM_PRICE_SEL,
    '[class*="cartPage-items"] li:first-child [class*="product-price"]',
    '[class*="items_container"] li:first-child [class*="price"]',
    '[class*="cartItem"] [class*="price"]:first-child',
    '[class*="cart-item"] [class*="price"]:first-child',
]

# TOTAL A PAGAR: selector exacto del total en el resumen del carrito
CART_TOTAL_SEL = (
    "#root > main > div.main-page-ioz > div > "
    "div.cartPage-body-i6u > div.cartPage-summary_container-n-G > "
    "div > div.priceSummary-root-95j > div.priceSummary-totalItems-lYi > span"
)
CART_TOTAL_FALLBACKS = [
    CART_TOTAL_SEL,
    '[class*="priceSummary-totalItems"] span',
    '[class*="totalItems"] span',
    '[class*="priceSummary"] [class*="total"] span',
    '[class*="priceSummary"] [class*="Total"] span',
]


def _extract_cart_discount_v2(page) -> dict:
    """
    Extrae precios del carrito con la siguiente lógica de fuentes:

      SUBTOTAL  → precio del ítem en la lista del carrito
                  (span.product-price-bEh dentro de li:nth-child(1))
                  ← no incluye impuestos variables → base limpia del descuento

      DESCUENTO → extraído del resumen (priceSummary) por etiqueta
      TOTAL     → extraído del resumen (priceSummary) por etiqueta
                  (lo que realmente paga el cliente, con impuestos)

    Cálculo:
      descuento_real% = (subtotal − total) / subtotal × 100
      monto_descontado = subtotal − total
      ej: subtotal=1140, total=798 → (1140−798)/1140×100 = 30% ✓
    """
    result = {
        'raw':              '',
        'raw_summary':      '',
        'prices':           [],
        'subtotal':         None,   # precio ítem (base del descuento, sin impuesto)
        'total':            None,   # total final del resumen (con impuesto si aplica)
        'price_full':       None,   # alias de subtotal
        'price_final':      None,   # alias de total
        'discount_amount':  None,   # monto $ descontado
        'discount_real':    None,   # % de descuento real calculado
        'selector_hit':     '',
        'item_price_hit':   '',
    }

    # ── 1. Subtotal: precio del ítem en la lista del carrito ─────────────
    subtotal = None
    for sel in CART_ITEM_PRICE_FALLBACKS:
        try:
            el = page.query_selector(sel)
            if el:
                raw_txt = el.inner_text().strip()
                p = _clean_price(raw_txt)
                if p and p > 10:
                    subtotal = p
                    result['item_price_hit'] = sel
                    result['raw'] = f'Item price ({sel}): {raw_txt}'
                    break
        except Exception:
            continue

    # ── 2. Total a pagar: selector directo en priceSummary-totalItems ───────
    total = None
    for sel in CART_TOTAL_FALLBACKS:
        try:
            el = page.query_selector(sel)
            if el:
                raw_txt = el.inner_text().strip()
                p = _clean_price(raw_txt)
                if p and p > 10:
                    total = p
                    result['selector_hit'] = sel
                    result['raw'] += f' | Total ({sel}): {raw_txt}'
                    break
        except Exception:
            continue

    # ── 3. Resumen completo: descuento por etiqueta (opcional) ────────────
    summary_raw = ''
    for sel in CART_SUMMARY_SELECTORS:
        try:
            el = page.query_selector(sel)
            if el:
                summary_raw = el.inner_text()
                break
        except Exception:
            continue

    if not summary_raw:
        try:
            summary_raw = page.inner_text('body')[:5000]
        except Exception:
            pass

    result['raw_summary'] = summary_raw

    labeled  = _parse_labeled_prices(summary_raw)
    disc_amt = labeled['discount_amount']

    # ── 4. Registrar todos los precios encontrados (debug) ───────────────
    all_prices = []
    if subtotal:  all_prices.append(subtotal)
    if total:     all_prices.append(total)
    all_prices += _extract_prices_from_text(summary_raw)
    result['prices'] = sorted(set(all_prices), reverse=True)[:12]

    # ── 5. Fallback total: inferir del resumen si no se obtuvo por selector ─
    if not total and subtotal and summary_raw:
        candidates = sorted(set(_extract_prices_from_text(summary_raw)), reverse=True)
        for p in candidates:
            if p < subtotal:
                pct = (subtotal - p) / subtotal * 100
                if 2 <= pct <= 90:
                    total = p
                    result['selector_hit'] = 'summary_fallback'
                    break

    # ── 6. Calcular descuento ─────────────────────────────────────────────
    if subtotal and total and subtotal > total:
        disc_amount_calc = round(subtotal - total, 2)
        disc_pct         = round((subtotal - total) / subtotal * 100, 1)

        result['subtotal']        = subtotal
        result['total']           = total
        result['price_full']      = subtotal
        result['price_final']     = total
        result['discount_amount'] = disc_amt or disc_amount_calc
        result['discount_real']   = disc_pct
    elif subtotal and not total:
        # Tenemos el precio del ítem pero no encontramos el total — reportar parcial
        result['subtotal']   = subtotal
        result['price_full'] = subtotal

    return result


def scrape_tier_price(page, url: str, expected_pct: float, qty_max: int, debug_mode: bool = False) -> dict:
    steps      = []
    screenshots = {}
    fields_filled = {}

    def log(n, msg, ok=True):
        icon = '✓' if ok else '✗'
        entry = {'n': n, 'ok': ok, 'msg': f'{icon} {msg}'}
        steps.append(entry)
        print(f'  [tier-price] paso {n}: {icon} {msg}')

    def snap(label):
        b64 = _snap(page, debug_mode)
        if b64:
            screenshots[label] = b64
        return b64

    try:
        # ── Paso 1: Cargar página ─────────────────────────────────
        log(1, f'Cargando página del producto…')
        page.goto(url, wait_until='domcontentloaded', timeout=30000)
        page.wait_for_timeout(3000)  # React hydration
        title = page.title()
        log(1, f'Cargado: "{title}" | URL: {page.url}')
        snap('01_producto')

        # ── Paso 2: Detectar y completar campos de fórmula ───────
        log(2, 'Buscando campos de prescripción…')
        for field_name, field_id in FORMULA_FIELDS:
            r = _fill_field_v2(page, field_name, field_id)
            if r['filled']:
                fields_filled[field_name] = r['value']
                log(2, f'{field_name} → "{r["value"]}"')
            else:
                log(2, f'{field_name}: {r["error"]}', ok=False)

        if not fields_filled:
            snap('02_no_fields')
            return {
                'status':  'warning',
                'message': 'No se encontraron campos de fórmula en este producto. '
                           'Puede que no sea un lente de contacto formulado, o la página cambió su estructura.',
                'details': {
                    'fields_filled': {},
                    'steps': steps,
                    'debug': {'screenshots': screenshots, 'page_url': page.url},
                },
            }

        snap('02_campos_llenos')
        log(2, f'{len(fields_filled)} de {len(FORMULA_FIELDS)} campos completados')
        page.wait_for_timeout(500)

        # ── Paso 3: Ajustar cantidad ──────────────────────────────
        log(3, f'Ajustando cantidad a {qty_max}…')
        current_qty = _get_current_qty(page)

        if current_qty >= qty_max:
            final_qty = current_qty
            log(3, f'Cantidad ya es {current_qty} ≥ {qty_max}, sin cambios necesarios')
        else:
            final_qty = _click_plus_until_qty(page, qty_max, log_fn=log)

        snap('03_cantidad')

        # ── Paso 4: Click "Agregar a la bolsa" ───────────────────
        log(4, 'Buscando botón de agregar al carrito…')
        original_url = page.url
        add_btn = None

        # Try text-based selectors first (most reliable)
        for txt in ADD_TO_BAG_TEXTS:
            for sel_pattern in [
                f'button:has-text("{txt}")',
                f'[role="button"]:has-text("{txt}")',
            ]:
                try:
                    btn = page.query_selector(sel_pattern)
                    if btn and btn.is_visible():
                        add_btn = btn
                        log(4, f'Botón encontrado: "{txt}"')
                        break
                except Exception:
                    continue
            if add_btn:
                break

        # Fallback: class-based
        if not add_btn:
            for cls_sel in [
                'button[class*="addToCart"]', 'button[class*="AddToCart"]',
                'button[class*="add-to-cart"]', 'button[class*="addToBag"]',
            ]:
                try:
                    btn = page.query_selector(cls_sel)
                    if btn and btn.is_visible():
                        add_btn = btn
                        log(4, f'Botón encontrado por clase: {cls_sel}')
                        break
                except Exception:
                    continue

        if not add_btn:
            snap('04_no_add_btn')
            return {
                'status':  'error',
                'message': 'No se encontró el botón de agregar al carrito. '
                           'Verifica que los campos de fórmula se hayan completado correctamente.',
                'details': {
                    'fields_filled': fields_filled,
                    'qty': final_qty,
                    'steps': steps,
                    'debug': {'screenshots': screenshots, 'page_url': page.url},
                },
            }

        # ── Paso 4b: Hacer click y esperar navegación ─────────────
        log(4, 'Haciendo click en el botón…')
        nav_success = False

        # Attempt A: expect full page navigation
        try:
            with page.expect_navigation(timeout=12000, wait_until='domcontentloaded'):
                add_btn.click()
            nav_success = True
            log(4, f'Navegación completa → {page.url}')
        except Exception as nav_err:
            log(4, f'Sin navegación directa ({type(nav_err).__name__}), esperando SPA…', ok=False)
            # Attempt B: wait for URL change
            try:
                page.wait_for_function(
                    f"window.location.href !== {json.dumps(original_url)}",
                    timeout=8000
                )
                nav_success = True
                log(4, f'URL cambió vía SPA → {page.url}')
            except Exception:
                log(4, 'URL no cambió, verificando si hay mini-cart activo…', ok=False)

        page.wait_for_timeout(2500)
        snap('04_post_click')

        # ── Paso 5: Asegurar que estamos en el carrito ────────────
        log(5, f'URL actual: {page.url}')
        cart_kws = ['carrito', 'cart', 'bolsa', 'bag', 'checkout']
        on_cart  = any(kw in page.url.lower() for kw in cart_kws)

        if not on_cart:
            log(5, 'No estamos en el carrito, intentando navegar directamente…', ok=False)

            # Derive cart URL
            cart_url = re.sub(r'(lentesplus\.com/\w{2})(/.*)?', r'\1/carrito', page.url)

            if cart_url and cart_url != page.url:
                try:
                    page.goto(cart_url, wait_until='domcontentloaded', timeout=20000)
                    log(5, f'Navegado a carrito: {page.url}')
                    snap('05_carrito_directo')
                except Exception as e:
                    log(5, f'Error al navegar al carrito: {e}', ok=False)
            else:
                log(5, 'No se pudo construir URL del carrito', ok=False)
        else:
            log(5, f'Ya en carrito ✓')

        snap('05_carrito')

        # ── Paso 5b: Esperar que el carrito cargue completamente ──
        # La página es una SPA (React): los precios se renderizan de forma asíncrona.
        # 1) networkidle: esperar a que no haya peticiones de red pendientes
        try:
            page.wait_for_load_state('networkidle', timeout=10000)
            log(5, 'Network idle ✓')
        except Exception:
            log(5, 'Network idle timeout — continuando de todas formas', ok=False)

        # 2) wait_for_selector: intentar el selector de precio del ítem (el más confiable)
        price_sel_appeared = False
        for _sel in [CART_ITEM_PRICE_SEL, '[class*="product-price"]',
                     '[class*="priceSummary"]', '[class*="cartPage-items"]']:
            try:
                page.wait_for_selector(_sel, timeout=6000)
                log(5, f'Selector de precio visible: {_sel}')
                price_sel_appeared = True
                break
            except Exception:
                continue

        if not price_sel_appeared:
            log(5, 'Ningún selector de precio apareció — esperando 4 s extra…', ok=False)
            page.wait_for_timeout(4000)

        snap('05_carrito_cargado')

        # ── Paso 6: Verificar que el carrito no está vacío ────────
        page_text = page.inner_text('body')
        if any(ph in page_text.lower() for ph in CART_EMPTY_PHRASES):
            log(6, 'Carrito vacío detectado', ok=False)
            return {
                'status':  'error',
                'message': 'El carrito está vacío después de intentar agregar el producto. '
                           'Los campos de fórmula pueden no haberse completado correctamente, '
                           'o el botón no ejecutó la acción.',
                'details': {
                    'fields_filled': fields_filled,
                    'qty':           final_qty,
                    'cart_url':      page.url,
                    'steps':         steps,
                    'debug': {
                        'screenshots':  screenshots,
                        'page_url':     page.url,
                        'body_snippet': page_text[:600],
                    },
                },
            }

        log(6, 'Carrito con contenido ✓')

        # ── Paso 7: Extraer precios del carrito ───────────────────
        log(7, 'Extrayendo precios del carrito…')
        cart_info = _extract_cart_discount_v2(page)

        subtotal    = cart_info.get('subtotal')
        actual_total = cart_info.get('total')
        disc_amount  = cart_info.get('discount_amount')

        log(7, (
            f'Ítem precio (subtotal): {subtotal} [{cart_info.get("item_price_hit","—")}] | '
            f'Total resumen: {actual_total} [{cart_info.get("selector_hit","—")}] | '
            f'Descuento resumen: {disc_amount}'
        ))

        details = {
            'fields_filled':    fields_filled,
            'qty':              final_qty,
            'cart_url':         page.url,
            'subtotal':         subtotal,
            'total':            actual_total,
            'price_full':       subtotal,
            'price_final':      actual_total,
            'discount_amount':  disc_amount,
            'discount_csv':     expected_pct,
            'steps':            steps,
        }

        if debug_mode:
            details['debug'] = {
                'screenshots':      screenshots,
                'page_url':         page.url,
                'cart_raw':         cart_info.get('raw', '')[:300],
                'cart_raw_summary': cart_info.get('raw_summary', '')[:400],
                'cart_all_prices':  cart_info.get('prices', []),
                'selector_hit':     cart_info.get('selector_hit', ''),
                'item_price_hit':   cart_info.get('item_price_hit', ''),
            }

        # ── Validación: subtotal × (1 − csv%) debe coincidir con total_resumen ──
        if not subtotal:
            return {
                'status':  'warning',
                'message': 'No se encontró el precio del ítem en el carrito. '
                           'Revisa el debug para ver los precios encontrados.',
                'details': details,
            }

        if not actual_total:
            return {
                'status':  'warning',
                'message': f'Se obtuvo el subtotal ({subtotal:,.0f}) pero no el total del resumen. '
                           'No se puede verificar el descuento.',
                'details': details,
            }

        # Calcular total esperado aplicando el % del CSV al subtotal del ítem
        expected_total   = round(subtotal * (1 - expected_pct / 100), 2)
        expected_disc_amt = round(subtotal * expected_pct / 100, 2)

        # Diferencia absoluta y relativa entre el total esperado y el real
        diff_abs = round(abs(expected_total - actual_total), 2)
        diff_pct  = round(diff_abs / subtotal * 100, 1)   # en puntos porcentuales sobre subtotal

        details['expected_total']    = expected_total
        details['expected_disc_amt'] = expected_disc_amt
        details['diff_abs']          = diff_abs
        details['diff_pp']           = diff_pct

        log(7, (
            f'Esperado: {subtotal:,.0f} × (1 − {expected_pct}%) = {expected_total:,.0f} | '
            f'Real: {actual_total:,.0f} | Dif: {diff_abs:,.0f} ({diff_pct} pp)'
        ), ok=(diff_pct <= 2))

        # Tolerancia: ±2 pp (equivale a unos pocos pesos de redondeo)
        if diff_pct <= 2:
            status = 'ok'
            msg = (
                f'Tier Price activo ✓ — '
                f'Subtotal {subtotal:,.0f} − {expected_pct}% = {expected_total:,.0f} '
                f'coincide con total {actual_total:,.0f}'
            )
        else:
            status = 'warning'
            msg = (
                f'Descuento no coincide — '
                f'Subtotal {subtotal:,.0f} × (1−{expected_pct}%) = {expected_total:,.0f} esperado '
                f'pero total real es {actual_total:,.0f} (dif: {diff_abs:,.0f} / {diff_pct} pp)'
            )

        return {'status': status, 'message': msg, 'details': details}

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        snap('exception')
        return {
            'status':  'error',
            'message': f'Error en scraping Tier Price: {str(e)}',
            'details': {
                'fields_filled': fields_filled,
                'steps':         steps,
                'traceback':     tb[-800:],
                'debug': {
                    'screenshots': screenshots,
                    'page_url':    page.url if page else '',
                },
            },
        }


# ── Dispatch: Playwright local o Browserless.io remoto ───────────
#
# En Vercel no hay Chromium local. Usamos Browserless.io como motor
# remoto: Playwright se conecta vía CDP a su API y todo el código
# de scraping funciona sin cambios.
#
# Config Vercel: BROWSERLESS_TOKEN = tu token de browserless.io
# Free tier: 6 h/mes   Paid: desde $49/mes
# ─────────────────────────────────────────────────────────────────

def _get_browser_and_ctx():
    """
    Retorna (pw_ctx, browser, engine_label) o lanza Exception.
    Prioridad:
      1. Chromium local (desarrollo)
      2. Browserless.io via CDP (Vercel / producción)
    """
    from playwright.sync_api import sync_playwright

    pw_ctx = sync_playwright().start()

    # ── 1. Intentar Chromium local ──────────────────────────────
    local_ok = False
    try:
        exe = pw_ctx.chromium.executable_path
        local_ok = bool(exe) and os.path.exists(exe)
    except Exception:
        pass

    if local_ok:
        browser = pw_ctx.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage',
                  '--disable-gpu', '--single-process'],
        )
        return pw_ctx, browser, 'playwright_local'

    # ── 2. Browserless.io remoto ────────────────────────────────
    bl_token = os.environ.get('BROWSERLESS_TOKEN', '').strip()
    if not bl_token:
        pw_ctx.stop()
        raise RuntimeError(
            'Chromium local no disponible y BROWSERLESS_TOKEN no configurado. '
            'Agrega BROWSERLESS_TOKEN en Vercel → Settings → Environment Variables.'
        )

    # Timeout 90 s para tier-price (múltiples pasos)
    cdp_url = f"wss://chrome.browserless.io?token={bl_token}&timeout=90000"
    print(f'  [scraper] Conectando a Browserless.io...')
    browser = pw_ctx.chromium.connect_over_cdp(cdp_url)
    return pw_ctx, browser, 'browserless'


def _playwright_available() -> bool:
    """True si hay Chromium local O si BROWSERLESS_TOKEN está configurado."""
    # Chromium local
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            exe = pw.chromium.executable_path
        if exe and os.path.exists(exe):
            return True
    except Exception:
        pass
    # Browserless remoto
    return bool(os.environ.get('BROWSERLESS_TOKEN', '').strip())


def _run_with_playwright(tipo_promo: str, url: str,
                         expected_pct: float, qty_max: int,
                         debug_mode: bool = False) -> dict:
    pw_ctx  = None
    browser = None
    try:
        pw_ctx, browser, engine = _get_browser_and_ctx()
    except ImportError:
        return {
            'status':  'error',
            'message': 'Playwright no está instalado en este entorno.',
            'details': {'engine': 'playwright'},
        }
    except Exception as e:
        return {
            'status':  'error',
            'message': str(e),
            'details': {'engine': 'playwright'},
        }

    try:
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
        tipo = tipo_promo.lower().strip()
        if tipo in ('precio tachado', 'tachado', 'strike', 'strike price'):
            result = scrape_precio_tachado(page, url, expected_pct)
        elif tipo in ('tier price', 'tier'):
            result = scrape_tier_price(page, url, expected_pct, qty_max, debug_mode=debug_mode)
        else:
            result = {
                'status':  'pending',
                'message': f'Tipo "{tipo_promo}" aún sin verificador implementado.',
                'details': {},
            }
        result['engine'] = engine
    except Exception as e:
        import traceback
        result = {
            'status':  'error',
            'message': f'Error durante el scraping: {e}',
            'details': {'engine': engine, 'traceback': traceback.format_exc()[-800:]},
        }
    finally:
        try:
            browser.close()
        except Exception:
            pass
        try:
            pw_ctx.stop()
        except Exception:
            pass

    result.setdefault('tipo', tipo_promo)
    return result


# ── Dispatch: HTTP / Magento GraphQL (Vercel fallback) ────────────

import urllib.request as _urllib_req


def _gql_post(gql_url: str, query: str, variables: dict = None) -> dict:
    payload = json.dumps({'query': query, 'variables': variables or {}}).encode('utf-8')
    req = _urllib_req.Request(
        gql_url, data=payload, method='POST',
        headers={
            'Content-Type': 'application/json',
            'Accept':       'application/json',
            'User-Agent':   'Mozilla/5.0 (compatible; PromoTracker/1.0)',
        },
    )
    with _urllib_req.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read())


def _http_precio_tachado(gql_url: str, sku: str, expected_pct: float) -> dict:
    query = """
    query($sku: String!) {
      products(filter: { sku: { eq: $sku } }) {
        items {
          sku name
          price_range {
            minimum_price {
              regular_price { value }
              final_price   { value }
              discount { percent_off }
            }
          }
        }
      }
    }
    """
    data  = _gql_post(gql_url, query, {'sku': sku})
    items = (data.get('data') or {}).get('products', {}).get('items', [])
    if not items:
        return {
            'status':  'warning',
            'message': f'SKU "{sku}" no encontrado vía GraphQL.',
            'details': {'engine': 'http_graphql', 'gql_url': gql_url},
        }
    mp      = items[0]['price_range']['minimum_price']
    regular = mp['regular_price']['value']
    final   = mp['final_price']['value']
    pct_off = mp['discount']['percent_off']

    details = {
        'engine': 'http_graphql',
        'price_full': regular, 'price_final': final,
        'discount_real': pct_off, 'discount_csv': expected_pct,
    }
    if pct_off <= 0:
        return {'status': 'warning',
                'message': f'Sin precio tachado — {regular:,.0f} = {final:,.0f} (0% desc).',
                'details': details}
    diff   = round(abs(pct_off - expected_pct), 1)
    status = 'ok' if diff <= 2 else 'warning'
    msg    = (f'Precio tachado ✓ — {pct_off}% (esperado {expected_pct}%)' if status == 'ok'
              else f'Descuento {pct_off}% vs esperado {expected_pct}% — dif: {diff} pp')
    details['diff_pp'] = diff
    return {'status': status, 'message': msg, 'details': details}


def _http_tier_price(gql_url: str, sku: str, expected_pct: float, qty_max: int) -> dict:
    """
    Simula el flujo de carrito vía GraphQL:
      1. createGuestCart
      2. addSimpleProductsToCart (qty = qty_max)
      3. Lee precios del carrito — el tier price se refleja en row_total
    """
    # ── 1. Crear carrito de invitado ──────────────────────────────
    cart_data = _gql_post(gql_url, 'mutation { createGuestCart { cart { id } } }')
    cart_id   = ((cart_data.get('data') or {}).get('createGuestCart') or {}).get('cart', {}).get('id')
    if not cart_id:
        errs = cart_data.get('errors', [])
        return {
            'status':  'error',
            'message': 'No se pudo crear carrito: ' + (errs[0].get('message', str(cart_data)[:200]) if errs else str(cart_data)[:200]),
            'details': {'engine': 'http_graphql'},
        }

    # ── 2. Agregar producto con qty = qty_max ─────────────────────
    add_q = """
    mutation($cartId: String!, $sku: String!, $qty: Float!) {
      addSimpleProductsToCart(input: {
        cart_id: $cartId,
        cart_items: [{ data: { sku: $sku, quantity: $qty } }]
      }) {
        cart {
          items {
            quantity
            prices {
              price     { value }
              row_total { value }
              discounts { amount { value } label }
            }
          }
          prices {
            subtotal_excluding_tax { value }
            subtotal_including_tax { value }
            grand_total            { value }
            discounts { amount { value } label }
          }
        }
      }
    }
    """
    add_data = _gql_post(gql_url, add_q, {'cartId': cart_id, 'sku': sku, 'qty': float(qty_max)})
    cart     = ((add_data.get('data') or {}).get('addSimpleProductsToCart') or {}).get('cart')

    if not cart:
        errs    = add_data.get('errors', [])
        err_msg = errs[0].get('message', str(add_data)[:300]) if errs else str(add_data)[:300]
        return {
            'status':  'error',
            'message': f'Error al agregar al carrito: {err_msg}',
            'details': {'engine': 'http_graphql', 'cart_id': cart_id},
        }

    # ── 3. Analizar precios ───────────────────────────────────────
    items       = cart.get('items', [])
    cart_prices = cart.get('prices', {})
    subtotal    = (cart_prices.get('subtotal_excluding_tax') or {}).get('value')
    grand_total = (cart_prices.get('grand_total') or {}).get('value')
    discounts   = cart_prices.get('discounts') or []

    item_price = row_total = None
    if items:
        ip = (items[0].get('prices') or {}).get('price') or {}
        rt = (items[0].get('prices') or {}).get('row_total') or {}
        item_price = ip.get('value')
        row_total  = rt.get('value')

    # Calcular % de descuento real
    actual_pct = 0.0
    if item_price and row_total and item_price > 0:
        base = item_price * qty_max
        if base > row_total:
            actual_pct = round((base - row_total) / base * 100, 1)
    elif subtotal and grand_total and subtotal > grand_total:
        actual_pct = round((subtotal - grand_total) / subtotal * 100, 1)

    disc_labels = [f"{d.get('label')}: {d.get('amount',{}).get('value',0):,.0f}"
                   for d in discounts if d]

    details = {
        'engine':        'http_graphql',
        'cart_id':       cart_id,
        'sku':           sku,
        'qty':           qty_max,
        'item_price':    item_price,
        'row_total':     row_total,
        'subtotal':      subtotal,
        'grand_total':   grand_total,
        'discounts':     disc_labels,
        'discount_real': actual_pct,
        'discount_csv':  expected_pct,
    }

    if actual_pct <= 0:
        return {
            'status':  'warning',
            'message': (f'Tier Price no detectado con qty={qty_max}. '
                        f'Precio unitario: {item_price}, Row total: {row_total}. '
                        f'Verifica que el SKU sea correcto y la promo esté activa.'),
            'details': details,
        }

    diff   = round(abs(actual_pct - expected_pct), 1)
    status = 'ok' if diff <= 2 else 'warning'
    msg    = (f'Tier Price activo ✓ — {actual_pct}% con qty={qty_max} (esperado {expected_pct}%)' if status == 'ok'
              else f'Descuento {actual_pct}% vs esperado {expected_pct}% — dif: {diff} pp')
    details['diff_pp'] = diff
    return {'status': status, 'message': msg, 'details': details}


def _run_http(tipo_promo: str, url: str, expected_pct: float,
              qty_max: int, sku: str = '') -> dict:
    """Fallback sin navegador: usa Magento GraphQL API."""
    try:
        from urllib.parse import urlparse
        parsed  = urlparse(url)
        gql_url = f"{parsed.scheme}://{parsed.netloc}/graphql"
        tipo    = tipo_promo.lower().strip()

        if not sku:
            return {
                'status':  'warning',
                'message': 'Se requiere el campo "sku" para la verificación vía GraphQL (motor HTTP).',
                'details': {'engine': 'http_graphql', 'gql_url': gql_url},
            }

        if tipo in ('precio tachado', 'tachado', 'strike', 'strike price'):
            return _http_precio_tachado(gql_url, sku, expected_pct)
        elif tipo in ('tier price', 'tier'):
            return _http_tier_price(gql_url, sku, expected_pct, qty_max)
        else:
            return {
                'status':  'pending',
                'message': f'Tipo "{tipo_promo}" sin verificador HTTP. Usa Playwright localmente.',
                'details': {'engine': 'http_graphql'},
            }
    except Exception as e:
        import traceback
        return {
            'status':  'error',
            'message': f'Error en motor HTTP/GraphQL: {e}',
            'details': {'engine': 'http_graphql', 'traceback': traceback.format_exc()[-600:]},
        }


# ── HTTP Handler ─────────────────────────────────────────────────

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
        sku          = (body.get('sku')          or '').strip()
        expected_pct = float(body.get('desc_pct', 0) or 0)
        qty_max_raw  = str(body.get('qty_max_promo', '1') or '1').strip()
        debug_mode   = bool(body.get('debug', False))

        # Extraer solo dígitos de qty_max_promo (puede venir como "4", "4 cajas", etc.)
        qty_digits = re.sub(r'\D', '', qty_max_raw)
        qty_max    = max(1, int(qty_digits)) if qty_digits else 1
        print(f"  [scraper] qty_max_raw={qty_max_raw!r} → qty_max={qty_max} sku={sku!r}")

        if not url:
            return json_response(self, 400, {'status': 'error', 'message': 'Campo url requerido'})
        if not tipo_promo:
            return json_response(self, 400, {'status': 'error', 'message': 'Campo tipo_promo requerido'})

        t0 = time.time()
        try:
            if _playwright_available():
                print('  [scraper] Motor: Playwright')
                result = _run_with_playwright(tipo_promo, url, expected_pct, qty_max, debug_mode=debug_mode)
            else:
                print('  [scraper] Motor: HTTP/GraphQL (Playwright no disponible en este entorno)')
                result = _run_http(tipo_promo, url, expected_pct, qty_max, sku=sku)
        except Exception as e:
            import traceback
            result = {
                'status':  'error',
                'message': f'Error inesperado en el motor de verificación: {e}',
                'details': {'traceback': traceback.format_exc()[-600:]},
            }

        result['elapsed_ms'] = round((time.time() - t0) * 1000)
        result['url']        = url
        result['sku']        = sku
        result.setdefault('tipo', tipo_promo)

        return json_response(self, 200, result)

    def log_message(self, format, *args):
        pass
