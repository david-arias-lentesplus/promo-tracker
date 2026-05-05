# 🤖 Agente 1: Frontend & UI Developer (React)

> **Última actualización:** 2026-05-05

## Identidad
- **Rol:** Frontend developer especializado en React, Tailwind y Design System LIVO.
- **Stack:** React (Vite) + Tailwind CSS + Electron (desktop wrapper)
- **Zona:** `/src/` únicamente

---

## 🎨 Design System LIVO

| Token               | Valor                |
|---------------------|----------------------|
| Primary Blue        | `#0000E1`            |
| Accent Yellow       | `#DEFF00`            |
| Background          | `#F8F9FB`            |
| Card bg             | `bg-white`           |
| Border radius card  | `rounded-xl`         |
| Font                | Inter (system)       |

**Clases utilitarias clave:**
- `.card` → `bg-white rounded-xl border border-gray-100 shadow-sm`
- `.badge-info` → `px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600 border border-blue-100`
- `.animate-fade-in` → entrada suave de páginas

---

## 🛠️ Skills Disponibles

### Skill A — Maquetación y Componentes
- Layout principal: `Layout.jsx` — sidebar 230px + topbar con filtros globales.
- Sidebar con navegación: HS Info, Campañas, Analytics, Promo Performance, Notificaciones, Raw Data.
- Design System LIVO: tokens de color, tipografía, spacing.
- Componentes reutilizables: `ProductThumb`, `UseBadges`, `CopyBtn`, `EmailCopyPanel`, `EmptyState`, `Skeleton`.

### Skill B — Consumo de Datos
- `apiRequest(path)` desde `src/utils/api.js` — siempre sin `/api/` prefijo.
- `useFilters()` desde `FiltersContext` — `{ country, dateFrom, dateTo }` disponibles en todas las páginas.
- Loading states con Skeleton components.
- Error states con botón de reintentar.

### Skill C — Gestión de Estado y Auth
- JWT almacenado en `localStorage`.
- `PrivateRoute` protege todas las rutas autenticadas.
- Settings (admin only) + AccountProfile (todos los usuarios).

### Skill D — UI Avanzada (Tabs, Modales, Expandables)
- **Sistema de tabs:** `TABS = [{id, label}]` con estado `activeTab`.
- **Filas expandibles:** `useState` de rowId abierto + animación CSS.
- **Modales:** portal o overlay con `fixed inset-0 z-50`.
- **Skeletons:** `Array.from({length: N}).map()` con `animate-pulse`.
- **Floating selection bar:** `fixed bottom-6` con count de seleccionados.

---

## 📄 Páginas y su Propósito

| Página              | Descripción                                               | Tabs / Secciones                                    |
|---------------------|-----------------------------------------------------------|-----------------------------------------------------|
| `LoginPage`         | Autenticación con JWT                                     | —                                                   |
| `Dashboard`         | KPIs globales del sistema                                 | —                                                   |
| `HSInfo`            | Banners activos por fabricante                            | —                                                   |
| `Campaigns`         | Email marketing + análisis de performance                | BestSeller · Fabricantes · Gafas · 🔥 Top Promos    |
| `RawData`           | Vista técnica del CSV completo                            | —                                                   |
| `Analytics`         | Auditoría de precios CSV vs scraping                      | —                                                   |
| `PromoPerformance`  | Performance real de cupones desde el DWH                 | Promo Review · Product Tier List · Promo Analysis   |
| `Notifications`     | Alertas de promos por vencer                              | —                                                   |
| `Settings`          | CRUD de usuarios (admin only)                             | —                                                   |
| `AccountProfile`    | Perfil y contraseña del usuario actual                    | —                                                   |

---

## 🔑 Patrones de Código Clave

**Fetch con FiltersContext:**
```jsx
const { country, dateFrom, dateTo } = useFilters()
const params = new URLSearchParams({
  ...(country  ? { country }             : {}),
  ...(dateFrom ? { date_from: dateFrom } : {}),
  ...(dateTo   ? { date_to:   dateTo   } : {}),
})
const data = await apiRequest(`/promo?mode=product_tier&${params}`)
```

**Fetch lazy para tabs (solo cuando se activa el tab):**
```jsx
useEffect(() => {
  if (activeTab === 'top_promos') fetchTopPromos()
}, [activeTab, country, dateFrom, dateTo])
```

**Endpoint promo con modo:**
```jsx
apiRequest(`/promo?mode=performance&${params}`)
apiRequest(`/promo?mode=product_tier&sort_by=quantity&${params}`)
apiRequest(`/promo?mode=analysis&${params}`)
```

---

## ⚠️ Notas Importantes

- El Tab "🔥 Top Promos" en Campaigns.jsx carga datos de `api/promo.py?mode=product_tier` (DWH), no del endpoint `campaigns`.
- El sidebar de filtros se **oculta automáticamente** cuando el tab activo es `top_promos` (tiene su propio control de sort).
- `FilterSidebar` recibe `activeTab` y retorna `null` si `activeTab === 'top_promos'`.
- Email copy en Top Promos se genera **client-side** con `_buildTopPromosCopy()` (no del backend).
