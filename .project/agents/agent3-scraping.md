# 🤖 Agente 3: Automation, Scraping & Data Intelligence (Python)

> **Última actualización:** 2026-05-05

## Identidad
- **Rol:** Especialista en automatización web, integración DWH y análisis con IA.
- **Stack:** Python 3.x + Playwright + Metabase MCP (SSE) + Anthropic API (urllib)
- **Zona:** `/api/analytics.py`, `/api/scraper.py`, `/api/scraper_stats.py`, `/api/promo.py`

---

## 🛠️ Skills Disponibles

### Skill A — Simulación de Carrito (Playwright)
**Archivo:** `api/scraper.py`
- Simula agregar un producto al carrito usando Playwright headless.
- Captura precio tachado (original) y tier price (precio con descuento aplicado).
- Modo debug: captura de pantalla, HTML del carrito, selector inspector.
- **IMPORTANTE:** Playwright solo se usa en este archivo. Otros endpoints usan `requests`.

### Skill B — Comparativa Analítica
**Archivo:** `api/analytics.py`
- Lista productos del CSV maestro con su estado de promo.
- Compara precio esperado (CSV) vs precio real (scraping).
- Endpoint: `GET /api/analytics` → lista paginada con `has_discrepancy` flag.

### Skill C — DWH Integration (Metabase MCP)
**Archivo:** `api/promo.py`
- Llama al DWH de lentesplus via Metabase MCP sobre SSE.
- Helpers internos: `_mcp_call()`, `_parse_sse()`, `_rows_from_text()`
- Tablas principales: `Silver.sales`, `Silver.sales_products`
- **Reglas críticas:**
  - Header: `Accept: application/json, text/event-stream`
  - SSL bypass en dev: `ssl.CERT_NONE`
  - Row limit máximo: `500` (nunca más)
  - Verificar `isError` antes de parsear JSON
  - Formato respuesta inner data: objeto `{"0":{row}, "1":{row}}` (no array)

### Skill D — AI Analysis (Claude Haiku)
**Archivo:** `api/promo.py` → `mode=analysis`
- Llama a `https://api.anthropic.com/v1/messages` con `urllib.request` (sin SDK).
- Modelo: `claude-haiku-4-5`
- Auth: header `x-api-key: $ANTHROPIC_API_KEY`
- Prompt incluye: métricas del período actual + período anterior, top cupones, top productos.
- Output: `{ insights, forecast, recommendations, boost_coupons, review_coupons, kpis }`

---

## 📊 Endpoint Unificado: `api/promo.py`

Sistema de modos via `?mode=` para mantenerse dentro del límite de 12 funciones Vercel:

| Mode             | Descripción                                              | Parámetros clave                              |
|------------------|----------------------------------------------------------|-----------------------------------------------|
| `performance`    | Métricas grupadas por `coupon_code`                      | `country`, `date_from`, `date_to`             |
| `orders`         | Órdenes individuales de un cupón                         | `coupon_code`, `country`, `date_from`, `date_to` |
| `products`       | Productos de una orden (`Silver.sales_products`)         | `order_number`                                |
| `tier_filters`   | Fabricantes/tipos/duraciones distintos (para dropdowns)  | `country`, `date_from`, `date_to`             |
| `product_tier`   | Top productos vendidos con promos, ordenados             | `country`, `date_from`, `date_to`, `sort_by`  |
| `analysis`       | Análisis AI completo con Claude Haiku                    | `country`, `date_from`, `date_to`             |

---

## 📋 Columnas Clave DWH

**`Silver.sales`**
| Columna          | Tipo    | Descripción                          |
|------------------|---------|--------------------------------------|
| `coupon_code`    | string  | Código del cupón aplicado            |
| `order_number`   | string  | Número de orden                      |
| `status`         | string  | Estado de la orden                   |
| `total`          | float   | Total de la orden                    |
| `gmv_usd`        | float   | GMV en USD                           |
| `discount_total` | float   | Monto de descuento aplicado          |
| `updated_at`     | date    | Fecha de actualización               |
| `empresa`        | string  | Empresa (país/tienda)                |
| `country`        | string  | País                                 |

**`Silver.sales_products`**
| Columna           | Tipo    | Descripción                         |
|-------------------|---------|-------------------------------------|
| `order_number`    | string  | Número de orden (FK)                |
| `name`            | string  | Nombre del producto                 |
| `sku`             | string  | SKU del producto                    |
| `type`            | string  | Tipo de producto                    |
| `use_type`        | string  | Tipo de uso (Diario, Mensual, etc.) |
| `use_duration`    | string  | Duración de uso                     |
| `manufacturer`    | string  | Fabricante                          |
| `formula`         | string  | Fórmula                             |
| `quantity_actual` | int     | Unidades vendidas                   |
| `price_actual`    | float   | Precio de venta                     |
| `total`           | float   | Total línea                         |
| `gmv_usd`         | float   | GMV en USD                          |
| `empresa`         | string  | Empresa                             |

---

## ⚠️ Notas Importantes

- Filtrar costos de envío en queries de productos con: `NOT ILIKE '%envío%' AND NOT ILIKE '%envio%' AND NOT ILIKE '%shipping%' AND NOT ILIKE '%flete%'`
- El mismo producto puede aparecer con diferente SKU en la misma orden — esto es esperado, no un error.
- En `mode=product_tier`, el GROUP BY incluye `sku` para mantener granularidad por variante.
