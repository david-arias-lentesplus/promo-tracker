/**
 * 📄 /src/pages/Analytics.jsx
 * Auditoría de promociones — lista paginada + verificación por scraping
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { apiRequest } from '@utils/api'
import { useFilters }  from '@context/FiltersContext'

// ─── Icons ─────────────────────────────────────────────────────
const IconSearch    = ({ s=14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const IconCheck     = ({ s=14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
const IconX         = ({ s=14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IconAlert     = ({ s=14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
const IconLoader    = ({ s=14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
const IconPlay      = ({ s=13 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
const IconRefresh   = ({ s=13 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
const IconExternal  = ({ s=11 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
const IconChevron   = ({ s=14, dir='left' }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points={dir==='left'?'15 18 9 12 15 6':'9 18 15 12 9 6'}/></svg>
const IconFilter    = ({ s=14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>

// ─── Helpers ────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  try {
    const [y,m,d] = iso.split('-')
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`
  } catch { return iso }
}

// ─── Status badge (promo status) ────────────────────────────────
function StatusBadge({ status }) {
  const s = (status || '').toLowerCase()
  if (s === 'activo')   return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Activo</span>
  if (s === 'inactivo') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">Inactivo</span>
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">{status || '—'}</span>
}

// ─── Days remaining pill ─────────────────────────────────────────
function DaysPill({ days }) {
  if (days === null || days === undefined) return <span className="text-gray-400 text-xs">—</span>
  if (days < 0)   return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-400">Vencida</span>
  if (days === 0) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white">Hoy</span>
  if (days <= 3)  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white">{days}d</span>
  if (days <= 7)  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-black">{days}d</span>
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">{days}d</span>
}

// ─── Verification status badge ───────────────────────────────────
function VerifBadge({ state, onClick }) {
  if (!state) return (
    <button onClick={onClick}
      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 bg-white
                 text-[11px] font-semibold text-gray-500 hover:border-[#0000E1] hover:text-[#0000E1]
                 transition-colors whitespace-nowrap">
      <IconPlay s={11} /> Verificar
    </button>
  )
  if (state.loading) return (
    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-[11px] font-semibold text-blue-600 whitespace-nowrap">
      <IconLoader s={11} /> Verificando…
    </span>
  )
  if (state.status === 'ok') return (
    <button onClick={onClick} title={state.message}
      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-[11px] font-bold text-emerald-700 whitespace-nowrap hover:bg-emerald-200 transition-colors">
      <IconCheck s={11} /> Correcta
    </button>
  )
  if (state.status === 'warning') return (
    <button onClick={onClick} title={state.message}
      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-[11px] font-bold text-amber-700 whitespace-nowrap hover:bg-amber-200 transition-colors">
      <IconAlert s={11} /> Advertencia
    </button>
  )
  if (state.status === 'error') return (
    <button onClick={onClick} title={state.message}
      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-100 text-[11px] font-bold text-red-700 whitespace-nowrap hover:bg-red-200 transition-colors">
      <IconX s={11} /> Error
    </button>
  )
  if (state.status === 'pending') return (
    <button onClick={onClick} title={state.message}
      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-[11px] font-semibold text-gray-500 whitespace-nowrap hover:bg-gray-200 transition-colors">
      <IconAlert s={11} /> Pendiente
    </button>
  )
  return null
}

// ─── Result panel (shown below row) ─────────────────────────────
function ResultPanel({ state, onClose }) {
  if (!state || state.loading) return null
  const colors = {
    ok:      'bg-emerald-50 border-emerald-200',
    warning: 'bg-amber-50 border-amber-200',
    error:   'bg-red-50 border-red-200',
    pending: 'bg-gray-50 border-gray-200',
  }
  const textColors = {
    ok: 'text-emerald-800', warning: 'text-amber-800',
    error: 'text-red-800',  pending: 'text-gray-600',
  }
  const cls   = colors[state.status] || colors.pending
  const tcls  = textColors[state.status] || textColors.pending
  const det   = state.details || {}

  return (
    <tr>
      <td colSpan={9} className="px-4 pb-3 pt-0">
        <div className={`rounded-xl border p-3 ${cls}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className={`text-xs font-bold ${tcls} mb-1`}>{state.message}</p>
              {/* Precio tachado details */}
              {(state.tipo === 'precio_tachado' || state.tipo === 'Precio tachado') && (det.price_full || det.price_final) && (
                <div className="flex flex-wrap gap-4 text-[11px] text-gray-600 mt-1">
                  {det.price_full  && <span>Precio full: <strong className="line-through">{det.price_full?.toLocaleString()}</strong></span>}
                  {det.price_final && <span>Precio final: <strong>{det.price_final?.toLocaleString()}</strong></span>}
                  {det.discount_real != null && <span>Descuento real: <strong>{det.discount_real}%</strong></span>}
                  {det.discount_csv  != null && <span>Descuento CSV: <strong>{det.discount_csv}%</strong></span>}
                  {det.diff_pp       != null && <span>Diferencia: <strong>{det.diff_pp} pp</strong></span>}
                  {det.raw_full  && <span className="text-gray-400">Full raw: "{det.raw_full}"</span>}
                  {det.raw_final && <span className="text-gray-400">Final raw: "{det.raw_final}"</span>}
                </div>
              )}
              {/* Tier Price details */}
              {(state.tipo === 'tier_price' || state.tipo === 'Tier Price') && (
                <div className="flex flex-wrap gap-4 text-[11px] text-gray-600 mt-1">
                  {det.fields_filled && Object.keys(det.fields_filled).length > 0 && (
                    <span>Campos: {Object.entries(det.fields_filled).map(([k,v]) => `${k}: ${v}`).join(' | ')}</span>
                  )}
                  {det.qty           && <span>Cantidad: <strong>{det.qty}</strong></span>}
                  {det.price_full    && <span>Precio full: <strong>{det.price_full?.toLocaleString()}</strong></span>}
                  {det.price_final   && <span>Precio final: <strong>{det.price_final?.toLocaleString()}</strong></span>}
                  {det.discount_real != null && <span>Descuento real: <strong>{det.discount_real}%</strong></span>}
                  {det.discount_csv  != null && <span>Descuento CSV: <strong>{det.discount_csv}%</strong></span>}
                  {det.diff_pp       != null && <span>Diferencia: <strong>{det.diff_pp} pp</strong></span>}
                  {det.cart_url      && <a href={det.cart_url} target="_blank" rel="noopener noreferrer"
                      className="text-[#0000E1] underline">Ver carrito</a>}
                </div>
              )}
              {state.elapsed_ms && (
                <p className="text-[10px] text-gray-400 mt-1">{state.elapsed_ms}ms</p>
              )}
            </div>
            <button onClick={onClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors">
              <IconX s={13} />
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ─── Product thumbnail ───────────────────────────────────────────
function Thumb({ url, name }) {
  const [err, setErr] = useState(false)
  if (!url || err) return (
    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
      <span className="text-[8px] text-gray-400 text-center leading-tight px-0.5">{name?.slice(0,6)}</span>
    </div>
  )
  return (
    <img src={url} alt={name} onError={() => setErr(true)}
      className="w-9 h-9 rounded-lg object-contain bg-white border border-gray-100 flex-shrink-0" />
  )
}

// ─── Filter bar ──────────────────────────────────────────────────
function FilterBar({ meta, filters, onChange }) {
  const sel = (k, v) => onChange({ ...filters, [k]: v, page: 1 })

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search */}
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"><IconSearch s={13}/></span>
        <input value={filters.search || ''} onChange={e => sel('search', e.target.value)}
          placeholder="Buscar producto, SKU…"
          className="h-8 pl-7 pr-3 text-xs bg-white border border-gray-200 rounded-lg outline-none
                     focus:border-[#0000E1] focus:ring-2 focus:ring-[#0000E1]/10 w-52"/>
      </div>

      <select value={filters.status || ''} onChange={e => sel('status', e.target.value)}
        className="h-8 px-2 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:border-[#0000E1]">
        <option value="">Todos los estados</option>
        <option value="Activo">Activo</option>
        <option value="Inactivo">Inactivo</option>
      </select>

      <select value={filters.fabricante || ''} onChange={e => sel('fabricante', e.target.value)}
        className="h-8 px-2 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:border-[#0000E1]">
        <option value="">Todos los fabricantes</option>
        {(meta.fabricantes || []).map(f => <option key={f} value={f}>{f}</option>)}
      </select>

      <select value={filters.tipo_promo || ''} onChange={e => sel('tipo_promo', e.target.value)}
        className="h-8 px-2 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:border-[#0000E1]">
        <option value="">Todos los tipos</option>
        {(meta.tipo_promos || []).map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      <select value={filters.product_type || ''} onChange={e => sel('product_type', e.target.value)}
        className="h-8 px-2 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:border-[#0000E1]">
        <option value="">Todos los tipos de producto</option>
        {(meta.product_types || []).map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      {/* Active filter count */}
      {Object.entries(filters).filter(([k,v]) => k !== 'page' && k !== 'limit' && v).length > 0 && (
        <button onClick={() => onChange({ page: 1, limit: filters.limit })}
          className="h-8 px-3 text-xs font-semibold text-red-500 border border-red-200 rounded-lg
                     hover:bg-red-50 transition-colors">
          Limpiar filtros
        </button>
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────
export default function Analytics() {
  const { country, dateFrom, dateTo } = useFilters()

  const [data, setData]       = useState([])
  const [meta, setMeta]       = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [filters, setFilters] = useState({ page: 1, limit: 50 })

  // verifStates: { [rowKey]: { loading, status, message, details, ... } }
  const [verifStates, setVerifStates] = useState({})
  const [openPanel, setOpenPanel]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const p = new URLSearchParams()
      if (country)               p.set('country',      country)
      if (dateFrom)              p.set('date_from',    dateFrom)
      if (dateTo)                p.set('date_to',      dateTo)
      if (filters.search)        p.set('search',       filters.search)
      if (filters.status)        p.set('status',       filters.status)
      if (filters.fabricante)    p.set('fabricante',   filters.fabricante)
      if (filters.tipo_promo)    p.set('tipo_promo',   filters.tipo_promo)
      if (filters.product_type)  p.set('product_type', filters.product_type)
      p.set('page',  filters.page  || 1)
      p.set('limit', filters.limit || 50)

      const res = await apiRequest(`/analytics?${p}`)
      setData(res.data || [])
      setMeta(res.meta || {})
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [country, dateFrom, dateTo, filters])

  useEffect(() => { load() }, [load])

  // Row key: stable ID per product+promo combination
  function rowKey(row) {
    return `${row.sku || row.product_name}_${row.date_end}_${row.pais}`
  }

  async function handleVerify(row) {
    if (!row.product_url) {
      setVerifStates(s => ({ ...s, [rowKey(row)]: {
        status: 'error', message: 'Este producto no tiene URL de producto asociada.', details: {}
      }}))
      setOpenPanel(rowKey(row))
      return
    }
    const key = rowKey(row)
    setOpenPanel(key)
    setVerifStates(s => ({ ...s, [key]: { loading: true } }))
    try {
      const res = await apiRequest('/scraper', {
        method: 'POST',
        body: JSON.stringify({
          url:          row.product_url,
          tipo_promo:   row.tipo_promo,
          sku:          row.sku,
          desc_pct:     row.total_desc_pct || 0,
          qty_max_promo: row.qty_max_promo || '1',
        }),
      })
      setVerifStates(s => ({ ...s, [key]: res }))
    } catch (err) {
      setVerifStates(s => ({ ...s, [key]: {
        status: 'error', message: err.message, details: {}
      }}))
    }
  }

  function handleFiltersChange(newFilters) {
    setFilters(newFilters)
  }

  const totalPages = meta.total_pages || 1
  const page       = filters.page || 1

  // Summary counts
  const verifList   = Object.values(verifStates).filter(v => !v.loading)
  const verifOk     = verifList.filter(v => v.status === 'ok').length
  const verifWarn   = verifList.filter(v => v.status === 'warning').length
  const verifErr    = verifList.filter(v => v.status === 'error').length

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Auditoría de promociones — verifica si las promos están correctamente activadas
          </p>
        </div>

        {/* Verif summary */}
        {verifList.length > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {verifOk > 0   && <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold"><IconCheck s={12}/>{verifOk} OK</span>}
            {verifWarn > 0 && <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold"><IconAlert s={12}/>{verifWarn}</span>}
            {verifErr > 0  && <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-bold"><IconX s={12}/>{verifErr} Error</span>}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <FilterBar meta={meta} filters={filters} onChange={handleFiltersChange} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Producto','SKU','Fabricante','Estado','Promo Marca','Tipo Promo','Descuento','Vigencia','Verificación'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-20 text-sm text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-[#0000E1] border-t-transparent rounded-full animate-spin"/>
                    Cargando productos…
                  </div>
                </td></tr>
              ) : error ? (
                <tr><td colSpan={9} className="text-center py-12 text-sm text-red-500">{error}</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-16 text-sm text-gray-400">
                  No hay productos para los filtros seleccionados.
                </td></tr>
              ) : data.map((row, i) => {
                const key   = rowKey(row)
                const verif = verifStates[key]
                const isOpen = openPanel === key

                return (
                  <React.Fragment key={`${key}-${i}`}>
                    <tr className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors
                      ${isOpen ? 'bg-gray-50/50' : ''}`}>

                      {/* Product */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Thumb url={row.image_url} name={row.product_name} />
                          <div className="min-w-0">
                            {row.product_url
                              ? <a href={row.product_url} target="_blank" rel="noopener noreferrer"
                                    className="text-xs font-semibold text-[#0000E1] hover:underline line-clamp-2 leading-snug flex items-center gap-1">
                                  {row.product_name || '—'} <IconExternal s={10}/>
                                </a>
                              : <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug">{row.product_name || '—'}</p>
                            }
                            {row.pais_nombre && (
                              <p className="text-[10px] text-gray-400 mt-0.5">{row.pais_nombre}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                          {row.sku || '—'}
                        </span>
                      </td>

                      {/* Fabricante */}
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-[120px]">
                        <span className="truncate block">{row.fabricante || '—'}</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>

                      {/* Promo Marca */}
                      <td className="px-4 py-3 max-w-[160px]">
                        <p className="text-xs text-gray-700 truncate" title={row.promo_marca}>
                          {row.promo_marca || '—'}
                        </p>
                      </td>

                      {/* Tipo Promo */}
                      <td className="px-4 py-3">
                        {row.tipo_promo
                          ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 whitespace-nowrap">
                              {row.tipo_promo}
                            </span>
                          : <span className="text-gray-400 text-xs">—</span>
                        }
                      </td>

                      {/* Descuento */}
                      <td className="px-4 py-3">
                        {row.total_desc_pct > 0
                          ? <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-[#DEFF00] text-black">
                              -{row.total_desc_pct}%
                            </span>
                          : <span className="text-gray-400 text-xs">—</span>
                        }
                      </td>

                      {/* Vigencia */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-gray-400">{fmtDate(row.date_start)} →</span>
                          <span className="text-[10px] text-gray-600 font-medium">{fmtDate(row.date_end)}</span>
                          <DaysPill days={row.days_remaining} />
                        </div>
                      </td>

                      {/* Verification */}
                      <td className="px-4 py-3">
                        <VerifBadge
                          state={verif}
                          onClick={() => {
                            if (!verif || verif.loading) handleVerify(row)
                            else setOpenPanel(isOpen ? null : key)
                          }}
                        />
                      </td>
                    </tr>

                    {/* Result panel row */}
                    {isOpen && verif && !verif.loading && (
                      <ResultPanel state={verif} onClose={() => setOpenPanel(null)} />
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-500">
              {meta.total?.toLocaleString()} productos · página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1}
                onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center
                           text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <IconChevron s={13} dir="left"/>
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                if (p > totalPages) return null
                return (
                  <button key={p} onClick={() => setFilters(f => ({ ...f, page: p }))}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold border transition-colors
                      ${p === page ? 'bg-[#0000E1] text-white border-[#0000E1]' : 'border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                    {p}
                  </button>
                )
              })}
              <button disabled={page >= totalPages}
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center
                           text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <IconChevron s={13} dir="right"/>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
