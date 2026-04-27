# 📋 CONTEXT.md — Contexto Global del Proyecto

> **Nombre del Proyecto:** E-Commerce Promo Tracker & Analytics
> **Última actualización:** 2026-04-27

---

## 🎯 Visión General

Herramienta interna (Dashboard Web) para el equipo de marketing y e-commerce. Permite monitorear, auditar y organizar las promociones activas de la tienda online.

**Valor principal:** Cruzar la información teórica (archivo CSV maestro de promociones) con la realidad del sitio web (scraping en tiempo real simulando un carrito de compras) para detectar discrepancias y asegurar que los descuentos se apliquen correctamente.

---

## 🏗️ Arquitectura y Stack Tecnológico

| Capa         | Tecnología                          | Ubicación en el Repo       |
|--------------|-------------------------------------|----------------------------|
| Frontend     | React (Vite) + Tailwind CSS         | `/src` → build en `/dist`  |
| Backend      | Python Serverless Functions         | `/api/*.py`                |
| Despliegue   | Vercel (Monorepo)                   | Raíz del proyecto          |
| Config       | `vercel.json`                       | Raíz del proyecto          |

### Reglas de arquitectura
- **Separación estricta:** Todo lo visual es React/Tailwind. Todo el procesamiento es Python Serverless.
- **No frameworks pesados:** Sin Django, FastAPI, Next.js, etc.
- **Funciones Python** ubicadas **estrictamente** en `/api/`. Vercel las detecta automáticamente.
- El frontend hace `fetch` a `/api/<endpoint>` y recibe JSON.

---

## 🖥️ Funcionalidades Principales (Vistas del Dashboard)

### 1. HS Info (Home Slider Info)
- **Propósito:** Mostrar las promociones vigentes segmentadas por fabricante, descuento y fechas.
- **Ayuda a:** El equipo sepa qué banners deben estar activos en la página principal del e-commerce.
- **Fuente de datos:** CSV filtrado por fechas vigentes → `/api/hs_info.py`

### 2. Campañas
- **Propósito:** Agrupar los productos promocionados por fabricante y tipo de oferta.
- **Ayuda a:** Facilitar la creación de estrategias y segmentación para campañas de Email Marketing.
- **Fuente de datos:** CSV agrupado (Group By fabricante + tipo de promo) → `/api/campaigns.py`

### 3. All Raw Data
- **Propósito:** Vista técnica del archivo CSV parseado completo.
- **Características:** Tabla paginada y filtrable.
- **Fuente de datos:** CSV sin transformar, paginado → `/api/raw_data.py`

### 4. Analytics (Core de Auditoría) ⚠️
- **Propósito:** Comparar el "precio de promoción esperado" (CSV) vs el "precio real en el checkout" (scraping).
- **Cómo funciona:** El backend simula agregar un producto al carrito del e-commerce usando `requests` + `BeautifulSoup` para capturar el precio final.
- **Output:** JSON con discrepancias de precio para prevenir pérdidas económicas.
- **Fuente de datos:** `/api/analytics.py`

---

## 🔐 Seguridad

- Todo el sistema protegido por pantalla de **Login**.
- El frontend maneja el estado de sesión con **JWT almacenado en localStorage**.
- El backend valida el token en **cada request** a la API antes de procesar datos.
- Endpoint de autenticación: `/api/login.py`

---

## 📁 Estructura de Carpetas del Monorepo

```
/
├── .project/                   # Documentación interna del equipo dev
│   ├── CONTEXT.md              # Este archivo — contexto global
│   ├── AGENTS.md               # Índice del equipo de agentes
│   ├── RULES.md                # Reglas de operación
│   └── agents/
│       ├── agent1-frontend.md
│       ├── agent2-data-engineer.md
│       ├── agent3-scraping.md
│       └── agent4-devops.md
│
├── api/                        # ⚙️ BACKEND — Python Serverless Functions
│   ├── login.py                # Auth: genera y valida JWT
│   ├── hs_info.py              # Datos para vista HS Info
│   ├── campaigns.py            # Datos para vista Campañas
│   ├── raw_data.py             # Datos para vista All Raw Data
│   └── analytics.py           # Scraping + comparativa de precios
│
├── src/                        # 🎨 FRONTEND — React + Tailwind
│   ├── main.jsx
│   ├── App.jsx
│   ├── components/
│   │   ├── Sidebar.jsx
│   │   ├── LoginPage.jsx
│   │   └── ...
│   └── pages/
│       ├── HSInfo.jsx
│       ├── Campaigns.jsx
│       ├── RawData.jsx
│       └── Analytics.jsx
│
├── data/
│   └── promotions.csv          # 📊 Archivo CSV maestro de promociones
│
├── vercel.json                 # Configuración de Vercel (rewrites)
├── package.json                # Dependencias frontend
├── vite.config.js              # Configuración de Vite
└── requirements.txt            # Dependencias Python
```

---

## 🔗 Flujo de Datos General

```
[CSV maestro]  →  [/api/*.py]  →  JSON  →  [React Component]  →  [UI]
                      ↑
             [Scraping e-commerce]
             (solo para Analytics)
```

---

## 📌 Variables de Entorno Requeridas (Vercel)

| Variable            | Descripción                              |
|---------------------|------------------------------------------|
| `JWT_SECRET`        | Clave secreta para firmar tokens JWT     |
| `ADMIN_USER`        | Usuario administrador del dashboard     |
| `ADMIN_PASSWORD`    | Contraseña (hash) del admin             |
| `ECOMMERCE_URL`     | URL base del e-commerce a auditar       |
