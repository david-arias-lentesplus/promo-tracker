/**
 * 📄 /src/components/Layout.jsx
 * Agente 1 — Frontend (Skill A: Maquetación)
 * Topbar: botones de País + rango de fechas con botón "Hoy"
 * Design System: LIVO
 */
import React, { useEffect, useState } from 'react'
import { getCurrentUser } from '@utils/api'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import { useFilters } from '@context/FiltersContext'

// ─── Icons ───────────────────────────────────────────────────
const IconDashboard = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
)
const IconInfo = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
)
const IconMegaphone = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l19-9-9 19-2-8-8-2z"/>
  </svg>
)
const IconTable = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
  </svg>
)
const IconBarChart = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6"  y1="20" x2="6"  y2="14"/>
    <line x1="2"  y1="20" x2="22" y2="20"/>
  </svg>
)
const IconBell = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)
const IconUser = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
)
const IconSettings = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)
const IconLogout = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)
const IconPlay = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
)
const IconCalendar = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

// ─── Países disponibles ───────────────────────────────────────
const COUNTRY_BTNS = [
  { code: '',   label: 'Todos'     },
  { code: 'AR', label: 'Argentina' },
  { code: 'CL', label: 'Chile'     },
  { code: 'CO', label: 'CO'        },
  { code: 'MX', label: 'México'    },
  { code: 'GL', label: 'Galileo'   },
]

// ─── Nav items ───────────────────────────────────────────────
const BASE_NAV = [
  { label: 'Dashboard', to: '/dashboard', icon: IconDashboard },
  { label: 'HS Info',   to: '/hs-info',   icon: IconInfo },
  { label: 'Campañas',  to: '/campaigns', icon: IconMegaphone },
  { label: 'Analytics', to: '/analytics', icon: IconBarChart },
  { label: 'Raw Data',  to: '/raw-data',  icon: IconTable },
]
const ADMIN_NAV = { label: 'Settings', to: '/settings', icon: IconSettings }

// ─── Sidebar ─────────────────────────────────────────────────
function Sidebar() {
  return (
    <aside className="fixed top-0 left-0 h-screen w-[252px] bg-black flex flex-col z-30">
      <div className="px-5 pt-6 pb-5 border-b border-white/10">
        <p className="text-white text-base font-black tracking-widest uppercase leading-none">
          PROMO ENGINE
        </p>
        <p className="text-[#DEFF00] text-xs font-semibold mt-0.5 tracking-wide">
          Admin Console
        </p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {(() => {
          const role = getCurrentUser()?.role
          const items = role === 'admin' ? [...BASE_NAV, ADMIN_NAV] : BASE_NAV
          return items.map(({ label, to, icon: Icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => isActive ? 'nav-item-active' : 'nav-item'}>
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))
        })()}
      </nav>

      <div className="px-4 pb-4">
        <button className="btn-lime w-full flex items-center justify-center gap-2 text-xs">
          <IconPlay size={13} />
          Ejecutar Auditoría
        </button>
      </div>

      <div className="px-4 pb-5 border-t border-white/10 pt-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <IconUser size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-semibold truncate">
              {getCurrentUser()?.display_name || 'Admin'}
            </p>
            <p className="text-gray-500 text-[10px] truncate">
              {getCurrentUser()?.email || ''}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}


// ─── Notification badge count ─────────────────────────────────
function useUnreadCount() {
  const [count, setCount] = React.useState(() => {
    try {
      const ids  = JSON.parse(localStorage.getItem('notif_read_ids') || '[]')
      const all  = JSON.parse(localStorage.getItem('notif_all_ids')  || '[]')
      return all.filter(id => !ids.includes(id)).length
    } catch { return 0 }
  })
  React.useEffect(() => {
    const update = () => {
      try {
        const ids = JSON.parse(localStorage.getItem('notif_read_ids') || '[]')
        const all = JSON.parse(localStorage.getItem('notif_all_ids')  || '[]')
        setCount(all.filter(id => !ids.includes(id)).length)
      } catch { setCount(0) }
    }
    window.addEventListener('notif_read_changed',  update)
    window.addEventListener('notif_items_changed', update)
    return () => {
      window.removeEventListener('notif_read_changed',  update)
      window.removeEventListener('notif_items_changed', update)
    }
  }, [])
  return count
}

// ─── Topbar ──────────────────────────────────────────────────
function Topbar({ onLogout }) {
  const { country, setCountry, dateFrom, setDateFrom, dateTo, setDateTo } = useFilters()
  const navigate    = useNavigate()
  const unreadCount = useUnreadCount()

  function setToday() {
    const today = new Date().toISOString().split('T')[0]
    setDateFrom(today)
    setDateTo(today)
  }

  return (
    <header className="fixed top-0 left-[252px] right-0 h-14 bg-white border-b border-gray-200
                        flex items-center px-5 gap-4 z-20 overflow-x-auto">

      {/* Logo */}
      <span className="text-blue-600 text-base font-black tracking-tight shrink-0">
        PromoTracker
      </span>

      {/* Divider */}
      <div className="h-5 w-px bg-gray-200 shrink-0" />

      {/* ── Botones de País ──────────────────────────── */}
      <div className="flex items-center gap-1.5 shrink-0">
        {COUNTRY_BTNS.map(({ code, label }) => {
          const isActive = country === code
          return (
            <button
              key={code}
              onClick={() => setCountry(code)}
              className={`
                h-8 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap
                transition-all duration-150 border
                ${isActive
                  ? 'bg-[#0000E1] text-white border-[#0000E1] shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#0000E1] hover:text-[#0000E1]'
                }
              `}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Divider */}
      <div className="h-5 w-px bg-gray-200 shrink-0" />

      {/* ── Rango de fechas ───────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-gray-400"><IconCalendar size={13} /></span>

        <input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          className="h-8 px-2 text-xs bg-gray-50 border border-gray-200 rounded-lg
                     outline-none focus:border-[#0000E1] focus:ring-2 focus:ring-[#0000E1]/15
                     text-gray-700 cursor-pointer w-[130px]"
          title="Fecha inicio"
        />

        <span className="text-gray-400 text-xs font-medium">→</span>

        <input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          className="h-8 px-2 text-xs bg-gray-50 border border-gray-200 rounded-lg
                     outline-none focus:border-[#0000E1] focus:ring-2 focus:ring-[#0000E1]/15
                     text-gray-700 cursor-pointer w-[130px]"
          title="Fecha fin"
        />

        {/* Botón Hoy */}
        <button
          onClick={setToday}
          className="h-8 px-3 rounded-full text-xs font-semibold border border-gray-200
                     bg-white text-gray-600 hover:border-[#DEFF00] hover:bg-[#DEFF00]
                     hover:text-black transition-all duration-150 whitespace-nowrap"
        >
          Hoy
        </button>

        {/* Limpiar fechas */}
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo('') }}
            className="text-xs text-gray-400 hover:text-red-400 transition-colors px-1"
            title="Limpiar fechas"
          >
            ✕
          </button>
        )}
      </div>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate('/notifications')}
          className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center
                     text-gray-500 hover:text-gray-700 transition-colors relative"
          title="Notificaciones">
          <IconBell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full
                             bg-[#0000E1] text-white text-[9px] font-bold flex items-center
                             justify-center px-0.5 leading-none shadow-sm">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => navigate('/profile')}
          className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center
                     justify-center text-gray-600 transition-colors"
          title="Mi perfil">
          <IconUser size={17} />
        </button>

        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-600
                     hover:text-gray-900 transition-colors"
        >
          Logout
          <IconLogout size={16} />
        </button>
      </div>
    </header>
  )
}

// ─── Layout principal ────────────────────────────────────────
export default function Layout() {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <Topbar onLogout={handleLogout} />
      <main className="pl-[252px] pt-14 min-h-screen">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
