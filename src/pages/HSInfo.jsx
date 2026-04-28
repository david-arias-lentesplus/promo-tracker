/**
 * 📄 /src/pages/HSInfo.jsx
 * Agente 1 — Frontend (Skill B)
 * Vista: Home Sliders Info — banners activos agrupados por fabricante + promo
 * Design System: LIVO
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { apiRequest } from '@utils/api'
import { useFilters } from '@context/FiltersContext'

// ─── Icons ────────────────────────────────────────────────────
const IconRefresh = ({ spin }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    className={spin ? 'animate-spin' : ''}>
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
)
const IconAlertTriangle = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const IconCalendar = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)
const IconTag = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
)
const IconImage = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)
const IconPackage = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
)

// ─── Product Thumb ────────────────────────────────────────────
function ProductThumb({ url, name }) {
  const [err, setErr] = useState(false)
  if (!url || err) return (
    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
      <IconImage />
    </div>
  )
  return (
    <img src={url} alt={name} onError={() => setErr(true)}
      className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
  )
}

// ─── Expiry Badge ─────────────────────────────────────────────
function ExpiryBadge({ days, isExpiringSoon, isExpired }) {
  if (isExpired)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">
        <IconAlertTriangle size={11} /> Vencida
      </span>
    )
  if (isExpiringSoon)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200 animate-pulse">
        <IconAlertTriangle size={11} />
        {days === 0 ? '¡Vence hoy!' : `Vence en ${days} día${days === 1 ? '' : 's'}`}
      </span>
    )
  if (days !== null && days <= 10)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
        {days} días restantes
      </span>
    )
  return null
}

// ─── Slider Card ─────────────────────────────────────────────
function SliderCard({ group }) {
  const [expanded, setExpanded] = useState(true)
  const { fabricante, promo_marca, date_start, date_end,
          days_remaining, is_expiring_soon, is_expired,
          products, tipo_promo, nombre_campana, pais_nombre } = group

  const borderColor = is_expired      ? 'border-red-200'
                    : is_expiring_soon ? 'border-amber-400'
                    : 'border-gray-100'
  const headerBg   = is_expired       ? 'bg-red-50'
                    : is_expiring_soon  ? 'bg-amber-50'
                    : 'bg-gray-50/60'

  return (
    <div className={`card overflow-hidden border ${borderColor} transition-all duration-200`}>

      {/* ── Card Header ───────────────────────────── */}
      <div
        className={`px-5 py-4 cursor-pointer select-none ${headerBg}`}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">

            {/* Fabricante */}
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <h3 className="text-sm font-black text-gray-900 truncate">
                {fabricante || '—'}
              </h3>
              {pais_nombre && (
                <span className="badge-info text-[10px]">{pais_nombre}</span>
              )}
              <ExpiryBadge
                days={days_remaining}
                isExpiringSoon={is_expiring_soon}
                isExpired={is_expired}
              />
            </div>

            {/* Promo Marca — el texto del banner */}
            <div className="flex items-start gap-2 mb-2">
              <span className="mt-0.5 text-[#0000E1] flex-shrink-0"><IconTag size={13}/></span>
              <p className="text-sm font-semibold text-[#0000E1] leading-snug">
                {promo_marca || '—'}
              </p>
            </div>

            {/* Fechas */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-wrap">
              <span className="text-gray-400"><IconCalendar size={12}/></span>
              <span className="font-medium">{_fmt(date_start)}</span>
              <span className="text-gray-300">→</span>
              <span className="font-medium">{_fmt(date_end)}</span>
              {nombre_campana && (
                <>
                  <span className="text-gray-300 mx-1">·</span>
                  <span className="text-gray-400 italic truncate max-w-[180px]">{nombre_campana}</span>
                </>
              )}
              {tipo_promo && (
                <>
                  <span className="text-gray-300 mx-1">·</span>
                  <span className="text-gray-400">{tipo_promo}</span>
                </>
              )}
            </div>
          </div>

          {/* Count + chevron */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 bg-white border border-gray-200 rounded-full px-2.5 py-1">
              <IconPackage size={12}/>
              {products.length} SKU{products.length !== 1 ? 's' : ''}
            </div>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>
      </div>

      {/* ── Alert banner si vence pronto ─────────── */}
      {is_expiring_soon && !is_expired && (
        <div className="px-5 py-2.5 bg-amber-50 border-t border-amber-200 flex items-center gap-2">
          <span className="text-amber-600"><IconAlertTriangle size={14}/></span>
          <p className="text-xs font-semibold text-amber-700">
            ⚠️ Este banner vence pronto — actualiza el home slider antes del {_fmt(date_end)}.
          </p>
        </div>
      )}
      {is_expired && (
        <div className="px-5 py-2.5 bg-red-50 border-t border-red-200 flex items-center gap-2">
          <span className="text-red-500"><IconAlertTriangle size={14}/></span>
          <p className="text-xs font-semibold text-red-700">
            🚨 Esta promo ya venció — retirar banner del home slider.
          </p>
        </div>
      )}

      {/* ── Product list (expandible) ─────────────── */}
      {expanded && (
        <div className="px-5 py-4 border-t border-gray-100">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Productos en este banner ({products.length})
          </p>
          <div className="space-y-2">
            {products.map((p, i) => (
              <div
                key={`${p.sku}-${i}`}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 hover:bg-blue-50/30 transition-colors"
              >
                <ProductThumb url={p.url_image} name={p.product_name} />
                <div className="min-w-0 flex-1">
                  {p.product_url
                    ? <a href={p.product_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-bold text-[#0000E1] truncate hover:underline block">
                        {p.product_name || '—'}
                      </a>
                    : <p className="text-xs font-bold text-gray-800 truncate">{p.product_name || '—'}</p>
                  }
                  <p className="text-[11px] text-gray-400 font-mono mt-0.5">{p.sku}</p>
                </div>
                {p.desc_pct > 0 && (
                  <span className="text-xs font-black bg-[#DEFF00] text-black px-2 py-0.5 rounded-full flex-shrink-0">
                    -{p.desc_pct}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="card overflow-hidden border border-gray-100">
      <div className="px-5 py-4 bg-gray-50/60">
        <div className="h-4 w-40 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="h-3 w-64 bg-gray-100 rounded animate-pulse mb-2" />
        <div className="h-3 w-32 bg-gray-100 rounded animate-pulse" />
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────
export default function HSInfo() {
  const { country, dateFrom, dateTo } = useFilters()

  const [groups,  setGroups]  = useState([])
  const [meta,    setMeta]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [search,  setSearch]  = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({
        ...(country  ? { country              } : {}),
        ...(dateFrom ? { date_from: dateFrom  } : {}),
        ...(dateTo   ? { date_to:   dateTo    } : {}),
      })
      const res = await apiRequest(`/hs_info?${params}`)
      setGroups(res.data || [])
      setMeta(res.meta || null)
    } catch (err) {
      setError(err.message || 'Error cargando HS Info')
    } finally {
      setLoading(false)
    }
  }, [country, dateFrom, dateTo])

  // Mount
  useEffect(() => { fetchData() }, []) // eslint-disable-line

  // Re-fetch on global filter change
  const prevRef = useRef({ country, dateFrom, dateTo })
  useEffect(() => {
    const p = prevRef.current
    if (p.country !== country || p.dateFrom !== dateFrom || p.dateTo !== dateTo) {
      prevRef.current = { country, dateFrom, dateTo }
      fetchData()
    }
  }, [country, dateFrom, dateTo, fetchData])

  // Filtro local por fabricante/promo
  const filtered = search.trim()
    ? groups.filter(g =>
        g.fabricante.toLowerCase().includes(search.toLowerCase()) ||
        g.promo_marca.toLowerCase().includes(search.toLowerCase())
      )
    : groups

  const expiringSoon = groups.filter(g => g.is_expiring_soon).length

  return (
    <div className="animate-fade-in">

      {/* ── Page header ────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HS Info</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Home sliders activos según el rango de fechas seleccionado.
            {meta && (
              <span className="ml-2 text-gray-400">
                {meta.total_groups} banners · {meta.total_products} productos
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold
                     border-[1.5px] border-blue-600 text-blue-600
                     hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-150"
        >
          <IconRefresh spin={loading} />
          Actualizar
        </button>
      </div>

      {/* ── Alerta global si hay promos por vencer ── */}
      {!loading && expiringSoon > 0 && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-300 flex items-center gap-3">
          <span className="text-amber-600 flex-shrink-0"><IconAlertTriangle size={18}/></span>
          <p className="text-sm font-semibold text-amber-800">
            {expiringSoon} banner{expiringSoon > 1 ? 's' : ''} vence{expiringSoon === 1 ? '' : 'n'} en los próximos 3 días.
            Revisa las tarjetas marcadas en naranja.
          </p>
        </div>
      )}

      {/* ── Error ────────────────────────────────── */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          ⚠️ {error}
          <button onClick={fetchData} className="ml-3 underline font-medium">Reintentar</button>
        </div>
      )}

      {/* ── Buscador local ───────────────────────── */}
      {!loading && groups.length > 0 && (
        <div className="mb-4 relative max-w-xs">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar fabricante o promo…"
            className="w-full h-9 pl-4 pr-3 text-sm bg-white border border-gray-200 rounded-lg
                       outline-none focus:border-[#0000E1] focus:ring-2 focus:ring-[#0000E1]/15
                       placeholder-gray-400 transition-all"
          />
        </div>
      )}

      {/* ── Cards grid ───────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <IconPackage size={28} />
          </div>
          <h3 className="text-base font-bold text-gray-700 mb-1">
            {search ? 'Sin resultados' : 'Sin promos activas'}
          </h3>
          <p className="text-sm text-gray-400 max-w-xs">
            {search
              ? `No hay banners que coincidan con "${search}"`
              : 'No hay promociones activas en el rango de fechas seleccionado. Prueba ajustando los filtros del topbar.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((group, i) => (
            <SliderCard
              key={`${group.fabricante}-${group.promo_marca}-${group.date_start}-${i}`}
              group={group}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Utils ────────────────────────────────────────────────────
function _fmt(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
  } catch { return iso }
}
