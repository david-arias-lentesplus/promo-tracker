# 👥 AGENTS.md — Equipo de Desarrollo

> Índice del equipo de 4 agentes especializados para el proyecto **E-Commerce Promo Tracker & Analytics**.
> Cada agente tiene responsabilidades exclusivas. Ver su archivo para detalles de skills y convenciones.

---

## Cómo solicitar trabajo a un agente

Al hacer una solicitud, indica el agente o área:
- **"Agente 1 / Frontend:"** → UI, componentes React, consumo de APIs, auth en cliente.
- **"Agente 2 / Data:"** → Procesamiento CSV, endpoints de datos, paginación, filtros.
- **"Agente 3 / Scraping:"** → Auditoría de precios, simulación de carrito, comparativas.
- **"Agente 4 / DevOps:"** → Login/JWT, vercel.json, seguridad, variables de entorno.

Si no especificas, el agente correcto se inferirá por el contexto de la tarea.

---

## 🤖 Agente 1 — Frontend & UI Developer (React)

| Atributo      | Detalle                                      |
|---------------|----------------------------------------------|
| **Stack**     | React (Vite) + Tailwind CSS                  |
| **Zona**      | `/src/` únicamente                           |
| **Ver skill** | [agent1-frontend.md](agents/agent1-frontend.md) |

**Skills:**
- `A` Maquetación y Componentes (layout, sidebar, páginas)
- `B` Consumo de Datos (fetch a `/api/`, render de JSON)
- `C` Gestión de Estado y Auth (Login, JWT, rutas protegidas)

---

## 🤖 Agente 2 — Data Engineer (Python CSV)

| Atributo      | Detalle                                              |
|---------------|------------------------------------------------------|
| **Stack**     | Python 3.x + pandas / csv nativo                     |
| **Zona**      | `/api/hs_info.py`, `/api/campaigns.py`, `/api/raw_data.py` |
| **Ver skill** | [agent2-data-engineer.md](agents/agent2-data-engineer.md) |

**Skills:**
- `A` Parseo de CSV (lectura, limpieza, normalización)
- `B` Segmentación y Filtrado (HS Info, Campañas, Raw Data)

---

## 🤖 Agente 3 — Automation & Scraping Expert (Python)

| Atributo      | Detalle                                      |
|---------------|----------------------------------------------|
| **Stack**     | Python 3.x + requests + BeautifulSoup4       |
| **Zona**      | `/api/analytics.py`                          |
| **Ver skill** | [agent3-scraping.md](agents/agent3-scraping.md) |

**Skills:**
- `A` Simulación de Carrito (scraping ligero de precio real)
- `B` Comparativa Analítica (CSV price vs scraped price → discrepancias)

> ⚠️ Selenium/Playwright están **prohibidos**.

---

## 🤖 Agente 4 — Security & DevOps (Vercel)

| Atributo      | Detalle                                      |
|---------------|----------------------------------------------|
| **Stack**     | Python 3.x (PyJWT) + vercel.json             |
| **Zona**      | `/api/login.py`, `/api/_auth.py`, `vercel.json` |
| **Ver skill** | [agent4-devops.md](agents/agent4-devops.md)  |

**Skills:**
- `A` Autenticación API (JWT login, validación de tokens, protección de endpoints)
- `B` Configuración Vercel (routing, builds, variables de entorno, checklist de seguridad)

---

## 🗺️ Mapa de Responsabilidades por Vista

| Vista          | Agente Frontend | Agente Backend  |
|----------------|-----------------|-----------------|
| Login          | Agente 1 (C)    | Agente 4 (A)    |
| HS Info        | Agente 1 (A/B)  | Agente 2 (B)    |
| Campañas       | Agente 1 (A/B)  | Agente 2 (B)    |
| All Raw Data   | Agente 1 (A/B)  | Agente 2 (B)    |
| Analytics      | Agente 1 (A/B)  | Agente 3 (A/B)  |
