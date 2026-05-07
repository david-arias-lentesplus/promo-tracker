/**
 * 📄 /src/pages/PromoPerformance.jsx
 * Tabs: Promo Review | Product Tier List | Promo Analysis
 */
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import PageLoader from '../components/PageLoader'
import { useFilters }  from '@context/FiltersContext'
import { apiRequest }  from '@utils/api'

// ─── Icons ───────────────────────────────────────────────────
const Ico = {
  sort: ({ dir }) => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline ml-1 opacity-50">
      {dir==='asc' && <polyline points="18 15 12 9 6 15"/>}
      {dir==='desc' && <polyline points="6 9 12 15 18 9"/>}
      {!dir && <><polyline points="18 9 12 3 6 9" opacity="0.35"/><polyline points="6 15 12 21 18 15" opacity="0.35"/></>}
    </svg>
  ),
  chevron: ({ open }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${open?'rotate-90':''}`}>
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  refresh: ({ spin }) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={spin?'animate-spin':''}>
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  ),
  search: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  x: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  pkg: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  spark: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"/>
    </svg>
  ),
  filter: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  ),
  brain: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
    </svg>
  ),
  trending: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  award: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
    </svg>
  ),
}

// ─── Helpers ─────────────────────────────────────────────────
const fmt = {
  usd:  v => `$${Number(v||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}`,
  pct:  v => `${Number(v||0).toFixed(1)}%`,
  num:  v => Number(v||0).toLocaleString('en-US'),
  date: v => v ? v.slice(0,10) : '—',
}
const FLAG  = { AR:'🇦🇷', CL:'🇨🇱', CO:'🇨🇴', MX:'🇲🇽' }
const convColor = r => r>=80?'text-emerald-600 bg-emerald-50':r>=60?'text-lime-700 bg-lime-50':r>=40?'text-amber-700 bg-amber-50':'text-red-600 bg-red-50'
const STATUS_CLS = { complete:'bg-emerald-100 text-emerald-700', canceled:'bg-red-100 text-red-600', pending:'bg-amber-100 text-amber-700', processing:'bg-blue-100 text-blue-700' }
const statusCls = s => STATUS_CLS[(s||'').toLowerCase()] || 'bg-gray-100 text-gray-600'

function KpiCard({ label, value, sub, color='blue' }) {
  const c = {blue:'from-blue-500/10 to-blue-500/5 border-blue-200 text-blue-700',emerald:'from-emerald-500/10 to-emerald-500/5 border-emerald-200 text-emerald-700',violet:'from-violet-500/10 to-violet-500/5 border-violet-200 text-violet-700',amber:'from-amber-500/10 to-amber-500/5 border-amber-200 text-amber-700'}[color]
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 ${c}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-black">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

function Skeleton({ rows=5 }) {
  return <div className="p-5 space-y-2">{[...Array(rows)].map((_,i)=><div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse"/>)}</div>
}

function EmptyState({ msg='Sin datos para el período seleccionado', sub='Ajusta el rango de fechas o el filtro de país' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-50">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p className="text-sm font-medium">{msg}</p>
      <p className="text-xs mt-1">{sub}</p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: PROMO REVIEW
// ═══════════════════════════════════════════════════════════════
function OrderModal({ order, onClose }) {
  const [products,setProducts]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(null)
  useEffect(()=>{
    let c=false
    apiRequest(`/promo?mode=products&order_number=${encodeURIComponent(order.order_number)}`)
      .then(r=>{ if(!c){ if(r.status!=='ok') throw new Error(r.message); setProducts(r.data||[]) }})
      .catch(e=>{ if(!c) setError(e.message) })
      .finally(()=>{ if(!c) setLoading(false) })
    return ()=>{ c=true }
  },[order.order_number])
  useEffect(()=>{ const h=e=>{if(e.key==='Escape')onClose()}; window.addEventListener('keydown',h); return ()=>window.removeEventListener('keydown',h) },[onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e=>e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2"><Ico.pkg/><span className="font-black text-gray-900">Orden #{order.order_number}</span>
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${statusCls(order.status)}`}>{order.status}</span></div>
            <p className="text-xs text-gray-400 mt-0.5">{FLAG[order.country]||''} {order.country} · {fmt.date(order.updated_at)} · Total {fmt.usd(order.total)} · Desc. {fmt.usd(order.discount_total)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"><Ico.x/></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {loading && <Skeleton rows={4}/>}
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">Error: {error}</p>}
          {!loading && !error && products.length===0 && <EmptyState msg="Sin productos registrados" sub=""/>}
          {products.length>0 && (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="pb-2 pr-3">Producto</th><th className="pb-2 pr-3">SKU</th>
                <th className="pb-2 pr-3">Tipo</th><th className="pb-2 pr-3">Fórmula</th>
                <th className="pb-2 pr-3 text-right">Cant.</th><th className="pb-2 pr-3 text-right">Precio</th><th className="pb-2 text-right">Total</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {products.map((p,i)=>(
                  <tr key={i} className="hover:bg-gray-50/60">
                    <td className="py-2.5 pr-3"><p className="font-medium text-gray-900">{p.name||'—'}</p>{p.manufacturer&&<p className="text-xs text-gray-400">{p.manufacturer}</p>}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-gray-600">{p.sku||'—'}</td>
                    <td className="py-2.5 pr-3"><p className="text-xs text-gray-600">{p.type||'—'}</p>{p.use_duration&&<p className="text-xs text-gray-400">{p.use_duration}</p>}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-gray-500">{p.formula||'—'}</td>
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

function CouponRow({ row, dateFrom, dateTo, country }) {
  const [open,setOpen]=useState(false); const [orders,setOrders]=useState([]); const [loading,setLoading]=useState(false)
  const [loaded,setLoaded]=useState(false); const [error,setError]=useState(null); const [modal,setModal]=useState(null)

  const toggle = async () => {
    if (!open && !loaded) {
      setLoading(true); setError(null)
      try {
        const p=new URLSearchParams({mode:'orders',coupon_code:row.coupon_code,...(dateFrom?{date_from:dateFrom}:{}),...(dateTo?{date_to:dateTo}:{}),...(country?{country}:{})})
        const res=await apiRequest(`/promo?${p}`)
        if(res.status!=='ok') throw new Error(res.message)
        setOrders(res.data||[]); setLoaded(true)
      } catch(e){ setError(e.message) } finally{ setLoading(false) }
    }
    setOpen(o=>!o)
  }
  return (
    <>
      <tr className={`hover:bg-blue-50/30 transition-colors cursor-pointer ${open?'bg-blue-50/20':''}`} onClick={toggle}>
        <td className="px-3 py-3"><span className={`text-gray-400 ${loading?'animate-spin':''}`}><Ico.chevron open={open}/></span></td>
        <td className="px-3 py-3 font-medium text-gray-900 max-w-[180px]"><span className="truncate block" title={row.coupon_code}>{row.coupon_code}</span></td>
        <td className="px-3 py-3 text-center"><span className="inline-flex items-center gap-1"><span>{FLAG[row.country]||'🌎'}</span><span className="text-xs text-gray-500 font-medium">{row.country}</span></span></td>
        <td className="px-3 py-3 text-right text-gray-700 tabular-nums">{fmt.num(row.total_orders)}</td>
        <td className="px-3 py-3 text-right"><span className="font-semibold text-emerald-700 tabular-nums">{fmt.num(row.completed_orders)}</span></td>
        <td className="px-3 py-3 text-right tabular-nums"><span className={row.canceled_orders>0?'text-red-500':'text-gray-400'}>{fmt.num(row.canceled_orders)}</span></td>
        <td className="px-3 py-3 text-right"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${convColor(row.conversion_rate)}`}>{fmt.pct(row.conversion_rate)}</span></td>
        <td className="px-3 py-3 text-right font-semibold text-gray-900 tabular-nums">{fmt.usd(row.gmv_usd)}</td>
        <td className="px-3 py-3 text-right text-gray-600 tabular-nums">{row.avg_order_value?fmt.usd(row.avg_order_value):'—'}</td>
      </tr>
      {open && (
        <tr><td colSpan={9} className="p-0 border-b border-blue-100">
          <div className="bg-slate-50 border-t border-blue-100 px-6 py-3">
            {error && <p className="text-xs text-red-600 py-2">Error: {error}</p>}
            {!error && orders.length===0 && loaded && <p className="text-xs text-gray-400 py-2">Sin órdenes para este período.</p>}
            {orders.length>0 && (
              <table className="w-full text-xs">
                <thead><tr className="text-gray-500 font-semibold uppercase tracking-wide">
                  <th className="text-left pb-2 pr-4">Orden</th><th className="text-left pb-2 pr-4">Estado</th>
                  <th className="text-left pb-2 pr-4">País</th><th className="text-right pb-2 pr-4">Total</th>
                  <th className="text-right pb-2 pr-4">Descuento</th><th className="text-right pb-2">Fecha</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map(o=>(
                    <tr key={o.order_number} className="hover:bg-blue-50 cursor-pointer transition-colors" onClick={e=>{e.stopPropagation();setModal(o)}}>
                      <td className="py-2 pr-4 font-mono font-semibold text-blue-700">#{o.order_number}</td>
                      <td className="py-2 pr-4"><span className={`px-1.5 py-0.5 rounded-full font-semibold ${statusCls(o.status)}`}>{o.status}</span></td>
                      <td className="py-2 pr-4">{FLAG[o.country]||''} {o.country}</td>
                      <td className="py-2 pr-4 text-right tabular-nums font-medium">{fmt.usd(o.total)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-red-500">{o.discount_total?fmt.usd(o.discount_total):'—'}</td>
                      <td className="py-2 text-right tabular-nums text-gray-500">{fmt.date(o.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </td></tr>
      )}
      {modal && <OrderModal order={modal} onClose={()=>setModal(null)}/>}
    </>
  )
}

const PROMO_COLS = [
  {key:null,label:'',align:'left'},{key:'coupon_code',label:'Cupón',align:'left'},
  {key:'country',label:'País',align:'center'},{key:'total_orders',label:'Total',align:'right'},
  {key:'completed_orders',label:'Completadas',align:'right'},{key:'canceled_orders',label:'Canceladas',align:'right'},
  {key:'conversion_rate',label:'Conversión',align:'right'},{key:'gmv_usd',label:'GMV (USD)',align:'right'},
  {key:'avg_order_value',label:'Ticket Prom.',align:'right'},
]

function PromoReview({ country, dateFrom, dateTo, onLoaded }) {
  const [rows,setRows]=useState([]); const [loading,setLoading]=useState(false); const [error,setError]=useState(null)
  const [sort,setSort]=useState({key:'completed_orders',dir:'desc'}); const [search,setSearch]=useState('')

  const fetchData = useCallback(async()=>{
    setLoading(true); setError(null)
    try {
      const p=new URLSearchParams(); if(dateFrom)p.set('date_from',dateFrom); if(dateTo)p.set('date_to',dateTo); if(country)p.set('country',country)
      const res=await apiRequest(`/promo?mode=performance&${p}`)
      if(res.status!=='ok') throw new Error(res.message||'Error')
      setRows(res.data||[])
    } catch(e){ setError(e.message) } finally{ setLoading(false); onLoaded?.() }
  },[country,dateFrom,dateTo])
  useEffect(()=>{ fetchData() },[fetchData])

  const toggleSort=key=>{ if(!key)return; setSort(s=>s.key===key?{key,dir:s.dir==='asc'?'desc':'asc'}:{key,dir:'desc'}) }
  const filtered=useMemo(()=>{
    const q=search.toLowerCase()
    let arr=q?rows.filter(r=>r.coupon_code.toLowerCase().includes(q)||r.country.toLowerCase().includes(q)):rows
    return [...arr].sort((a,b)=>{ const av=a[sort.key]??'',bv=b[sort.key]??''; return typeof av==='number'?(sort.dir==='asc'?av-bv:bv-av):(sort.dir==='asc'?String(av).localeCompare(String(bv)):String(bv).localeCompare(String(av))) })
  },[rows,sort,search])
  const kpis=useMemo(()=>{ const tot=filtered.reduce((s,r)=>s+r.total_orders,0),com=filtered.reduce((s,r)=>s+r.completed_orders,0),gmv=filtered.reduce((s,r)=>s+r.gmv_usd,0); return {n:filtered.length,tot,com,gmv,conv:tot?com/tot*100:0} },[filtered])

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Cupones" value={kpis.n} color="violet"/>
        <KpiCard label="Órdenes" value={fmt.num(kpis.tot)} sub={`${fmt.num(kpis.com)} completadas`} color="blue"/>
        <KpiCard label="Conversión" value={fmt.pct(kpis.conv)} color="amber"/>
        <KpiCard label="GMV total" value={fmt.usd(kpis.gmv)} color="emerald"/>
      </div>
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span className="font-semibold">Error:</span> {error}</div>}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Ico.search/></span>
            <input type="text" placeholder="Buscar cupón o país…" value={search} onChange={e=>setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
          </div>
          {search && <button onClick={()=>setSearch('')} className="text-xs text-gray-400 hover:text-gray-600">Limpiar</button>}
          <button onClick={fetchData} disabled={loading} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            <Ico.refresh spin={loading}/>{loading?'Cargando…':'Actualizar'}
          </button>
          <span className="text-xs text-gray-400">{filtered.length} resultados</span>
        </div>
        {loading && rows.length===0 && <Skeleton/>}
        {!loading && filtered.length===0 && <EmptyState/>}
        {filtered.length>0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {PROMO_COLS.map((c,i)=>(
                    <th key={i} onClick={()=>toggleSort(c.key)} className={`px-3 py-3 font-semibold text-gray-600 whitespace-nowrap text-${c.align} ${c.key?'cursor-pointer hover:bg-gray-100 select-none transition':''}`}>
                      {c.label}{c.key&&<Ico.sort dir={sort.key===c.key?sort.dir:null}/>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((r,i)=><CouponRow key={`${r.coupon_code}-${r.country}-${i}`} row={r} dateFrom={dateFrom} dateTo={dateTo} country={country}/>)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 2: PRODUCT TIER LIST
// ═══════════════════════════════════════════════════════════════
const TIER_MEDALS = ['🥇','🥈','🥉']
const TIER_COLORS = [
  'border-l-yellow-400 bg-yellow-50/50',
  'border-l-slate-400 bg-slate-50/50',
  'border-l-amber-600/70 bg-amber-50/30',
]

function ProductTierList({ country, dateFrom, dateTo, onLoaded }) {
  const [products,setProducts]=useState([]); const [loading,setLoading]=useState(false); const [error,setError]=useState(null)
  const [filters,setFilters]=useState({manufacturers:[],product_types:[],use_durations:[]}); const [filtersLoaded,setFiltersLoaded]=useState(false)
  const [selMfr,setSelMfr]=useState(''); const [selType,setSelType]=useState(''); const [selDur,setSelDur]=useState('')
  const [search,setSearch]=useState(''); const [sort,setSort]=useState({key:'total_quantity',dir:'desc'})

  const loadFilters = useCallback(async()=>{
    try {
      const p=new URLSearchParams({mode:'tier_filters'}); if(dateFrom)p.set('date_from',dateFrom); if(dateTo)p.set('date_to',dateTo); if(country)p.set('country',country)
      const res=await apiRequest(`/promo?${p}`)
      if(res.status==='ok'){ setFilters({manufacturers:res.manufacturers||[],product_types:res.product_types||[],use_durations:res.use_durations||[]}); setFiltersLoaded(true) }
    } catch(e){}
  },[country,dateFrom,dateTo])

  const fetchData = useCallback(async()=>{
    setLoading(true); setError(null)
    try {
      const p=new URLSearchParams({mode:'product_tier'}); if(dateFrom)p.set('date_from',dateFrom); if(dateTo)p.set('date_to',dateTo); if(country)p.set('country',country)
      if(selMfr) p.set('manufacturer',selMfr); if(selType) p.set('product_type',selType); if(selDur) p.set('use_duration',selDur)
      const res=await apiRequest(`/promo?${p}`)
      if(res.status!=='ok') throw new Error(res.message); setProducts(res.data||[])
    } catch(e){ setError(e.message) } finally{ setLoading(false); onLoaded?.() }
  },[country,dateFrom,dateTo,selMfr,selType,selDur])

  useEffect(()=>{ loadFilters() },[loadFilters])
  useEffect(()=>{ fetchData() },[fetchData])

  const filtered=useMemo(()=>{
    const q=search.toLowerCase(); let arr=q?products.filter(p=>p.name.toLowerCase().includes(q)||p.manufacturer.toLowerCase().includes(q)):products
    return [...arr].sort((a,b)=>{ const av=a[sort.key]??0,bv=b[sort.key]??0; return sort.dir==='asc'?av-bv:bv-av })
  },[products,sort,search])

  const kpis=useMemo(()=>({
    total: filtered.reduce((s,p)=>s+p.total_quantity,0),
    gmv:   filtered.reduce((s,p)=>s+p.total_gmv_usd,0),
    skus:  new Set(filtered.map(p=>p.sku)).size,
    top:   filtered[0]?.name || '—'
  }),[filtered])

  const Select = ({val,onChange,opts,placeholder}) => (
    <select value={val} onChange={e=>onChange(e.target.value)}
      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-gray-700">
      <option value="">{placeholder}</option>
      {opts.map(o=><option key={o} value={o}>{o}</option>)}
    </select>
  )

  const activeFilters = [selMfr&&`Fab: ${selMfr}`,selType&&`Tipo: ${selType}`,selDur&&`Dur: ${selDur}`].filter(Boolean)

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Productos únicos" value={filtered.length} color="violet"/>
        <KpiCard label="SKUs distintos" value={kpis.skus} color="blue"/>
        <KpiCard label="Unidades vendidas" value={fmt.num(kpis.total)} color="amber"/>
        <KpiCard label="GMV total" value={fmt.usd(kpis.gmv)} color="emerald"/>
      </div>
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span className="font-semibold">Error:</span> {error}</div>}

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
        <span className="flex items-center gap-1 text-xs font-semibold text-gray-500"><Ico.filter/>Filtros:</span>
        <Select val={selMfr} onChange={setSelMfr} opts={filters.manufacturers} placeholder="Fabricante"/>
        <Select val={selType} onChange={setSelType} opts={filters.product_types} placeholder="Tipo"/>
        <Select val={selDur} onChange={setSelDur} opts={filters.use_durations} placeholder="Duración"/>
        {activeFilters.length>0 && (
          <button onClick={()=>{setSelMfr('');setSelType('');setSelDur('')}} className="ml-2 text-xs text-blue-600 hover:text-blue-800 font-medium">
            Limpiar filtros ({activeFilters.length})
          </button>
        )}
        <div className="relative ml-auto">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"><Ico.search/></span>
          <input type="text" placeholder="Buscar producto…" value={search} onChange={e=>setSearch(e.target.value)}
            className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-44"/>
        </div>
        <button onClick={fetchData} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-50">
          <Ico.refresh spin={loading}/>{loading?'…':'Aplicar'}
        </button>
      </div>

      {/* Sort tabs */}
      <div className="flex gap-2 mb-4">
        {[{key:'total_quantity',label:'Por unidades'},{key:'order_count',label:'Por órdenes'},{key:'total_gmv_usd',label:'Por GMV'}].map(s=>(
          <button key={s.key} onClick={()=>setSort({key:s.key,dir:'desc'})}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${sort.key===s.key?'bg-black text-white':'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400 self-center">{filtered.length} productos</span>
      </div>

      {loading && <Skeleton rows={8}/>}
      {!loading && filtered.length===0 && <EmptyState/>}
      {filtered.length>0 && (
        <div className="space-y-2">
          {filtered.map((p,i)=>{
            const maxVal = filtered[0][sort.key] || 1
            const barPct = Math.round((p[sort.key]/maxVal)*100)
            return (
              <div key={`${p.sku}-${i}`} className={`relative flex items-center gap-4 px-4 py-3 rounded-xl border border-l-4 bg-white hover:shadow-sm transition ${i<3?TIER_COLORS[i]:'border-l-gray-200'}`}>
                {/* Rank */}
                <div className="flex-shrink-0 w-8 text-center">
                  {i<3 ? <span className="text-xl">{TIER_MEDALS[i]}</span>
                        : <span className="text-sm font-black text-gray-400">#{i+1}</span>}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm leading-snug truncate" title={p.name}>{p.name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {p.manufacturer && <span className="text-xs text-gray-500">{p.manufacturer}</span>}
                    {p.product_type && <span className="text-xs text-gray-400">{p.product_type}</span>}
                    {p.use_duration && <span className="text-xs text-blue-500 font-medium">{p.use_duration}</span>}
                    {p.sku && <span className="text-xs font-mono text-gray-400">SKU: {p.sku}</span>}
                  </div>
                  {/* Bar */}
                  <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden w-full max-w-xs">
                    <div className={`h-full rounded-full ${i===0?'bg-yellow-400':i===1?'bg-slate-400':i===2?'bg-amber-600':'bg-blue-400'}`} style={{width:`${barPct}%`}}/>
                  </div>
                </div>
                {/* Metrics */}
                <div className="flex-shrink-0 flex gap-5 text-right">
                  <div><p className="text-lg font-black text-gray-900 tabular-nums leading-none">{fmt.num(p.total_quantity)}</p><p className="text-xs text-gray-400">unidades</p></div>
                  <div><p className="text-sm font-bold text-emerald-700 tabular-nums leading-none">{fmt.num(p.order_count)}</p><p className="text-xs text-gray-400">órdenes</p></div>
                  <div><p className="text-sm font-bold text-gray-700 tabular-nums leading-none">{fmt.usd(p.total_gmv_usd)}</p><p className="text-xs text-gray-400">GMV</p></div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// TAB 3: PROMO ANALYSIS (estadístico, sin API externa)
// ═══════════════════════════════════════════════════════════════

// ─── Compute insights from raw coupon data ──────────────────
function computeAnalysis(rows) {
  if (!rows || rows.length === 0) return null

  // ── field names from mode=performance: gmv_usd, total_orders, completed_orders,
  //    canceled_orders, conversion_rate, avg_order_value, coupon_code, country
  const totalGMV      = rows.reduce((s, r) => s + (r.gmv_usd          || 0), 0)
  const totalOrders   = rows.reduce((s, r) => s + (r.total_orders      || 0), 0)
  const totalCompleted= rows.reduce((s, r) => s + (r.completed_orders  || 0), 0)
  const totalCanceled = rows.reduce((s, r) => s + (r.canceled_orders   || 0), 0)
  const convRates     = rows.map(r => r.conversion_rate || 0)
  const avgConv       = convRates.length ? convRates.reduce((a,b) => a+b, 0) / convRates.length : 0
  const cancelRate    = totalOrders > 0 ? (totalCanceled / totalOrders * 100) : 0
  const avgTicket     = totalCompleted > 0 ? totalGMV / totalCompleted : 0
  const avgOV         = rows.reduce((s, r) => s + (r.avg_order_value || 0), 0) / (rows.length || 1)

  // Top performers: sort by GMV, conversion, orders
  const byGMV  = [...rows].sort((a,b) => (b.gmv_usd||0)          - (a.gmv_usd||0))
  const byConv = [...rows].sort((a,b) => (b.conversion_rate||0)   - (a.conversion_rate||0))
  const byOrds = [...rows].sort((a,b) => (b.total_orders||0)      - (a.total_orders||0))
  const byTicket = [...rows].sort((a,b) => (b.avg_order_value||0) - (a.avg_order_value||0))

  const top3GMV = byGMV.slice(0, 8)
  const top1    = byGMV[0]

  // Concentration: % of GMV from top 20% of coupons
  const top20pct = Math.max(1, Math.ceil(rows.length * 0.2))
  const top20GMV = byGMV.slice(0, top20pct).reduce((s,r) => s+(r.gmv_usd||0), 0)
  const concentration = totalGMV > 0 ? (top20GMV / totalGMV * 100) : 0

  // Concentration of orders
  const top20Ords = byOrds.slice(0, top20pct).reduce((s,r) => s+(r.total_orders||0), 0)
  const ordConcentration = totalOrders > 0 ? (top20Ords / totalOrders * 100) : 0

  // Underperformers: traffic but low conversion
  const avgOrds = totalOrders / (rows.length || 1)
  const underperformers = rows
    .filter(r => (r.total_orders||0) > avgOrds * 0.5 && (r.conversion_rate||0) < avgConv * 0.6)
    .sort((a,b) => (b.total_orders||0)-(a.total_orders||0))
    .slice(0, 4)

  // Stars: high GMV + high conversion
  const stars = rows
    .filter(r => (r.gmv_usd||0) > totalGMV/rows.length && (r.conversion_rate||0) >= avgConv)
    .sort((a,b) => (b.gmv_usd||0)-(a.gmv_usd||0))
    .slice(0, 5)

  // Zombies: coupons with 0 completed orders
  const zombies = rows.filter(r => (r.completed_orders||0) === 0 && (r.total_orders||0) > 0)

  // High ticket but low volume (potential upside)
  const avgGMV = totalGMV / (rows.length || 1)
  const highTicketLowVol = rows
    .filter(r => (r.avg_order_value||0) > avgOV * 1.3 && (r.total_orders||0) < avgOrds * 0.5)
    .sort((a,b) => (b.avg_order_value||0)-(a.avg_order_value||0))
    .slice(0, 3)

  // ─── Insights (rules-based, 10+ coverage) ──────────────────
  const insights = []

  // 1. GMV concentration
  if (concentration >= 70) {
    insights.push({ type:'neutral', title:'Alta concentración de GMV', description:`El top ${top20pct} cupón${top20pct>1?'es':''} genera el ${concentration.toFixed(0)}% del GMV total. Alta dependencia de pocos cupones — diversificar reduce riesgo.` })
  } else if (concentration < 50) {
    insights.push({ type:'positive', title:'GMV bien distribuido entre cupones', description:`Ningún grupo pequeño domina: el top ${top20pct} cupón${top20pct>1?'es':''} solo representa el ${concentration.toFixed(0)}% del GMV. La cartera es resiliente.` })
  } else {
    insights.push({ type:'neutral', title:'Distribución moderada de GMV', description:`El top ${top20pct} cupón${top20pct>1?'es':''} genera el ${concentration.toFixed(0)}% del GMV. Hay cierta concentración, pero dentro de rangos manejables.` })
  }

  // 2. Líder del período
  if (top1) {
    const topShare = totalGMV > 0 ? (top1.gmv_usd / totalGMV * 100) : 0
    insights.push({ type:'positive', title:`"${top1.coupon_code}" lidera el período`, description:`Genera el ${topShare.toFixed(0)}% del GMV total ($${(top1.gmv_usd||0).toLocaleString('en-US',{maximumFractionDigits:0})} USD) con ${(top1.total_orders||0).toLocaleString()} órdenes y ${top1.conversion_rate?.toFixed(1)}% de conversión.` })
  }

  // 3. Tasa de conversión promedio
  if (avgConv < 35) {
    insights.push({ type:'negative', title:'Conversión promedio baja (<35%)', description:`Promedio de ${avgConv.toFixed(1)}% — menos de 1 de cada 3 órdenes con cupón termina completada. Revisar flujo de checkout, condiciones del cupón o segmentación.` })
  } else if (avgConv >= 70) {
    insights.push({ type:'positive', title:`Conversión excelente: ${avgConv.toFixed(1)}%`, description:`Más de ${avgConv.toFixed(0)}% de las órdenes con cupón se completan. Las promos están bien calibradas para la audiencia actual.` })
  } else if (avgConv >= 50) {
    insights.push({ type:'positive', title:`Buena conversión promedio: ${avgConv.toFixed(1)}%`, description:`Más de la mitad de las órdenes con cupón se concretan. El cupón líder "${byConv[0]?.coupon_code}" llega al ${byConv[0]?.conversion_rate?.toFixed(0)}% — hay benchmark a seguir.` })
  } else {
    insights.push({ type:'neutral', title:`Conversión promedio: ${avgConv.toFixed(1)}%`, description:`Hay margen de mejora. Los cupones top superan el ${byConv[0]?.conversion_rate?.toFixed(0)}% — analizar sus condiciones puede levantar el promedio general.` })
  }

  // 4. Tasa de cancelación
  if (cancelRate > 25) {
    insights.push({ type:'negative', title:`Alta tasa de cancelación: ${cancelRate.toFixed(0)}%`, description:`${totalCanceled.toLocaleString()} órdenes canceladas de ${totalOrders.toLocaleString()} totales. Puede indicar problemas en el checkout, stock insuficiente o expectativas no cumplidas en la promo.` })
  } else if (cancelRate < 10 && totalOrders > 10) {
    insights.push({ type:'positive', title:`Baja cancelación: ${cancelRate.toFixed(0)}%`, description:`Solo ${totalCanceled.toLocaleString()} cancelaciones de ${totalOrders.toLocaleString()} órdenes. Las condiciones de las promos son claras y el proceso de compra es fluido.` })
  } else if (cancelRate >= 10) {
    insights.push({ type:'neutral', title:`Cancelación moderada: ${cancelRate.toFixed(0)}%`, description:`${totalCanceled.toLocaleString()} cancelaciones en el período. Monitorear si sube — cupones con descuentos muy agresivos a veces atraen tráfico de baja intención.` })
  }

  // 5. Cupones sin completadas (zombies)
  if (zombies.length > 0) {
    insights.push({ type:'negative', title:`${zombies.length} cupón${zombies.length>1?'es':''} sin órdenes completadas`, description:`${zombies.map(z=>z.coupon_code).slice(0,4).join(', ')}${zombies.length>4?' y más...':''} — reciben tráfico pero no cierran ninguna venta. Evaluar suspensión o rediseño de condiciones.` })
  }

  // 6. Underperformers (tráfico sin conversión)
  if (underperformers.length > 0) {
    insights.push({ type:'negative', title:`${underperformers.length} cupón${underperformers.length>1?'es':''} con tráfico pero baja conversión`, description:`"${underperformers.map(u=>u.coupon_code).slice(0,3).join('", "')}" tienen volumen de órdenes pero conversión inferior al 60% del promedio. Revisar descuento mínimo, vigencia o restricciones.` })
  }

  // 7. Ticket promedio
  if (avgTicket > 0) {
    const topTicketCoupon = byTicket[0]
    if (topTicketCoupon && (topTicketCoupon.avg_order_value||0) > avgOV * 1.5) {
      insights.push({ type:'positive', title:`"${topTicketCoupon.coupon_code}" impulsa el ticket más alto`, description:`Ticket promedio de $${(topTicketCoupon.avg_order_value||0).toLocaleString('en-US',{maximumFractionDigits:0})} vs promedio general de $${avgOV.toLocaleString('en-US',{maximumFractionDigits:0})}. Ideal para segmentos premium o combos de alto valor.` })
    } else {
      insights.push({ type:'neutral', title:`Ticket promedio del período: $${avgOV.toLocaleString('en-US',{maximumFractionDigits:0})}`, description:`El cupón con mayor ticket es "${byTicket[0]?.coupon_code}" ($${(byTicket[0]?.avg_order_value||0).toLocaleString('en-US',{maximumFractionDigits:0})}). Promover cupones de ticket alto puede mejorar el GMV sin aumentar volumen de órdenes.` })
    }
  }

  // 8. GMV bajo por cupón (cola larga)
  if (rows.length >= 8) {
    const lowGMV = rows.filter(r => (r.gmv_usd||0) < totalGMV / rows.length * 0.25)
    if (lowGMV.length > 0) {
      insights.push({ type:'neutral', title:`${lowGMV.length} cupón${lowGMV.length>1?'es':''} con GMV marginal`, description:`Generan menos del 25% del GMV promedio por cupón. Evaluar si justifican el esfuerzo operativo o si pueden consolidarse en promos más amplias.` })
    }
  }

  // 9. High ticket, low volume — oportunidad
  if (highTicketLowVol.length > 0) {
    insights.push({ type:'positive', title:`${highTicketLowVol.length} cupón${highTicketLowVol.length>1?'es':''} de alto ticket con poco volumen — oportunidad`, description:`"${highTicketLowVol[0].coupon_code}" tiene ticket de $${(highTicketLowVol[0].avg_order_value||0).toLocaleString('en-US',{maximumFractionDigits:0})} pero pocas órdenes. Mayor difusión podría generar un salto de GMV significativo.` })
  }

  // 10. Mejor vs peor conversión (spread)
  if (byConv.length >= 3) {
    const topCV  = byConv[0]?.conversion_rate || 0
    const botCV  = byConv[byConv.length-1]?.conversion_rate || 0
    const spread = topCV - botCV
    if (spread > 50) {
      insights.push({ type:'neutral', title:`Brecha de conversión amplia: ${spread.toFixed(0)} puntos`, description:`"${byConv[0]?.coupon_code}" convierte al ${topCV.toFixed(0)}% mientras "${byConv[byConv.length-1]?.coupon_code}" solo llega al ${botCV.toFixed(0)}%. Analizar las diferencias puede subir el piso general.` })
    }
  }

  // 11. Concentración de órdenes
  if (ordConcentration >= 75 && rows.length >= 5) {
    insights.push({ type:'neutral', title:'Órdenes muy concentradas en pocos cupones', description:`El top ${top20pct} cupón${top20pct>1?'es':''} por volumen acapara el ${ordConcentration.toFixed(0)}% de las órdenes. Si estos cupones vencen o se pausan, el impacto en volumen sería inmediato.` })
  }

  // ─── Forecast ──────────────────────────────────────────────
  const forecastGMV    = Math.round(totalGMV * 1.05)
  const forecastOrders = Math.round(totalOrders * 1.05)

  // ─── Recommendations ───────────────────────────────────────
  const recommendations = []
  if (stars.length > 0) {
    recommendations.push({ action: `Potenciar cupones estrella: ${stars.slice(0,3).map(s=>s.coupon_code).join(', ')}`, priority: 'Alta', expected_impact: `Alto GMV y buena conversión. Mayor difusión puede escalar el volumen de órdenes directamente sin cambiar mecánicas.` })
  }
  if (underperformers.length > 0) {
    recommendations.push({ action: `Revisar condiciones: ${underperformers.slice(0,3).map(u=>u.coupon_code).join(', ')}`, priority: 'Media', expected_impact: `Conversión por debajo del promedio a pesar de tener tráfico. Ajustar descuento mínimo, vigencia o segmento podría mejorar el ratio significativamente.` })
  }
  if (zombies.length > 0) {
    recommendations.push({ action: `Suspender o rediseñar cupones sin ventas: ${zombies.slice(0,3).map(z=>z.coupon_code).join(', ')}`, priority: 'Alta', expected_impact: `Estas promos generan tráfico pero cero ingresos. Eliminarlas reduce ruido y permite concentrar esfuerzo de comunicación en las que sí convierten.` })
  }
  if (concentration >= 70) {
    recommendations.push({ action: 'Diversificar la cartera con nuevos cupones por segmento', priority: 'Media', expected_impact: `El GMV depende de pocos cupones. Crear variantes para otros fabricantes o tipos de producto reduce riesgo y expande cobertura.` })
  }
  if (highTicketLowVol.length > 0) {
    recommendations.push({ action: `Impulsar difusión de "${highTicketLowVol[0].coupon_code}"`, priority: 'Alta', expected_impact: `Alto ticket promedio con poco volumen actual. Más visibilidad puede multiplicar el GMV sin necesidad de nuevas promos.` })
  }
  if (cancelRate > 20) {
    recommendations.push({ action: 'Investigar causas de cancelación alta', priority: 'Media', expected_impact: `Una tasa de ${cancelRate.toFixed(0)}% de cancelación indica fricción post-cupón. Revisar stock, condiciones del cupón y flujo de pago podría recuperar entre un 10-20% de esas órdenes.` })
  }
  if (byConv.length > 1 && (byConv[0].conversion_rate||0) - (byConv[byConv.length-1].conversion_rate||0) > 40) {
    recommendations.push({ action: `Analizar mecánicas de "${byConv[0].coupon_code}" para replicar en los de menor conversión`, priority: 'Baja', expected_impact: `Brecha de +${((byConv[0].conversion_rate||0)-(byConv[byConv.length-1].conversion_rate||0)).toFixed(0)} puntos en conversión. Copiar lo que funciona es la palanca más rápida para subir el promedio.` })
  }

  return {
    kpis: { totalGMV, totalOrders, avgConv, avgTicket, cancelRate, totalCoupons: rows.length, completedCount: totalCompleted },
    top3GMV, byConv: byConv.slice(0,8), byOrds: byOrds.slice(0,8),
    insights, recommendations,
    stars: stars.slice(0,5),
    underperformers,
    forecastGMV, forecastOrders,
    concentration,
  }
}

// ─── Mini bar chart ─────────────────────────────────────────
function MiniBar({ value, max, color='bg-[#0000E1]' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }}/>
      </div>
      <span className="text-[11px] text-gray-500 tabular-nums w-12 text-right flex-shrink-0">{pct}%</span>
    </div>
  )
}

// ─── Insight card ────────────────────────────────────────────
function InsightCard({ insight }) {
  const cfg = {
    positive: { bg:'bg-emerald-50 border-emerald-200', icon:'✅', txt:'text-emerald-800' },
    negative: { bg:'bg-red-50 border-red-200',         icon:'⚠️', txt:'text-red-800'     },
    neutral:  { bg:'bg-blue-50 border-blue-200',       icon:'💡', txt:'text-blue-800'    },
  }[insight.type] || { bg:'bg-gray-50 border-gray-200', icon:'📌', txt:'text-gray-800' }
  return (
    <div className={`rounded-xl border p-4 ${cfg.bg}`}>
      <div className="flex items-start gap-2">
        <span className="text-base leading-none mt-0.5">{cfg.icon}</span>
        <div>
          <p className={`font-semibold text-sm ${cfg.txt}`}>{insight.title}</p>
          <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{insight.description}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Recommendation card ─────────────────────────────────────
function RecommendationCard({ rec, index }) {
  const pri = { alta:'bg-red-100 text-red-700', media:'bg-amber-100 text-amber-700', baja:'bg-gray-100 text-gray-600' }[rec.priority?.toLowerCase()] || 'bg-gray-100 text-gray-600'
  return (
    <div className="flex gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:shadow-sm transition">
      <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0 text-xs font-black">{index+1}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <p className="font-semibold text-sm text-gray-900">{rec.action}</p>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pri}`}>{rec.priority}</span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">{rec.expected_impact}</p>
      </div>
    </div>
  )
}

// ─── Ranking table ───────────────────────────────────────────
function RankTable({ rows, valueKey, valueLabel, valueFormat, color }) {
  const max = Math.max(...rows.map(r => r[valueKey] || 0), 1)
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={r.coupon_code} className="flex items-center gap-3">
          <span className="text-sm w-5 text-center flex-shrink-0 font-bold text-gray-400">{i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}`}</span>
          <span className="text-xs font-bold text-gray-700 w-28 truncate flex-shrink-0">{r.coupon_code}</span>
          <MiniBar value={r[valueKey]||0} max={max} color={color}/>
          <span className="text-xs font-black text-gray-800 w-20 text-right flex-shrink-0 tabular-nums">{valueFormat(r[valueKey]||0)}</span>
        </div>
      ))}
    </div>
  )
}

function PromoAnalysis({ country, dateFrom, dateTo, onLoaded }) {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [rankTab, setRankTab] = useState('gmv')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const p = new URLSearchParams({ mode: 'performance' })
      if (dateFrom) p.set('date_from', dateFrom)
      if (dateTo)   p.set('date_to',   dateTo)
      if (country)  p.set('country',   country)
      const res = await apiRequest(`/promo?${p}`)
      setRows(res.data || [])
    } catch(e) { setError(e.message) }
    finally    { setLoading(false); onLoaded?.() }
  }, [country, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const analysis = useMemo(() => computeAnalysis(rows), [rows])

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-10 h-10 rounded-full border-4 border-[#0000E1]/20 border-t-[#0000E1] animate-spin"/>
      <p className="text-sm text-gray-500">Calculando análisis estadístico…</p>
    </div>
  )

  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-5 text-center">
      <p className="font-semibold text-red-700 text-sm mb-1">Error al cargar datos</p>
      <p className="text-xs text-red-500 mb-3">{error}</p>
      <button onClick={load} className="px-4 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700">Reintentar</button>
    </div>
  )

  if (!analysis) return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
      <div className="text-4xl mb-2">📊</div>
      <p className="text-sm font-semibold text-gray-600">Sin datos para el período seleccionado</p>
      <p className="text-xs text-gray-400">Ajusta el rango de fechas o el filtro de país</p>
    </div>
  )

  const { kpis, top3GMV, byConv, byOrds, insights, recommendations, stars, underperformers, forecastGMV, forecastOrders, concentration } = analysis

  const RANK_TABS = [
    { id:'gmv',  label:'Por GMV',      rows:top3GMV,            key:'gmv_usd',     fmt:v=>`$${Number(v).toLocaleString('en-US',{maximumFractionDigits:0})}`,  color:'bg-[#0000E1]' },
    { id:'conv', label:'Por Conv.',    rows:byConv,             key:'conversion_rate',   fmt:v=>`${Number(v).toFixed(1)}%`,                                          color:'bg-emerald-500' },
    { id:'ords', label:'Por Órdenes',  rows:byOrds,             key:'total_orders',       fmt:v=>Number(v).toLocaleString(),                                          color:'bg-violet-500' },
  ]
  const activeRank = RANK_TABS.find(t => t.id === rankTab)

  return (
    <div className="space-y-6">

      {/* Header + refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-black text-gray-900 text-base">Análisis estadístico del período</h2>
          <p className="text-xs text-gray-400 mt-0.5">Calculado en tiempo real desde {kpis.totalCoupons} cupones · sin APIs externas</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
          <Ico.refresh spin={loading}/>Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="GMV Total"      value={fmt.usd(kpis.totalGMV)}     color="blue"   />
        <KpiCard label="Órdenes totales" value={fmt.num(kpis.totalOrders)}  color="emerald"/>
        <KpiCard label="Conv. promedio"  value={fmt.pct(kpis.avgConv)}      color="amber"  />
        <KpiCard label="Cupones activos" value={fmt.num(kpis.totalCoupons)} color="violet" />
        <KpiCard label="Cancelaciones"   value={`${(kpis.cancelRate||0).toFixed(1)}%`} sub={`${(kpis.totalOrders||0).toLocaleString()} órdenes totales`} color="amber"  />
        <KpiCard label="Concentración GMV" value={`${concentration.toFixed(0)}%`} sub="top 20% de cupones" color="blue"/>
      </div>

      {/* Rankings + Insights side by side */}
      <div className="grid lg:grid-cols-2 gap-5">

        {/* Ranking */}
        <div className="card p-5">
          <h3 className="font-black text-gray-900 mb-3 text-sm flex items-center gap-2">
            <Ico.award/>Ranking de cupones
          </h3>
          <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-0.5 w-fit">
            {RANK_TABS.map(t => (
              <button key={t.id} onClick={() => setRankTab(t.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all
                  ${rankTab===t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>
          {activeRank && <RankTable rows={activeRank.rows} valueKey={activeRank.key} valueLabel={activeRank.label} valueFormat={activeRank.fmt} color={activeRank.color}/>}
        </div>

        {/* Insights */}
        <div className="flex flex-col min-h-0">
          <h3 className="font-black text-gray-900 text-sm flex items-center gap-2 mb-3">
            <Ico.spark/>Insights automáticos
            {insights.length > 0 && (
              <span className="ml-auto text-[11px] font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                {insights.length}
              </span>
            )}
          </h3>
          <div className="overflow-y-auto max-h-[480px] space-y-2.5 pr-1 scrollbar-thin">
            {insights.length > 0
              ? insights.map((ins, i) => <InsightCard key={i} insight={ins}/>)
              : <p className="text-xs text-gray-400">Sin insights generados para este período.</p>
            }
          </div>
        </div>
      </div>

      {/* Forecast */}
      <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5">
        <h3 className="font-black text-blue-900 mb-3 text-sm flex items-center gap-2"><Ico.trending/>Proyección conservadora (+5%)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          <div>
            <p className="text-2xl font-black text-blue-800 tabular-nums">{fmt.usd(forecastGMV)}</p>
            <p className="text-xs text-blue-600 mt-0.5">GMV estimado próximo período</p>
          </div>
          <div>
            <p className="text-2xl font-black text-blue-800 tabular-nums">{fmt.num(forecastOrders)}</p>
            <p className="text-xs text-blue-600 mt-0.5">Órdenes estimadas próximo período</p>
          </div>
          <div>
            <p className="text-sm font-bold text-blue-700 leading-relaxed">Basado en el desempeño actual del período con un margen de crecimiento conservador del 5%.</p>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h3 className="font-black text-gray-900 mb-3 text-sm">🎯 Recomendaciones accionables</h3>
          <div className="space-y-2">
            {recommendations.map((r, i) => <RecommendationCard key={i} rec={r} index={i}/>)}
          </div>
        </div>
      )}

      {/* Stars + Underperformers */}
      <div className="grid md:grid-cols-2 gap-4">
        {stars.length > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <h4 className="font-bold text-emerald-800 mb-2 text-sm flex items-center gap-1.5"><Ico.award/>Cupones estrella ⭐</h4>
            <p className="text-[11px] text-emerald-700 mb-2">Alto GMV + conversión sobre el promedio</p>
            <div className="flex flex-wrap gap-1.5">
              {stars.map((s, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800 text-xs font-semibold">{s.coupon_code}</span>
              ))}
            </div>
          </div>
        )}
        {underperformers.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h4 className="font-bold text-amber-800 mb-2 text-sm">⚠️ Cupones a revisar</h4>
            <p className="text-[11px] text-amber-700 mb-2">Volumen de órdenes pero conversión baja</p>
            <div className="flex flex-wrap gap-1.5">
              {underperformers.map((u, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 text-xs font-semibold">{u.coupon_code}</span>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL CON TABS
// ═══════════════════════════════════════════════════════════════
const TABS = [
  { id:'review',   label:'Promo Review',     icon:'🏷️' },
  { id:'tier',     label:'Product Tier List', icon:'🏆' },
  { id:'analysis', label:'Promo Analysis',    icon:'📊' },
]

export default function PromoPerformance() {
  const { country, dateFrom, dateTo } = useFilters()
  const [activeTab, setActiveTab] = useState('review')
  const switchTab = t => { setActiveTab(t); setLoading(true) }
  const [loading, setLoading] = useState(true)
  const handleTabLoaded = () => setLoading(false)
  // Re-show loader whenever global filters (country / dates) change
  const filterInitRef = useRef(false)
  useEffect(() => {
    if (!filterInitRef.current) { filterInitRef.current = true; return }
    setLoading(true)
  }, [country, dateFrom, dateTo])

  return (
    <div className="p-6 max-w-[1300px] mx-auto">
      <PageLoader show={loading} />
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-black text-gray-900">Promo Performance</h1>
        <p className="text-sm text-gray-500 mt-0.5">Análisis completo de promociones · DWH Silver.sales</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>switchTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
              ${activeTab===t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab==='review'   && <PromoReview    country={country} dateFrom={dateFrom} dateTo={dateTo} onLoaded={handleTabLoaded}/>}
      {activeTab==='tier'     && <ProductTierList country={country} dateFrom={dateFrom} dateTo={dateTo} onLoaded={handleTabLoaded}/>}
      {activeTab==='analysis' && <PromoAnalysis  country={country} dateFrom={dateFrom} dateTo={dateTo} onLoaded={handleTabLoaded}/>}

      <p className="text-xs text-gray-400 mt-4 text-right">Fuente: DWH · Silver.sales + Silver.sales_products · empresa = lentesplus</p>
    </div>
  )
}
