/**
 * 📄 /src/pages/PromoPerformance.jsx
 * Sección: Promo Performance
 * Tabla de cupones con filas expandibles (órdenes) y modal de productos.
 */
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useFilters }  from '@context/FiltersContext'
import { apiRequest }  from '@utils/api'

// ─── Icons ───────────────────────────────────────────────────
const IconSort = ({ dir }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    className="inline ml-1 opacity-50">
    {dir === 'asc'  && <polyline points="18 15 12 9 6 15"/>}
    {dir === 'desc' && <polyline points="6 9 12 15 18 9"/>}
    {!dir && (<><polyline points="18 9 12 3 6 9" opacity="0.35"/><polyline points="6 15 12 21 18 15" opacity="0.35"/></>)}
  </svg>
)
const IconChevron = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)
const IconRefresh = ({ spinning }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className={spinning ? 'animate-spin' : ''}>
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
)
const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const IconTag = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
)
const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const IconPackage = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
)

// ─── Helpers ──────────────────────────────────────────────────
const fmt = {
  usd:  v => `$${Number(v||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}`,
  pct:  v => `${Number(v||0).toFixed(1)}%`,
  num:  v => Number(v||0).toLocaleString('en-US'),
  date: v => v ? v.slice(0,10) : '—',
}
const COUNTRY_FLAG = { AR:'🇦🇷', CL:'🇨🇱', CO:'🇨🇴', MX:'🇲🇽' }
const STATUS_STYLE = {
  complete:  'bg-emerald-100 text-emerald-700',
  canceled:  'bg-red-100 text-red-600',
  pending:   'bg-amber-100 text-amber-700',
  processing:'bg-blue-100 text-blue-700',
}
const statusStyle = s => STATUS_STYLE[(s||'').toLowerCase()] || 'bg-gray-100 text-gray-600'
const convColor   = r => r>=80?'text-emerald-600 bg-emerald-50':r>=60?'text-lime-700 bg-lime-50':r>=40?'text-amber-700 bg-amber-50':'text-red-600 bg-red-50'

// ─── KPI card ─────────────────────────────────────────────────
function KpiCard({ label, value, sub, color='blue' }) {
  const c = {
    blue:   'from-blue-500/10 to-blue-500/5 border-blue-200 text-blue-700',
    emerald:'from-emerald-500/10 to-emerald-500/5 border-emerald-200 text-emerald-700',
    violet: 'from-violet-500/10 to-violet-500/5 border-violet-200 text-violet-700',
    amber:  'from-amber-500/10 to-amber-500/5 border-amber-200 text-amber-700',
  }[color]
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 ${c}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-black">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Modal de productos de una orden ──────────────────────────
function OrderModal({ order, onClose }) {
  const [products, setProducts] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await apiRequest(`/promo_orders?mode=products&order_number=${encodeURIComponent(order.order_number)}`)
        if (!cancelled) {
          if (res.status !== 'ok') throw new Error(res.message)
          setProducts(res.data || [])
        }
      } catch(e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [order.order_number])

  // Cerrar con Escape
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col"
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <IconPackage />
              <span className="font-black text-gray-900">Orden #{order.order_number}</span>
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${statusStyle(order.status)}`}>
                {order.status}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {COUNTRY_FLAG[order.country] || ''} {order.country} · {fmt.date(order.updated_at)} · Total {fmt.usd(order.total)} · Descuento {fmt.usd(order.discount_total)}
            </p>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition">
            <IconX />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {loading && (
            <div className="space-y-2">
              {[...Array(4)].map((_,i) => (
                <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse"/>
              ))}
            </div>
          )}
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">Error: {error}</p>}
          {!loading && !error && products.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Sin productos registrados para esta orden.</p>
          )}
          {products.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="pb-2 pr-3">Producto</th>
                  <th className="pb-2 pr-3">SKU</th>
                  <th className="pb-2 pr-3">Tipo</th>
                  <th className="pb-2 pr-3">Fórmula</th>
                  <th className="pb-2 pr-3 text-right">Cant.</th>
                  <th className="pb-2 pr-3 text-right">Precio</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50/60">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-gray-900 leading-snug">{p.name || '—'}</p>
                      {p.manufacturer && <p className="text-xs text-gray-400">{p.manufacturer}</p>}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-gray-600">{p.sku || '—'}</td>
                    <td className="py-2.5 pr-3">
                      <span className="text-xs text-gray-600">{p.type || '—'}</span>
                      {p.use_duration && <p className="text-xs text-gray-400">{p.use_duration}</p>}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-gray-500">{p.formula || '—'}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{p.quantity}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-gray-700">{fmt.usd(p.price)}</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold text-gray-900">{fmt.usd(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Fila expandible con órdenes ──────────────────────────────
function CouponRow({ row, dateFrom, dateTo, country }) {
  const [open,     setOpen]     = useState(false)
  const [orders,   setOrders]   = useState([])
  const [loading,  setLoading]  = useState(false)
  const [loaded,   setLoaded]   = useState(false)
  const [error,    setError]    = useState(null)
  const [modal,    setModal]    = useState(null) // orden seleccionada

  const toggle = async () => {
    if (!open && !loaded) {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          mode: 'orders',
          coupon_code: row.coupon_code,
          ...(dateFrom ? { date_from: dateFrom } : {}),
          ...(dateTo   ? { date_to:   dateTo   } : {}),
          ...(country  ? { country }              : {}),
        })
        const res = await apiRequest(`/promo_orders?${params}`)
        if (res.status !== 'ok') throw new Error(res.message)
        setOrders(res.data || [])
        setLoaded(true)
      } catch(e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    setOpen(o => !o)
  }

  return (
    <>
      {/* Fila principal del cupón */}
      <tr className={`hover:bg-blue-50/30 transition-colors cursor-pointer ${open ? 'bg-blue-50/20' : ''}`}
          onClick={toggle}>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            <span className={`text-gray-400 transition-transform ${loading ? 'animate-spin' : ''}`}>
              {loading
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
                : <IconChevron open={open} />
              }
            </span>
          </div>
        </td>
        <td className="px-3 py-3 font-medium text-gray-900 max-w-[180px]">
          <span className="truncate block" title={row.coupon_code}>{row.coupon_code}</span>
        </td>
        <td className="px-3 py-3 text-center">
          <span className="inline-flex items-center gap-1">
            <span>{COUNTRY_FLAG[row.country] || '🌎'}</span>
            <span className="text-xs text-gray-500 font-medium">{row.country}</span>
          </span>
        </td>
        <td className="px-3 py-3 text-right text-gray-700 tabular-nums">{fmt.num(row.total_orders)}</td>
        <td className="px-3 py-3 text-right">
          <span className="font-semibold text-emerald-700 tabular-nums">{fmt.num(row.completed_orders)}</span>
        </td>
        <td className="px-3 py-3 text-right tabular-nums">
          <span className={row.canceled_orders > 0 ? 'text-red-500' : 'text-gray-400'}>
            {fmt.num(row.canceled_orders)}
          </span>
        </td>
        <td className="px-3 py-3 text-right">
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${convColor(row.conversion_rate)}`}>
            {fmt.pct(row.conversion_rate)}
          </span>
        </td>
        <td className="px-3 py-3 text-right font-semibold text-gray-900 tabular-nums">{fmt.usd(row.gmv_usd)}</td>
        <td className="px-3 py-3 text-right text-gray-600 tabular-nums">
          {row.avg_order_value ? fmt.usd(row.avg_order_value) : '—'}
        </td>
      </tr>

      {/* Filas de órdenes (expandible) */}
      {open && (
        <tr>
          <td colSpan={9} className="p-0 border-b border-blue-100">
            <div className="bg-slate-50 border-t border-blue-100 px-6 py-3">
              {error && <p className="text-xs text-red-600 py-2">Error al cargar órdenes: {error}</p>}
              {!error && orders.length === 0 && loaded && (
                <p className="text-xs text-gray-400 py-2">Sin órdenes para este período.</p>
              )}
              {orders.length > 0 && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 font-semibold uppercase tracking-wide">
                      <th className="text-left pb-2 pr-4">Orden</th>
                      <th className="text-left pb-2 pr-4">Estado</th>
                      <th className="text-left pb-2 pr-4">País</th>
                      <th className="text-right pb-2 pr-4">Total</th>
                      <th className="text-right pb-2 pr-4">Descuento</th>
                      <th className="text-right pb-2">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map(o => (
                      <tr key={o.order_number}
                          className="hover:bg-blue-50 cursor-pointer transition-colors"
                          onClick={e => { e.stopPropagation(); setModal(o) }}>
                        <td className="py-2 pr-4 font-mono font-semibold text-blue-700 hover:underline">
                          #{o.order_number}
                        </td>
                        <td className="py-2 pr-4">
                          <span className={`px-1.5 py-0.5 rounded-full font-semibold ${statusStyle(o.status)}`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="py-2 pr-4">{COUNTRY_FLAG[o.country] || ''} {o.country}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-gray-800 font-medium">{fmt.usd(o.total)}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-red-500">{o.discount_total ? fmt.usd(o.discount_total) : '—'}</td>
                        <td className="py-2 text-right tabular-nums text-gray-500">{fmt.date(o.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}

      {/* Modal de productos */}
      {modal && <OrderModal order={modal} onClose={() => setModal(null)} />}
    </>
  )
}

// ─── Columnas de la tabla principal ───────────────────────────
const COLUMNS = [
  { key: null,               label: '',             align: 'left'  },
  { key: 'coupon_code',      label: 'Cupón',        align: 'left'  },
  { key: 'country',          label: 'País',         align: 'center'},
  { key: 'total_orders',     label: 'Total',        align: 'right' },
  { key: 'completed_orders', label: 'Completadas',  align: 'right' },
  { key: 'canceled_orders',  label: 'Canceladas',   align: 'right' },
  { key: 'conversion_rate',  label: 'Conversión',   align: 'right' },
  { key: 'gmv_usd',          label: 'GMV (USD)',    align: 'right' },
  { key: 'avg_order_value',  label: 'Ticket Prom.', align: 'right' },
]

// ─── Página principal ─────────────────────────────────────────
export default function PromoPerformance() {
  const { country, dateFrom, dateTo } = useFilters()

  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [sort,    setSort]    = useState({ key: 'completed_orders', dir: 'desc' })
  const [search,  setSearch]  = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const p = new URLSearchParams()
      if (dateFrom) p.set('date_from', dateFrom)
      if (dateTo)   p.set('date_to',   dateTo)
      if (country)  p.set('country',   country)
      const res = await apiRequest(`/promo_performance?${p}`)
      if (res.status !== 'ok') throw new Error(res.message || 'Error desconocido')
      setRows(res.data || [])
    } catch(e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [country, dateFrom, dateTo])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleSort = key => {
    if (!key) return
    setSort(s => s.key === key ? { key, dir: s.dir==='asc'?'desc':'asc' } : { key, dir: 'desc' })
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let arr = q ? rows.filter(r =>
      r.coupon_code.toLowerCase().includes(q) ||
      r.country.toLowerCase().includes(q)
    ) : rows
    return [...arr].sort((a,b) => {
      const av = a[sort.key] ?? ''; const bv = b[sort.key] ?? ''
      if (typeof av === 'number') return sort.dir==='asc' ? av-bv : bv-av
      return sort.dir==='asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
  }, [rows, sort, search])

  const kpis = useMemo(() => {
    const tot = filtered.reduce((s,r) => s+r.total_orders,     0)
    const com = filtered.reduce((s,r) => s+r.completed_orders, 0)
    const gmv = filtered.reduce((s,r) => s+r.gmv_usd,          0)
    return { coupons: filtered.length, tot, com, gmv, conv: tot ? com/tot*100 : 0 }
  }, [filtered])

  return (
    <div className="p-6 max-w-[1300px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <IconTag />
            <h1 className="text-xl font-black text-gray-900">Promo Performance</h1>
          </div>
          <p className="text-sm text-gray-500">
            Ventas con cupón agrupadas por código — haz clic en una fila para ver sus órdenes
          </p>
        </div>
        <button onClick={fetchData} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200
                     text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50">
          <IconRefresh spinning={loading} />
          {loading ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Cupones"         value={kpis.coupons}        color="violet" />
        <KpiCard label="Órdenes totales" value={fmt.num(kpis.tot)}   color="blue"
                 sub={`${fmt.num(kpis.com)} completadas`} />
        <KpiCard label="Conversión"      value={fmt.pct(kpis.conv)}  color="amber" />
        <KpiCard label="GMV total"       value={fmt.usd(kpis.gmv)}   color="emerald" />
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3
                        text-sm text-red-700">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><IconSearch /></span>
            <input type="text" placeholder="Buscar cupón o país…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
          </div>
          {search && <button onClick={() => setSearch('')} className="text-xs text-gray-400 hover:text-gray-600">Limpiar</button>}
          <span className="ml-auto text-xs text-gray-400">{filtered.length} resultados</span>
        </div>

        {loading && rows.length === 0 && (
          <div className="p-6 space-y-2">
            {[...Array(6)].map((_,i) => <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse"/>)}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <IconTag />
            <p className="mt-3 text-sm font-medium">Sin datos para el período seleccionado</p>
            <p className="text-xs mt-1">Ajusta el rango de fechas o el filtro de país</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {COLUMNS.map((col, i) => (
                    <th key={i}
                      onClick={() => toggleSort(col.key)}
                      className={`px-3 py-3 font-semibold text-gray-600 whitespace-nowrap
                                  text-${col.align} ${col.key ? 'cursor-pointer hover:bg-gray-100 select-none transition' : ''}`}>
                      {col.label}
                      {col.key && <IconSort dir={sort.key === col.key ? sort.dir : null} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((r, i) => (
                  <CouponRow
                    key={`${r.coupon_code}-${r.country}-${i}`}
                    row={r}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    country={country}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3 text-right">
        Fuente: DWH · Silver.sales + Silver.sales_products · empresa = lentesplus
      </p>
    </div>
  )
}
