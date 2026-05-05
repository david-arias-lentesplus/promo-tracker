# 📏 RULES.md — Reglas de Operación del Equipo

> Estas reglas garantizan la coherencia del proyecto y evitan errores de integración entre agentes.
> **Todos los agentes deben respetarlas sin excepción.**
> **Última actualización:** 2026-05-05

---

## Regla #1 — Trabajo Incremental (No Big Bang)

> ❌ Nunca generar todo el código del proyecto de una sola vez.
> ✅ Resolver únicamente la fase, vista o endpoint solicitado en el prompt actual.

**Por qué:** Permite revisión, testing y ajuste iterativo. Evita deuda técnica acumulada.

---

## Regla #2 — Separación Estricta Front / Back

| Zona          | Tecnología permitida          | Zona prohibida para el agente |
|---------------|-------------------------------|-------------------------------|
| `/src/`       | React, Tailwind, JS/JSX       | Agentes 2, 3, 4               |
| `/api/`       | Python puro, sin frameworks   | Agente 1                      |
| `vercel.json` | JSON de config                | Agentes 1, 2, 3               |
| `/data/`      | CSV de datos (read-only)      | Solo lectura por Agentes 2, 3 |
| `/electron/`  | Electron main process         | Solo Agente 4                 |

---

## Regla #3 — Siempre Especificar Ruta y Nombre de Archivo

Cada bloque de código generado debe ir precedido de su ruta completa:
```
// 📄 /src/pages/HSInfo.jsx
# 📄 /api/hs_info.py
```

---

## Regla #4 — Seguridad por Defecto

- Todo endpoint en `/api/` (excepto `/api/login.py`) **debe** validar el JWT al inicio.
- Nunca exponer datos sin autenticación.
- Nunca hardcodear secrets, contraseñas, tokens o API keys en el código.
- Usar variables de entorno de Vercel para toda información sensible: `JWT_SECRET`, `METABASE_MCP_URL`, `ANTHROPIC_API_KEY`.

---

## Regla #5 — Sin Frameworks Pesados

| ✅ Permitido                                  | ❌ Prohibido                            |
|----------------------------------------------|----------------------------------------|
| React (Vite)                                  | Next.js, Remix, Angular, Vue           |
| Tailwind CSS (clases puras)                   | Material UI, Ant Design, Bootstrap     |
| Python stdlib + pandas + PyJWT + urllib       | Flask, Django, FastAPI, SQLAlchemy     |
| requests + BeautifulSoup4                     | Selenium, Puppeteer                    |
| **Playwright** (solo en `api/scraper.py`)     | Playwright en otros endpoints          |

> ⚠️ **Playwright** está permitido ÚNICAMENTE en `api/scraper.py`. Todos los demás endpoints Python deben usar `requests` o `urllib`.

---

## Regla #6 — Convenciones de Nombres de Archivo

| Tipo                      | Convención            | Ejemplo                    |
|---------------------------|-----------------------|----------------------------|
| Componentes React         | PascalCase.jsx        | `DataTable.jsx`            |
| Páginas React             | PascalCase.jsx        | `Analytics.jsx`            |
| Hooks personalizados      | camelCase.js          | `useAuth.js`               |
| Funciones Python (api)    | snake_case.py         | `hs_info.py`               |
| Utilidades Python (priv.) | _snake_case.py        | `_auth.py`, `_data_service.py` |

---

## Regla #7 — Límite de 12 Funciones en Vercel Hobby

El plan Hobby de Vercel permite **máximo 12 serverless functions**.

**Funciones actuales (12/12):**
`login`, `raw_data`, `stats`, `hs_info`, `campaigns`, `users`, `me`, `notifications`, `analytics`, `scraper`, `scraper_stats`, `promo`

> ❌ NO agregar nuevos archivos `.py` en `/api/` sin consolidar o eliminar otro primero.
> ✅ Para nuevas funcionalidades: agregar un `?mode=nuevo_modo` a un endpoint existente (ejemplo: `api/promo.py`).

**Patrón de consolidación (`?mode=`):**
```python
mode = req.args.get('mode', 'default')
if mode == 'feature_a': return feature_a(req)
if mode == 'feature_b': return feature_b(req)
```

---

## Regla #8 — `apiRequest()` en el Frontend

La función `apiRequest()` en `src/utils/api.js` **prepend automáticamente** `/api` a la ruta.

> ❌ `apiRequest('/api/promo?mode=performance')` — produce `/api/api/promo` (doble prefijo)
> ✅ `apiRequest('/promo?mode=performance')` — produce `/api/promo` (correcto)

---

## Regla #9 — Integración con Metabase MCP (DWH)

Al llamar al DWH via Metabase MCP desde Python:

1. **Header obligatorio:** `Accept: application/json, text/event-stream`
2. **SSL bypass en local (macOS):** `ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE`
3. **Row limit máximo:** `500` (el servidor rechaza valores mayores con `isError: true`)
4. **Verificar `isError`** en la respuesta antes de intentar parsear JSON.
5. **Formato de respuesta:** SSE `event: message\ndata: {...}` — inner `data` es objeto `{"0":{row}, "1":{row}}` (no array).
6. **Filtrar costos de envío** en queries de productos: `NOT ILIKE '%envío%' AND NOT ILIKE '%shipping%'`

---

## Regla #10 — Gestión del CSV

- El archivo CSV maestro vive en `/data/promotions.csv` (+ `/data/url_sku_images.csv`).
- **Nunca exponer el CSV directamente** como endpoint público.
- Si el esquema del CSV cambia, actualizar primero `agent2-data-engineer.md` (tabla de columnas).
- El CSV es de solo lectura — los scripts Python **no deben modificarlo**.

---

## Regla #11 — Tolerancia a Errores

Todos los endpoints deben manejar:
- `try/except` general con respuesta `{"status": "error", "message": "..."}`.
- Status HTTP correcto: 200, 401, 404, 500.
- El frontend debe mostrar estados de error al usuario (no pantallas en blanco).

---

## Regla #12 — Actualización de Documentación

Si una decisión de implementación cambia la arquitectura:
1. Actualizar el archivo de agente correspondiente en `.project/agents/`.
2. Actualizar `CONTEXT.md` si cambia la estructura de carpetas o el stack.
3. Actualizar `RULES.md` si cambia una restricción técnica.
4. Registrar el cambio con fecha y motivo.
