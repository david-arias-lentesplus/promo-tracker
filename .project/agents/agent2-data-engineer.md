# 🤖 Agente 2: Data Engineer (Procesamiento CSV en Python)

> **Última actualización:** 2026-05-05

## Identidad
- **Rol:** Data Engineer backend especializado en procesamiento de datos tabulares en entornos Serverless.
- **Responsabilidad:** Leer, limpiar, transformar y servir el CSV maestro de promociones como JSON.
- **Stack:** Python 3.x + pandas (o csv nativo) en Vercel Serverless Functions.
- **Zona:** `/api/hs_info.py`, `/api/campaigns.py`, `/api/raw_data.py`, `/api/stats.py`, `/api/notifications.py`, `/api/_data_service.py`

---

## 📊 Fuentes de Datos

### CSV Maestro: `/data/promotions.csv`

**Columnas reales del CSV:**

| Columna              | Tipo    | Descripción                                         |
|----------------------|---------|-----------------------------------------------------|
| `sku`                | string  | Código único del producto                           |
| `nombre_producto`    | string  | Nombre del producto                                 |
| `fabricante`         | string  | Marca / fabricante                                  |
| `date_start`         | date    | Inicio de vigencia de la promo                      |
| `date_end`           | date    | Fin de vigencia de la promo                         |
| `promo_marca`        | string  | Descripción de la promo del fabricante              |
| `product_type`       | string  | Tipo de producto (Lente de Contacto, Gafas, etc.)  |
| `use_type`           | string  | Tipo de uso (Diario, Mensual, Quincenal, etc.)      |
| `use_duration`       | string  | Duración de uso                                     |
| `url_producto`       | string  | URL del producto en el e-commerce                   |
| `qty_max_promo`      | int     | Cantidad máxima permitida con promo                 |
| `total_desc_pct`     | float   | Porcentaje total de descuento                       |
| `pais_nombre`        | string  | País / región                                       |

### CSV Imágenes: `/data/url_sku_images.csv`

| Columna      | Descripción                          |
|--------------|--------------------------------------|
| `sku`        | SKU para hacer JOIN con promotions   |
| `url_image`  | URL de la imagen del producto        |

---

## 🛠️ Skills Disponibles

### Skill A — Parseo de CSV via `_data_service.py`

El servicio compartido `api/_data_service.py` es la **fuente única** de datos CSV. Todos los demás endpoints lo importan.

**Funciones principales:**
- `load_data(country=None, date_from=None, date_to=None, product_type=None, use_type=None, use_duration=None)` → DataFrame filtrado
- `get_active_promos(df)` → Solo promos vigentes a la fecha actual
- `get_meta(df)` → Metadatos (unique_types, unique_use_types, unique_use_durations)

**País excluido de todo el sistema:** `GL` (Guatemala Lentes) — filtrado en `_data_service.py`.

**Patrón de uso en endpoints:**
```python
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _data_service import load_data

country    = req.args.get('country', '')
date_from  = req.args.get('date_from', '')
date_to    = req.args.get('date_to', '')

df = load_data(country=country, date_from=date_from, date_to=date_to)
```

### Skill B — Segmentación y Filtrado por Vista

| Endpoint            | Función principal                                                           |
|---------------------|-----------------------------------------------------------------------------|
| `hs_info.py`        | Promos vigentes agrupadas por fabricante, con días restantes                |
| `campaigns.py`      | 3 modelos: BestSeller, Fabricantes, Gafas + email copy generado             |
| `raw_data.py`       | CSV paginado con todos los filtros                                           |
| `stats.py`          | KPIs: total promos, activas, por vencer, fabricantes                        |
| `notifications.py`  | Promos que vencen en los próximos N días                                     |

### Skill C — Generación de Email Copy (campaigns.py)

El endpoint `campaigns.py` genera automáticamente copy de email para cada grupo/modelo:
- **BestSeller:** Top 6 productos activos (J&J siempre primero), con asunto/preheader/body/botón.
- **Fabricantes:** Grupos por fabricante + promo_marca, ordenados por days_remaining.
- **Gafas:** Productos tipo "Gafas" agrupados por fabricante.

> ⚠️ El tab **"Top Promos"** en Campaigns.jsx **NO usa** `campaigns.py`. Usa `api/promo.py?mode=product_tier` (DWH). El email copy del tab Top Promos se genera client-side en el frontend.

---

## ⚠️ Notas Importantes

- **Filas sin `Date Start`** se filtran en `_data_service.py` (evita errores de parseo).
- **Excluir GL:** El país "GL" está excluido de todo el sistema a nivel de `_data_service.py`.
- **Imágenes:** El merge con `url_sku_images.csv` se hace en `_data_service.py` vía JOIN en `sku`.
- **URLs de producto:** Columna `url_producto` disponible para links directos al e-commerce.
