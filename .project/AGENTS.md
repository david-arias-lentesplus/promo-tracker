# 👥 AGENTS.md — Equipo de Desarrollo

> Índice del equipo de 4 agentes especializados para el proyecto **E-Commerce Promo Tracker & Analytics**.
> Cada agente tiene responsabilidades exclusivas. Ver su archivo para detalles de skills y convenciones.
> **Última actualización:** 2026-05-05

---

## Cómo solicitar trabajo a un agente

Al hacer una solicitud, indica el agente o área:
- **"Agente 1 / Frontend:"** → UI, componentes React, consumo de APIs, auth en cliente.
- **"Agente 2 / Data:"** → Procesamiento CSV, endpoints de datos, paginación, filtros.
- **"Agente 3 / Scraping:"** → Auditoría de precios, simulación de carrito, comparativas, DWH/Metabase MCP, IA.
- **"Agente 4 / DevOps:"** → Login/JWT, vercel.json, seguridad, variables de entorno.

Si no especificas, el agente correcto se inferirá por el contexto de la tarea.

---

## 🤖 Agente 1 — Frontend & UI Developer (React)

| Atributo      | Detalle                                      |
|---------------|----------------------------------------------|
| **Stack**     | React (Vite) + Tailwind CSS + Electron       |
| **Zona**      | `/src/` únicamente                           |
| **Ver skill** | [agent1-frontend.md](agents/agent1-frontend.md) |

**Skills:**
- `A` Maquetación y Componentes (layout, sidebar, páginas, design system LIVO)
- `B` Consumo de Datos (fetch a `/api/`, render de JSON, FiltersContext global)
- `C` Gestión de Estado y Auth (Login, JWT, rutas protegidas)
- `D` Sistemas de Tabs y UI Avanzada (expandable rows, modales, skeletons)

**Páginas bajo responsabilidad:**
`LoginPage`, `Dashboard`, `HSInfo`, `Campaigns` (4 tabs), `RawData`, `Analytics`, `PromoPerformance` (3 tabs), `Notifications`, `Settings`, `AccountProfile`

---

## 🤖 Agente 2 — Data Engineer (Python CSV)

| Atributo      | Detalle                                                                       |
|---------------|-------------------------------------------------------------------------------|
| **Stack**     | Python 3.x + pandas / csv nativo                                              |
| **Zona**      | `/api/hs_info.py`, `/api/campaigns.py`, `/api/raw_data.py`, `/api/stats.py`, `/api/notifications.py`, `/api/_data_service.py` |
| **Ver skill** | [agent2-data-engineer.md](agents/agent2-data-engineer.md) |

**Skills:**
- `A` Parseo de CSV (lectura, limpieza, normalización, imágenes, URLs)
- `B` Segmentación y Filtrado (HS Info, Campañas, Raw Data, Notificaciones)
- `C` Servicio compartido `_data_service.py` (fuente única de datos CSV)

---

## 🤖 Agente 3 — Automation, Scraping & Data Intelligence (Python)

| Atributo      | Detalle                                                                            |
|---------------|------------------------------------------------------------------------------------|
| **Stack**     | Python 3.x + Playwright + Metabase MCP (SSE) + Anthropic API (urllib)             |
| **Zona**      | `/api/analytics.py`, `/api/scraper.py`, `/api/scraper_stats.py`, `/api/promo.py`  |
| **Ver skill** | [agent3-scraping.md](agents/agent3-scraping.md)                                   |

**Skills:**
- `A` Simulación de Carrito (Playwright — precio real en checkout)
- `B` Comparativa Analítica (CSV price vs scraped price → discrepancias)
- `C` DWH Integration (Metabase MCP via SSE — Silver.sales, Silver.sales_products)
- `D` AI Analysis (Claude Haiku via urllib — análisis de promos, forecast, recomendaciones)

**Endpoint unificado `api/promo.py`** (sistema `?mode=`):
- `mode=performance` → métricas grupadas por `coupon_code`
- `mode=orders` → órdenes individuales por cupón
- `mode=products` → productos de una orden (`Silver.sales_products`)
- `mode=tier_filters` → filtros distintos para Product Tier
- `mode=product_tier` → top productos vendidos con promos
- `mode=analysis` → análisis AI completo con Claude Haiku

> ⚠️ Playwright está **permitido** únicamente en `scraper.py`. Para otros endpoints usar `requests`.

---

## 🤖 Agente 4 — Security & DevOps (Vercel)

| Atributo      | Detalle                                         |
|---------------|-------------------------------------------------|
| **Stack**     | Python 3.x (PyJWT) + vercel.json + Electron     |
| **Zona**      | `/api/login.py`, `/api/_auth.py`, `/api/users.py`, `/api/me.py`, `vercel.json` |
| **Ver skill** | [agent4-devops.md](agents/agent4-devops.md)     |

**Skills:**
- `A` Autenticación API (JWT login, validación de tokens, CRUD usuarios, perfil propio)
- `B` Configuración Vercel (routing, builds, variables de entorno, límite 12 funciones)
- `C` Dev Server local (`dev-server.py` — proxy dinámico de módulos Python para desarrollo)

---

## 🗺️ Mapa de Responsabilidades por Vista

| Vista                | Agente Frontend | Agente Backend        |
|----------------------|-----------------|-----------------------|
| Login                | Agente 1 (C)    | Agente 4 (A)          |
| Dashboard            | Agente 1 (A/B)  | Agente 2 (C)          |
| HS Info              | Agente 1 (A/B)  | Agente 2 (B)          |
| Campañas (CSV tabs)  | Agente 1 (A/B)  | Agente 2 (B)          |
| Campañas (Top Promos)| Agente 1 (D)    | Agente 3 (C)          |
| All Raw Data         | Agente 1 (A/B)  | Agente 2 (B)          |
| Analytics            | Agente 1 (A/B)  | Agente 3 (A/B)        |
| Promo Performance    | Agente 1 (D)    | Agente 3 (C/D)        |
| Notifications        | Agente 1 (A/B)  | Agente 2 (B)          |
| Settings             | Agente 1 (C)    | Agente 4 (A)          |
| Account Profile      | Agente 1 (C)    | Agente 4 (A)          |
