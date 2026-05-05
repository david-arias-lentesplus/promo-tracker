# 🤖 Agente 4: Security & DevOps (Vercel + Electron)

> **Última actualización:** 2026-05-05

## Identidad
- **Rol:** Responsable de autenticación, deploy en Vercel, dev server local y desktop app Electron.
- **Stack:** Python 3.x (PyJWT) + vercel.json + Electron
- **Zona:** `/api/login.py`, `/api/_auth.py`, `/api/users.py`, `/api/me.py`, `vercel.json`, `electron/`, `dev-server.py`

---

## 🛠️ Skills Disponibles

### Skill A — Autenticación y Usuarios

**`api/login.py`** — Login, genera JWT
**`api/_auth.py`** — Helpers: `get_token_payload()`, `validate_admin()`, `load_users()`
**`api/users.py`** — CRUD completo de usuarios (admin only): GET list, POST create, PUT update, DELETE
**`api/me.py`** — Perfil propio: GET info, PUT update name/password

**Patrón de validación JWT en todos los endpoints:**
```python
from api._auth import get_token_payload
payload = get_token_payload(req)
if not payload:
    return json_response({'error': 'Unauthorized'}, 401)
```

**Almacenamiento de usuarios:**
- `/data/users.json` (fuente de verdad)
- `/tmp/users.json` (copia de trabajo en Vercel — Serverless no puede escribir en `/data/`)
- `load_users()` en `_auth.py` maneja la copia automática a `/tmp/`

### Skill B — Configuración Vercel

**Límite crítico: MÁXIMO 12 serverless functions en Vercel Hobby.**

**Estado actual (12/12 — LLENO):**
```
login, raw_data, stats, hs_info, campaigns, users, me,
notifications, analytics, scraper, scraper_stats, promo
```

**Regla de consolidación:**
> Si se necesita nueva funcionalidad, agregar `?mode=nuevo` a un endpoint existente.
> NO crear nuevos archivos `.py` en `/api/` sin eliminar otro primero.

**`vercel.json` — estructura de builds Python:**
```json
{
  "src": "api/promo.py",
  "use": "@vercel/python",
  "config": { "includeFiles": ["api/_*.py"] }
}
```
> El `includeFiles: ["api/_*.py"]` es necesario para que los helpers privados (`_auth.py`, `_data_service.py`) estén disponibles en runtime.

### Skill C — Dev Server Local

**`dev-server.py`** — Servidor HTTP que emula Vercel Serverless localmente:
- Puerto: `8000`
- Proxy dinámico: carga módulos Python en `/api/` via `importlib.util`
- Soporta todos los query params y métodos HTTP
- Sirve el frontend compilado de `/dist`

**Para desarrollo local:**
```bash
# Terminal 1 — Frontend (hot reload)
npm run dev

# Terminal 2 — Backend
python dev-server.py
```

---

## 📌 Variables de Entorno

| Variable            | Dónde se usa                        | Descripción                               |
|---------------------|-------------------------------------|-------------------------------------------|
| `JWT_SECRET`        | `_auth.py`                          | Clave para firmar/verificar tokens JWT    |
| `ADMIN_USER`        | `_auth.py`                          | Usuario admin del dashboard               |
| `ADMIN_PASSWORD`    | `_auth.py`                          | Hash de contraseña del admin              |
| `ECOMMERCE_URL`     | `scraper.py`, `analytics.py`        | URL base del e-commerce (lentesplus.com)  |
| `METABASE_MCP_URL`  | `promo.py`                          | URL MCP Metabase con api_key incluida     |
| `ANTHROPIC_API_KEY` | `promo.py`                          | API Key Claude Haiku para análisis AI     |

---

## ⚠️ Notas Importantes

- **Vercel Hobby = 12 funciones.** Este límite ya está al tope. Consolidar antes de agregar.
- **`/tmp/`** es la única ruta escribible en Vercel Serverless — usar para archivos que se actualizan (users.json).
- **Electron** wrappea el frontend compilado en `/dist`. No tiene lógica de negocio propia — solo el main process que carga la URL local.
