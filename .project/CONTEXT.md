# 📋 CONTEXT.md — Contexto Global del Proyecto

> **Nombre del Proyecto:** E-Commerce Promo Tracker & Analytics — lentesplus.com
> **Última actualización:** 2026-05-05

---

## 🎯 Visión General

Herramienta interna (Dashboard Web + Desktop App via Electron) para el equipo de marketing y e-commerce. Permite monitorear, auditar y organizar las promociones activas de la tienda online, con análisis de performance real de ventas conectado al Data Warehouse (DWH).

**Valor principal:**
- Cruzar información teórica (CSV maestro de promociones) con la realidad del sitio web (scraping con Playwright).
- Conectar con el DWH de ventas (Metabase MCP) para analizar qué promos y productos realmente generan ventas.
- Generar campañas de email marketing con datos reales de performance.

---

## 🏗️ Arquitectura y Stack Tecnológico

| Capa              | Tecnología                                  | Ubicación en el Repo         |
|-------------------|---------------------------------------------|------------------------------|
| Frontend          | React (Vite) + Tailwind CSS                 | `/src` → build en `/dist`    |
| Desktop App       | Electron (wrapping del frontend)            | `/electron/`                 |
| Backend           | Python Serverless Functions (Vercel Hobby)  | `/api/*.py`                  |
| Backend local     | Python dev-server (`dev-server.py`)         | Raíz del proyecto            |
| Despliegue        | Vercel Hobby plan (máx. 12 funciones)       | Raíz del proyecto            |
| DWH               | Metabase MCP sobre SSE (livo.company)       | Llamado desde `api/promo.py` |
| AI / Análisis     | Anthropic Claude Haiku via API directa      | Llamado desde `api/promo.py` |
| Config            | `vercel.json`                               | Raíz del proyecto            |

### Reglas de arquitectura
- **Separación estricta:** Todo lo visual es React/Tailwind. Todo el procesamiento es Python Serverless.
- **No frameworks pesados:** Sin Django, FastAPI, Next.js, etc.
- **Funciones Python** ubicadas **estrictamente** en `/api/`. Vercel las detecta automáticamente.
- El frontend hace `fetch` a `/api/<endpoint>` y recibe JSON.
- **Vercel Hobby:** Máximo 12 serverless functions. Consolidar endpoints si se alcanza el límite (ver `api/promo.py` con sistema `?mode=`).
- **`apiRequest()` en `src/utils/api.js`** prepend automáticamente `/api` — NO incluir `/api/` en el path argument.

---

## 🖥️ Funcionalidades Principales (Vistas del Dashboard)

### 1. HS Info (Home Slider Info)
- **Propósito:** Mostrar las promociones vigentes segmentadas por fabricante, descuento y fechas.
- **Fuente de datos:** CSV maestro filtrado → `/api/hs_info.py`

### 2. Campañas
- **Propósito:** Agrupar los productos promocionados para campañas de Email Marketing.
- **Tabs:** BestSeller · Fabricantes · Gafas · 🔥 Top Promos (DWH)
- **Fuente de datos:** CSV agrupado → `/api/campaigns.py` + DWH → `/api/promo.py?mode=product_tier`
- **Top Promos:** Productos más vendidos en ventas con cupones, datos reales del DWH. Incluye generación de email copy basada en performance de ventas.

### 3. All Raw Data
- **Propósito:** Vista técnica del CSV parseado completo, paginada y filtrable.
- **Fuente de datos:** CSV sin transformar → `/api/raw_data.py`

### 4. Analytics (Core de Auditoría) ⚠️
- **Propósito:** Comparar precio esperado (CSV) vs precio real en checkout (scraping).
- **Scraping:** Playwright simulando carrito de compras → captura precio tachado y tier price.
- **Fuente de datos:** `/api/analytics.py` + `/api/scraper.py` (Playwright)

### 5. Promo Performance (DWH) 🆕
- **Propósito:** Análisis completo de performance de cupones y productos con datos reales de ventas.
- **Tabs:**
  - **Promo Review:** Métricas por `coupon_code` (órdenes, GMV, conversión) con filas expandibles y modal de productos por orden.
  - **Product Tier List:** Top productos vendidos con promos — rank medals, filtros, gráfico de barras, sort por qty/órdenes/GMV.
  - **Promo Analysis:** Análisis AI con Claude Haiku — insights, forecast, recomendaciones, cupones a potenciar/revisar.
- **Fuente de datos:** DWH via Metabase MCP → `/api/promo.py` (endpoint unificado con sistema `?mode=`)
- **Tablas DWH:** `Silver.sales` + `Silver.sales_products` (database_id=2)

### 6. Notifications
- **Propósito:** Alertas de promos próximas a vencer.
- **Fuente de datos:** CSV filtrado → `/api/notifications.py`

### 7. Settings (Admin)
- **Propósito:** Gestión de usuarios (admin only).
- **Fuente de datos:** `/api/users.py`

### 8. Account Profile
- **Propósito:** Perfil propio del usuario autenticado.
- **Fuente de datos:** `/api/me.py`

---

## 🔌 Integración DWH — Metabase MCP

| Atributo          | Valor                                                                                |
|-------------------|--------------------------------------------------------------------------------------|
| URL               | `https://mcp.livocompany.com/metabase/mcp?api_key=<KEY>`                            |
| Transport         | SSE (Server-Sent Events): `text/event-stream`                                        |
| Header requerido  | `Accept: application/json, text/event-stream`                                        |
| Database ID       | `2` (Silver schema)                                                                  |
| Row limit máx.    | `500` (hardcoded en MCP)                                                             |
| SSL               | Certificado no verificable — usar `ssl.CERT_NONE` en macOS local                    |
| Respuesta format  | `event: message\ndata: {"result":{"content":[{"type":"text","text":"{\"data\":{\"0\":{...}}}"}]}}` |
| Tablas principales| `Silver.sales`, `Silver.sales_products`                                              |

**Columnas clave `Silver.sales`:** `coupon_code`, `order_number`, `status`, `total`, `gmv_usd`, `discount_total`, `updated_at`, `empresa`, `country`

**Columnas clave `Silver.sales_products`:** `order_number`, `name`, `sku`, `type`, `use_type`, `use_duration`, `manufacturer`, `formula`, `quantity_actual`, `price_actual`, `total`, `gmv_usd`, `empresa`

---

## 🤖 Integración AI — Claude Haiku

- **Modelo:** `claude-haiku-4-5`
- **Endpoint:** `https://api.anthropic.com/v1/messages`
- **Auth:** Header `x-api-key: $ANTHROPIC_API_KEY`
- **Implementación:** `urllib.request` directo (sin SDK, para compatibilidad con Vercel Python)
- **Uso actual:** `api/promo.py?mode=analysis` — análisis de performance de promos con insights, forecast y recomendaciones.

---

## 🔐 Seguridad

- Todo el sistema protegido por pantalla de **Login**.
- El frontend maneja el estado de sesión con **JWT almacenado en localStorage**.
- El backend valida el token en **cada request** a la API antes de procesar datos.
- Endpoint de autenticación: `/api/login.py`
- Endpoint perfil propio: `/api/me.py`
- CRUD de usuarios (admin): `/api/users.py`

---

## 📁 Estructura de Carpetas del Monorepo

```
/
├── .project/                        # Documentación interna del equipo dev
│   ├── CONTEXT.md                   # Este archivo — contexto global
│   ├── AGENTS.md                    # Índice del equipo de agentes
│   ├── RULES.md                     # Reglas de operación
│   └── agents/
│       ├── agent1-frontend.md
│       ├── agent2-data-engineer.md
│       ├── agent3-scraping.md
│       └── agent4-devops.md
│
├── api/                             # ⚙️ BACKEND — Python Serverless Functions
│   ├── _auth.py                     # Helpers JWT (privado, no expuesto)
│   ├── _data_service.py             # Servicio compartido CSV (privado)
│   ├── login.py                     # Auth: genera y valida JWT
│   ├── me.py                        # Perfil propio (GET/PUT)
│   ├── users.py                     # CRUD usuarios (admin only)
│   ├── notifications.py             # Alertas promos por vencer
│   ├── hs_info.py                   # Datos vista HS Info
│   ├── campaigns.py                 # Datos vista Campañas (CSV)
│   ├── raw_data.py                  # Datos vista All Raw Data
│   ├── stats.py                     # KPIs del dashboard
│   ├── analytics.py                 # Lista de productos para auditoría
│   ├── scraper.py                   # Motor scraping Playwright
│   ├── scraper_stats.py             # Estadísticas de scraping
│   └── promo.py                     # DWH + AI (endpoint unificado, ?mode=)
│                                    #   mode=performance  → métricas por cupón
│                                    #   mode=orders       → órdenes por cupón
│                                    #   mode=products     → productos por orden
│                                    #   mode=tier_filters → filtros para Product Tier
│                                    #   mode=product_tier → top productos con promos
│                                    #   mode=analysis     → análisis AI con Claude Haiku
│
├── src/                             # 🎨 FRONTEND — React + Tailwind
│   ├── main.jsx
│   ├── App.jsx
│   ├── context/
│   │   └── FiltersContext.jsx       # Estado global: country, dateFrom, dateTo
│   ├── utils/
│   │   └── api.js                   # apiRequest() — prepend /api automático
│   ├── components/
│   │   └── Layout.jsx               # Shell: sidebar + topbar + filtros globales
│   └── pages/
│       ├── LoginPage.jsx
│       ├── Dashboard.jsx
│       ├── HSInfo.jsx
│       ├── Campaigns.jsx            # 4 tabs: BestSeller·Fabricantes·Gafas·Top Promos
│       ├── RawData.jsx
│       ├── Analytics.jsx
│       ├── PromoPerformance.jsx     # 3 tabs: Promo Review·Product Tier·Promo Analysis
│       ├── Notifications.jsx
│       ├── Settings.jsx
│       └── AccountProfile.jsx
│
├── electron/                        # 🖥️ DESKTOP — Electron wrapper
│   └── main.js                      # Main process Electron
│
├── data/                            # 📊 Archivos de datos (read-only)
│   ├── promotions.csv               # CSV maestro de promociones
│   ├── url_sku_images.csv           # URLs de imágenes por SKU
│   └── users.json                   # Usuarios del sistema
│
├── dev-server.py                    # 🔧 Servidor local para desarrollo (Flask-like)
├── vercel.json                      # Configuración Vercel (12 funciones max)
├── package.json
├── vite.config.js
└── requirements.txt
```

---

## 🔗 Flujo de Datos General

```
[CSV maestro]  →  [/api/*.py]       →  JSON  →  [React Component]  →  [UI]
[DWH/Metabase] →  [/api/promo.py]   →  JSON  →  [PromoPerformance] →  [UI]
[Anthropic AI] →  [/api/promo.py]   →  JSON  →  [PromoAnalysis]    →  [UI]
               →  [/api/scraper.py] →  JSON  →  [Analytics]        →  [UI]
```

---

## 📌 Variables de Entorno Requeridas (Vercel)

| Variable              | Descripción                                            |
|-----------------------|--------------------------------------------------------|
| `JWT_SECRET`          | Clave secreta para firmar tokens JWT                   |
| `ADMIN_USER`          | Usuario administrador del dashboard                   |
| `ADMIN_PASSWORD`      | Contraseña (hash) del admin                           |
| `ECOMMERCE_URL`       | URL base del e-commerce a auditar                     |
| `METABASE_MCP_URL`    | URL del MCP de Metabase (incluye api_key)             |
| `ANTHROPIC_API_KEY`   | API Key de Anthropic para Claude Haiku                |
