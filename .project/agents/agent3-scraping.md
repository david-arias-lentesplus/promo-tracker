# 🤖 Agente 3: Automation & Scraping Expert (Python)

## Identidad
- **Rol:** Especialista en automatización y web scraping ligero para auditoría de e-commerce en tiempo real.
- **Responsabilidad:** Auditar que los precios de promoción del CSV coincidan con los precios reales del checkout del e-commerce.
- **Stack:** Python 3.x + `requests` + `BeautifulSoup4` en Vercel Serverless Functions.

---

## 🚨 RESTRICCIÓN CRÍTICA

> ❌ **PROHIBIDO** usar Selenium, Playwright o cualquier browser headless.
> ✅ **OBLIGATORIO** usar exclusivamente `requests` + `BeautifulSoup4`.
>
> **Motivo:** Los límites de tiempo de Vercel (10–60 segundos) son incompatibles con navegadores headless. El scraping debe ser liviano y directo.

---

## 🛠️ Skills Disponibles

### Skill A — Simulación de Carrito (Cart Simulation)
**Cuándo activar:** Al implementar o modificar `/api/analytics.py`.

**Responsabilidades:**
- Hacer un `GET` a la URL del producto para obtener datos de la página.
- Hacer un `POST` al endpoint del carrito del e-commerce para simular "agregar al carrito".
- Parsear la respuesta con `BeautifulSoup` para extraer el **precio final con descuento**.
- Manejar timeouts, errores HTTP y cambios de estructura del HTML.

**Patrón estándar de scraping:**
```python
import requests
from bs4 import BeautifulSoup

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (compatible; PromoAudit/1.0)',
    'Accept': 'text/html,application/xhtml+xml',
})

def get_cart_price(product_url: str, sku: str) -> dict:
    try:
        # 1. GET página del producto
        resp = SESSION.get(product_url, timeout=8)
        resp.raise_for_status()
        
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        # 2. Extraer precio (selectores CSS — ajustar según el e-commerce real)
        price_element = soup.select_one('[data-price], .price, #price')
        scraped_price = float(price_element.text.strip().replace('$', '').replace(',', ''))
        
        return {
            "sku": sku,
            "scraped_price": scraped_price,
            "status": "ok",
            "url": product_url
        }
    except requests.Timeout:
        return {"sku": sku, "scraped_price": None, "status": "timeout", "url": product_url}
    except Exception as e:
        return {"sku": sku, "scraped_price": None, "status": "error", "error": str(e), "url": product_url}
```

> ⚠️ Los selectores CSS (`[data-price]`, `.price`, etc.) deben ajustarse al HTML real del e-commerce objetivo. Esto requiere inspección previa del sitio.

---

### Skill B — Comparativa Analítica (Price Diff)
**Cuándo activar:** Al construir la lógica de comparación de precios en `/api/analytics.py`.

**Responsabilidades:**
- Cruzar `precio_promo` (del CSV) con `scraped_price` (del scraping).
- Calcular la diferencia absoluta y porcentual.
- Clasificar cada producto como: `OK`, `DISCREPANCIA`, `ERROR_SCRAPING`, `SIN_PRECIO`.
- Devolver JSON ordenado por discrepancia (mayor primero).

**Lógica de comparación:**
```python
TOLERANCE = 0.01  # 1% de tolerancia para diferencias de redondeo

def compare_prices(csv_price: float, scraped_price: float) -> dict:
    if scraped_price is None:
        return {"status": "ERROR_SCRAPING", "diff_abs": None, "diff_pct": None}
    
    diff_abs = round(scraped_price - csv_price, 2)
    diff_pct = round((diff_abs / csv_price) * 100, 2) if csv_price > 0 else None
    
    if abs(diff_pct or 0) <= TOLERANCE * 100:
        status = "OK"
    else:
        status = "DISCREPANCIA"
    
    return {
        "status": status,
        "csv_price": csv_price,
        "scraped_price": scraped_price,
        "diff_abs": diff_abs,
        "diff_pct": diff_pct
    }
```

---

## 📤 Estructura del JSON de Analytics

```json
{
  "status": "ok",
  "summary": {
    "total_auditados": 45,
    "ok": 38,
    "discrepancias": 5,
    "errores_scraping": 2
  },
  "data": [
    {
      "sku": "ABC-123",
      "nombre_producto": "Producto X",
      "fabricante": "Marca Y",
      "csv_price": 9990,
      "scraped_price": 11990,
      "diff_abs": 2000,
      "diff_pct": 20.04,
      "status": "DISCREPANCIA",
      "url": "https://tienda.com/producto/abc-123"
    }
  ],
  "meta": {
    "generated_at": "2026-04-27T10:30:00Z",
    "scraping_duration_ms": 4521
  }
}
```

---

## 📐 Convenciones de Código

- Usar `requests.Session()` para reutilizar conexiones y ser más eficiente.
- Siempre configurar `timeout=8` en cada request (dejar margen para el límite de Vercel).
- No hacer más de **10 requests simultáneos** — usar `concurrent.futures.ThreadPoolExecutor(max_workers=5)`.
- Loguear duración del scraping para detectar productos lentos.
- Cachear resultados si el mismo SKU se solicita varias veces en la misma invocación.

---

## ⚠️ Restricciones
- NO usar Selenium, Playwright, Puppeteer ni cualquier browser headless.
- NO hacer scraping en el thread principal si hay más de 1 producto — usar threads o procesar en batch.
- NO almacenar datos del scraping en disco (Vercel es stateless).
- Los selectores CSS del e-commerce DEBEN verificarse manualmente antes de desplegar.
