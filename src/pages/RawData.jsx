/**
 * 📄 /src/pages/RawData.jsx
 * Agente 1 — Frontend (Skill B: Consumo de Datos)
 * Columnas: Imagen, SKU, Producto, Fabricante, BU, Tipo, Tipo de Uso, Duración, Estado,
 *           Campaña, Promo Marca, Desc., Tipo Promo, Vigencia
 * Design System: LIVO
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import PageLoader from '../components/PageLoader'
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
const IconDownload = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)
const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const IconChevronL = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)
const IconChevronR = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
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

// ─── Sub-components ───────────────────────────────────────────
function StatusBadge({ status }) {
  const s = (status || '').toLowerCase()
  if (s.includes('activo') && !s.includes('no'))
    return <span className="badge-success">Activo</span>
  return <span className="badge-neutral">{status || '—'}</span>
}

function ProductThumb({ url, name }) {
  const [err, setErr] = useState(false)
  if (!url || err) return (
    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
      <IconImage />
    </div>
  )
  return (
    <img src={url} alt={name} onError={() => setErr(true)}
      className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
  )
}

function DiscountBadge({ pct }) {
  if (!pct || pct === 0) return <span className="text-gray-400 text-xs">—</span>
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold bg-[#DEFF00] text-black">
      -{pct}%
    </span>
  )
}

function Pagination({ page, totalPages, onPage }) {
  const pages = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('…')
    pages.push(totalPages)
  }
  const base = "w-9 h-9 rounded-lg text-sm font-medium flex items-center justify-center transition-colors"
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onPage(page - 1)} disabled={page === 1}
        className={`${base} text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed`}>
        <IconChevronL />
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="w-6 text-center text-gray-400 text-sm">…</span>
        ) : (
          <button key={p} onClick={() => onPage(p)}
            className={`${base} ${page === p ? 'bg-blue-600 text-white shadow-livo-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
            {p}
          </button>
        )
      )}
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
        className={`${base} text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed`}>
        <IconChevronR />
      </button>
    </div>
  )
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-50">
      {[10, 20, 44, 28, 14, 16, 22, 20, 16, 24, 22, 16, 18, 16].map((w, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${w * 4}px` }} />
        </td>
      ))}
    </tr>
  )
}

// ─── Main ─────────────────────────────────────────────────────
const PAGE_SIZE = 50

export default function RawData() {
  const { country, dateFrom, dateTo } = useFilters()

  const [data,           setData]           = useState([])
  const [meta,           setMeta]           = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState('')
  const [search,         setSearch]         = useState('')
  const [statusFilter,   setStatusFilter]   = useState('')
  const [typeFilter,     setTypeFilter]     = useState('')
  const [useTypeFilter,  setUseTypeFilter]  = useState('')
  const [useDurFilter,   setUseDurFilter]   = useState('')
  const [availTypes,     setAvailTypes]     = useState([])
  const [availUseTypes,  setAvailUseTypes]  = useState([])
  const [availUseDurs,   setAvailUseDurs]   = useState([])
  const [page,           setPage]           = useState(1)
  const [lastUpdated,    setLastUpdated]    = useState(null)

  const buildParams = useCallback((overrides = {}) => {
    const p   = overrides.page         ?? page
    const s   = overrides.search       ?? search
    const f   = overrides.status       ?? statusFilter
    const pt  = overrides.product_type ?? typeFilter
    const ut  = overrides.use_type     ?? useTypeFilter
    const ud  = overrides.use_duration ?? useDurFilter
    return new URLSearchParams({
      page:  p,
      limit: PAGE_SIZE,
      ...(s   ? { search:       s   } : {}),
      ...(f   ? { status:       f   } : {}),
      ...(country  ? { country              } : {}),
      ...(dateFrom ? { date_from: dateFrom  } : {}),
      ...(dateTo   ? { date_to:   dateTo    } : {}),
      ...(pt  ? { product_type: pt } : {}),
      ...(ut  ? { use_type:     ut } : {}),
      ...(ud  ? { use_duration: ud } : {}),
    })
  }, [page, search, statusFilter, typeFilter, useTypeFilter, useDurFilter, country, dateFrom, dateTo])

  const fetchData = useCallback(async (overrides = {}) => {
    setLoading(true); setError('')
    try {
      const res = await apiRequest(`/raw_data?${buildParams(overrides)}`)
      setData(res.data || [])
      setMeta(res.meta || null)
      if (res.meta?.unique_types)          setAvailTypes(res.meta.unique_types)
      if (res.meta?.unique_use_types)      setAvailUseTypes(res.meta.unique_use_types)
      if (res.meta?.unique_use_durations)  setAvailUseDurs(res.meta.unique_use_durations)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err.message || 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => { fetchData() }, [])   // eslint-disable-line

  const prevGlobal = useRef({ country, dateFrom, dateTo, typeFilter, useTypeFilter, useDurFilter })
  useEffect(() => {
    const prev = prevGlobal.current
    if (prev.country !== country || prev.dateFrom !== dateFrom || prev.dateTo !== dateTo
        || prev.typeFilter !== typeFilter || prev.useTypeFilter !== useTypeFilter
        || prev.useDurFilter !== useDurFilter) {
      prevGlobal.current = { country, dateFrom, dateTo, typeFilter, useTypeFilter, useDurFilter }
      setPage(1)
      fetchData({ page: 1 })
    }
  }, [country, dateFrom, dateTo, typeFilter, useTypeFilter, useDurFilter])  // eslint-disable-line

  const searchMounted = useRef(false)
  useEffect(() => {
    if (!searchMounted.current) { searchMounted.current = true; return }
    const t = setTimeout(() => { setPage(1); fetchData({ page: 1, search }) }, 400)
    return () => clearTimeout(t)
  }, [search])  // eslint-disable-line

  const handleStatusChange  = val => { setStatusFilter(val);  setPage(1); fetchData({ page: 1, status: val }) }
  const handleTypeChange    = val => { setTypeFilter(val);    setPage(1); fetchData({ page: 1, product_type: val }) }
  const handleUseTypeChange = val => { setUseTypeFilter(val); setPage(1); fetchData({ page: 1, use_type: val }) }
  const handleUseDurChange  = val => { setUseDurFilter(val);  setPage(1); fetchData({ page: 1, use_duration: val }) }
  const handlePage          = p   => { setPage(p); fetchData({ page: p }) }

  const handleExport = () => {
    const headers = ['SKU','Producto','Fabricante','BU','País','Tipo','Tipo de Uso','Duración de Uso',
                     'Estado','Fecha Inicio','Fecha Fin','Campaña','Promo Marca','Descuento %','Tipo Promo','Imagen URL']
    const rows = data.map(r => [
      r.sku, `"${r.product_name}"`, `"${r.fabricante}"`, r.business_unit, r.pais,
      r.product_type, r.use_type, r.use_duration,
      r.status, r.date_start, r.date_end,
      `"${r.nombre_campana}"`, `"${r.promo_marca}"`, r.total_desc_pct, r.tipo_promo, r.url_image
    ].join(','))
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' })
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob), download: 'raw_data_export.csv'
    })
    a.click(); URL.revokeObjectURL(a.href)
  }

  const totalPages = meta?.total_pages ?? 1

  return (
    <div className="animate-fade-in">
      <PageLoader show={loading} />

      {/* ── Page header ──────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Raw Dataset</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Complete product inventory and promotional status.
            {meta && (
              <span className="ml-2 text-gray-400">
                {meta.total_all?.toLocaleString()} registros totales
                {lastUpdated && ` · Actualizado ${lastUpdated.toLocaleTimeString()}`}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setPage(1); fetchData({ page: 1 }) }} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold
                       border-[1.5px] border-blue-600 text-blue-600
                       hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150">
            <IconRefresh spin={loading} />
            CSV Update
          </button>
          <button onClick={handleExport} className="btn-primary flex items-center gap-2">
            <IconDownload />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          ⚠️ {error}
          <button onClick={() => fetchData()} className="ml-3 underline font-medium">Reintentar</button>
        </div>
      )}

      {/* ── Table card ───────────────────────────────────────── */}
      <div className="card overflow-hidden">

        {/* Filters row */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <IconSearch />
            </span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="SKU, producto, fabricante…"
              className="w-full h-9 pl-9 pr-3 text-sm bg-gray-50 border border-gray-200 rounded-lg
                         placeholder-gray-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all duration-150" />
          </div>

          {/* Status */}
          <select value={statusFilter} onChange={e => handleStatusChange(e.target.value)}
            className="h-9 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none
                       focus:border-blue-600 text-gray-600 cursor-pointer">
            <option value="">Todos los estados</option>
            <option value="Activo">Activo</option>
            <option value="No Activo">No Activo</option>
          </select>

          {/* Tipo de producto */}
          {availTypes.length > 0 && (
            <select value={typeFilter} onChange={e => handleTypeChange(e.target.value)}
              className="h-9 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none
                         focus:border-blue-600 text-gray-600 cursor-pointer">
              <option value="">Todos los tipos</option>
              {availTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}

          {/* Tipo de uso */}
          {availUseTypes.length > 0 && (
            <select value={useTypeFilter} onChange={e => handleUseTypeChange(e.target.value)}
              className="h-9 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none
                         focus:border-blue-600 text-gray-600 cursor-pointer">
              <option value="">Tipo de uso</option>
              {availUseTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}

          {/* Duración de uso */}
          {availUseDurs.length > 0 && (
            <select value={useDurFilter} onChange={e => handleUseDurChange(e.target.value)}
              className="h-9 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none
                         focus:border-blue-600 text-gray-600 cursor-pointer">
              <option value="">Duración de uso</option>
              {availUseDurs.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}

          {/* Active global filter pills */}
          {(country || dateFrom || dateTo) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {country && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                  🌍 {meta?.countries?.find(c => c.code === country)?.name || country}
                </span>
              )}
              {(dateFrom || dateTo) && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-600 border border-purple-200">
                  📅 {dateFrom || '…'} → {dateTo || '…'}
                </span>
              )}
            </div>
          )}

          {meta && !loading && (
            <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">
              {meta.total.toLocaleString()} resultados · {meta.elapsed_ms}ms
            </span>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1400px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70">
                {['Imagen','SKU','Producto','Fabricante','BU','Tipo','Tipo de Uso','Duración',
                  'Estado','Campaña','Promo Marca','Desc.','Tipo Promo','Vigencia'].map(col => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 tracking-wider uppercase whitespace-nowrap first:pl-5">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-5 py-16 text-center text-gray-400 text-sm">
                    {search ? `Sin resultados para "${search}"` : 'No hay datos disponibles'}
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr key={`${row.sku}-${idx}`}
                    className={`border-b border-gray-50 hover:bg-blue-50/20 transition-colors duration-100 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/20'
                    }`}>

                    <td className="pl-5 pr-2 py-3">
                      <ProductThumb url={row.url_image} name={row.product_name} />
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-bold text-xs text-gray-800 tracking-wide font-mono whitespace-nowrap">
                        {row.sku || '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3 max-w-[180px]">
                      {row.product_url
                        ? <a href={row.product_url} target="_blank" rel="noopener noreferrer"
                            className="text-[#0000E1] font-medium text-xs leading-snug line-clamp-2 hover:underline">
                            {row.product_name || '—'}
                          </a>
                        : <p className="text-gray-700 font-medium text-xs leading-snug line-clamp-2">
                            {row.product_name || '—'}
                          </p>
                      }
                    </td>

                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px]">
                      <span className="truncate block">{row.fabricante || '—'}</span>
                    </td>

                    <td className="px-4 py-3">
                      {row.business_unit
                        ? <span className="badge-info">{row.business_unit}</span>
                        : <span className="text-gray-400 text-xs">—</span>}
                    </td>

                    {/* Tipo de producto */}
                    <td className="px-4 py-3">
                      {row.product_type
                        ? <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-100 whitespace-nowrap">{row.product_type}</span>
                        : <span className="text-gray-400 text-xs">—</span>}
                    </td>

                    {/* Tipo de uso */}
                    <td className="px-4 py-3">
                      {row.use_type
                        ? <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-100 whitespace-nowrap">{row.use_type}</span>
                        : <span className="text-gray-400 text-xs">—</span>}
                    </td>

                    {/* Duración de uso */}
                    <td className="px-4 py-3">
                      {row.use_duration
                        ? <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-100 whitespace-nowrap">{row.use_duration}</span>
                        : <span className="text-gray-400 text-xs">—</span>}
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>

                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[130px]">
                      <span className="truncate block">{row.nombre_campana || row.tipo_campana || '—'}</span>
                    </td>

                    <td className="px-4 py-3 text-gray-600 text-xs max-w-[130px]">
                      <span className="truncate block">{row.promo_marca || '—'}</span>
                    </td>

                    <td className="px-4 py-3">
                      <DiscountBadge pct={row.total_desc_pct} />
                    </td>

                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {row.tipo_promo || '—'}
                    </td>

                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {row.date_start && row.date_end ? (
                        <div className="space-y-0.5">
                          <div>{_shortDate(row.date_start)}</div>
                          <div className="text-gray-300">→ {_shortDate(row.date_end)}</div>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-gray-500">
            {loading ? 'Cargando…' : (
              <>
                Mostrando{' '}
                <span className="font-semibold text-gray-700">
                  {meta ? ((page - 1) * PAGE_SIZE + 1) : 0}
                </span>{' '}–{' '}
                <span className="font-semibold text-gray-700">
                  {meta ? Math.min(page * PAGE_SIZE, meta.total) : 0}
                </span>{' '}de{' '}
                <span className="font-semibold text-gray-700">
                  {meta?.total?.toLocaleString() ?? 0}
                </span>{' '}entradas
              </>
            )}
          </p>
          {!loading && totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPage={handlePage} />
          )}
        </div>
      </div>
    </div>
  )
}

function _shortDate(raw) {
  if (!raw) return '—'
  try {
    const d = new Date(raw)
    if (isNaN(d)) return String(raw).slice(0, 12)
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return String(raw).slice(0, 12) }
}
