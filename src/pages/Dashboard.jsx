/**
 * 📄 /src/pages/Dashboard.jsx
 * Agente 1 — Frontend (Skill A: Maquetación)
 * Vista: Dashboard Overview — KPI widgets + quick access
 * Design System: LIVO
 */
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '@utils/api'
import { useFilters } from '@context/FiltersContext'

// ─── Icons ───────────────────────────────────────────────────
const IconTag = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
)
const IconCheckCircle = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
)
const IconArrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
  </svg>
)
const IconTrendUp = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
)

// ─── KPI Card ─────────────────────────────────────────────────
function KpiCard({ label, value, sublabel, icon: Icon, accent, loading }) {
  return (
    <div className={`card p-6 flex items-start gap-4 border-l-4 ${accent}`}>
      {/* Icon circle */}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
        accent.includes('blue') ? 'bg-blue-50 text-blue-600'
        : accent.includes('lime') || accent.includes('DEFF') ? 'bg-[#DEFF00]/20 text-gray-800'
        : 'bg-green-50 text-green-600'
      }`}>
        <Icon size={22} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        {loading ? (
          <div className="space-y-1.5">
            <div className="h-8 w-28 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
          </div>
        ) : (
          <>
            <p className="text-3xl font-black text-gray-900 leading-none">
              {typeof value === 'number' ? value.toLocaleString() : value ?? '—'}
            </p>
            {sublabel && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                {sublabel}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Quick Links ──────────────────────────────────────────────
const QUICK_LINKS = [
  {
    label: 'HS Info',    desc: 'Ver promociones vigentes por fabricante',
    to: '/hs-info',    color: 'bg-blue-50 hover:bg-blue-100 border-blue-100',   textColor: 'text-blue-600',
  },
  {
    label: 'Campañas',   desc: 'Segmentación por fabricante y tipo de oferta',
    to: '/campaigns', color: 'bg-pink-50 hover:bg-pink-100 border-pink-100',   textColor: 'text-pink-600',
  },
  {
    label: 'Raw Data',   desc: 'Explorar el CSV completo de promociones',
    to: '/raw-data',  color: 'bg-gray-50 hover:bg-gray-100 border-gray-200',   textColor: 'text-gray-700',
  },
  {
    label: 'Analytics',  desc: 'Auditar precios CSV vs. precios reales del checkout',
    to: '/analytics', color: 'bg-[#DEFF00]/20 hover:bg-[#DEFF00]/30 border-[#DEFF00]/40', textColor: 'text-gray-800',
  },
]

// ─── Main ─────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const { country, dateFrom, dateTo } = useFilters()

  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const fetchStats = async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({
        ...(country  ? { country              } : {}),
        ...(dateFrom ? { date_from: dateFrom  } : {}),
        ...(dateTo   ? { date_to:   dateTo    } : {}),
      })
      const res = await apiRequest(`/stats?${params}`)
      setStats(res)
    } catch (err) {
      setError(err.message || 'Error cargando estadísticas')
    } finally {
      setLoading(false)
    }
  }

  // Mount
  useEffect(() => { fetchStats() }, [])  // eslint-disable-line

  // Re-fetch on global filter change
  const prevRef = useRef({ country, dateFrom, dateTo })
  useEffect(() => {
    const prev = prevRef.current
    if (prev.country !== country || prev.dateFrom !== dateFrom || prev.dateTo !== dateTo) {
      prevRef.current = { country, dateFrom, dateTo }
      fetchStats()
    }
  }, [country, dateFrom, dateTo])  // eslint-disable-line

  const activePct = stats && stats.total_promos > 0
    ? Math.round((stats.active_promos / stats.total_promos) * 100)
    : 0

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Resumen de promociones
          {country && <span className="ml-1 font-medium text-blue-600">· {country}</span>}
          {(dateFrom || dateTo) && (
            <span className="ml-1 text-gray-400">
              · {dateFrom || '…'} → {dateTo || '…'}
            </span>
          )}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          ⚠️ {error}
          <button onClick={fetchStats} className="ml-3 underline font-medium">Reintentar</button>
        </div>
      )}

      {/* ── KPI Widgets ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">

        {/* Widget 1: Total Promos */}
        <KpiCard
          label="Total Promos"
          value={stats?.total_promos}
          sublabel={
            stats
              ? `${stats.total_all?.toLocaleString()} en el dataset completo`
              : undefined
          }
          icon={IconTag}
          accent="border-l-blue-600"
          loading={loading}
        />

        {/* Widget 2: Promos Activas */}
        <KpiCard
          label="Promos Activas"
          value={stats?.active_promos}
          sublabel={
            stats && stats.total_promos > 0
              ? (
                <span className="flex items-center gap-1 text-green-600">
                  <IconTrendUp size={12} />
                  {activePct}% del total filtrado
                </span>
              )
              : undefined
          }
          icon={IconCheckCircle}
          accent="border-l-green-500"
          loading={loading}
        />
      </div>

      {/* ── Quick access cards ──────────────────────────────── */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Acceso rápido
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {QUICK_LINKS.map(({ label, desc, to, color, textColor }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className={`card text-left p-5 border transition-all duration-150 cursor-pointer group ${color}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-sm font-bold mb-1 ${textColor}`}>{label}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
              <span className={`opacity-0 group-hover:opacity-100 transition-opacity ${textColor}`}>
                <IconArrow />
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
