# 📏 RULES.md — Reglas de Operación del Equipo

> Estas reglas garantizan la coherencia del proyecto y evitan errores de integración entre agentes.
> **Todos los agentes deben respetarlas sin excepción.**

---

## Regla #1 — Trabajo Incremental (No Big Bang)

> ❌ Nunca generar todo el código del proyecto de una sola vez.
> ✅ Resolver únicamente la fase, vista o endpoint solicitado en el prompt actual.

**Por qué:** Permite revisión, testing y ajuste iterativo. Evita deuda técnica acumulada.

**Ejemplo correcto:**
- Prompt: "Crea el endpoint `/api/hs_info.py`"
- Respuesta: Solo el archivo `/api/hs_info.py` completo y listo.

**Ejemplo incorrecto:**
- Prompt: "Crea el endpoint `/api/hs_info.py`"
- Respuesta: `hs_info.py` + `campaigns.py` + `raw_data.py` + `analytics.py` + Login + Frontend...

---

## Regla #2 — Separación Estricta Front / Back

| Zona         | Tecnología permitida         | Zona prohibida para el agente |
|--------------|------------------------------|-------------------------------|
| `/src/`      | React, Tailwind, JS/JSX      | Agentes 2, 3, 4               |
| `/api/`      | Python puro, sin frameworks  | Agente 1                      |
| `vercel.json`| JSON de config               | Agentes 1, 2, 3               |
| `/data/`     | CSV de datos                 | Solo lectura por Agentes 2, 3 |

---

## Regla #3 — Siempre Especificar Ruta y Nombre de Archivo

Cada bloque de código generado debe ir precedido de su ruta completa:

```
// 📄 /src/pages/HSInfo.jsx
```
```
# 📄 /api/hs_info.py
```

Esto evita confusión sobre dónde colocar cada archivo.

---

## Regla #4 — Seguridad por Defecto

- Todo endpoint en `/api/` (excepto `/api/login.py`) **debe** validar el JWT al inicio.
- Nunca exponer datos sin autenticación.
- Nunca hardcodear secrets, contraseñas o tokens en el código.
- Usar variables de entorno de Vercel para toda información sensible.

---

## Regla #5 — Sin Frameworks Pesados

| ✅ Permitido                    | ❌ Prohibido                          |
|---------------------------------|---------------------------------------|
| React (Vite)                    | Next.js, Remix, Angular, Vue          |
| Tailwind CSS (clases puras)     | Material UI, Ant Design, Bootstrap    |
| Python stdlib + pandas + PyJWT  | Flask, Django, FastAPI, SQLAlchemy    |
| requests + BeautifulSoup4       | Selenium, Playwright, Puppeteer       |

---

## Regla #6 — Convenciones de Nombres de Archivo

| Tipo                      | Convención            | Ejemplo                    |
|---------------------------|-----------------------|----------------------------|
| Componentes React         | PascalCase.jsx        | `DataTable.jsx`            |
| Páginas React             | PascalCase.jsx        | `Analytics.jsx`            |
| Hooks personalizados      | camelCase.js          | `useAuth.js`               |
| Servicios API (front)     | camelCase Service.js  | `analyticsService.js`      |
| Funciones Python (api)    | snake_case.py         | `hs_info.py`               |
| Utilidades Python (priv.) | _snake_case.py        | `_auth.py`                 |

---

## Regla #7 — Flujo de Desarrollo Sugerido

```
Fase 1: DevOps Setup
  → vercel.json + requirements.txt + package.json + vite.config.js

Fase 2: Auth
  → /api/login.py + /api/_auth.py + /src/components/LoginPage.jsx

Fase 3: Data Endpoints
  → /api/hs_info.py → /api/campaigns.py → /api/raw_data.py

Fase 4: Frontend Vistas
  → Sidebar + Layout → HSInfo.jsx → Campaigns.jsx → RawData.jsx

Fase 5: Analytics
  → /api/analytics.py (scraping) → Analytics.jsx (UI)

Fase 6: Polish
  → Responsividad, brand kit, loading states, error handling
```

---

## Regla #8 — Gestión del CSV

- El archivo CSV maestro vive en `/data/promotions.csv`.
- **Nunca exponer el CSV directamente** como endpoint público.
- Si el esquema del CSV cambia, **actualizar primero** `/agents/agent2-data-engineer.md` (tabla de columnas).
- El CSV es de solo lectura — los scripts Python **no deben modificarlo**.

---

## Regla #9 — Tolerancia a Errores

Todos los endpoints deben manejar:
- `try/except` general con respuesta `{"status": "error", "message": "..."}`.
- Status HTTP correcto: 200 OK, 401 Unauthorized, 404 Not Found, 500 Internal Server Error.
- El frontend debe mostrar estados de error al usuario (no pantallas en blanco).

---

## Regla #10 — Actualización de Documentación

Si una decisión de implementación cambia la arquitectura:
1. Actualizar el archivo de agente correspondiente en `.project/agents/`.
2. Actualizar `CONTEXT.md` si cambia la estructura de carpetas o el stack.
3. Registrar el cambio con fecha y motivo en un comentario en el archivo modificado.
