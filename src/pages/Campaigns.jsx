/**
 * 📄 /src/pages/Campaigns.jsx
 * Agente 1 — Frontend (Skill B)
 * Página modular de Email Marketing: BestSeller · Fabricantes · Gafas
 * Selección de productos, filtros por tipo/marca, email copy generado
 * Design System: LIVO
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { apiRequest } from '@utils/api'
import { useFilters } from '@context/FiltersContext'

// ─── Icons ────────────────────────────────────────────────────
const IconRefresh = ({ spin }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={spin ? 'animate-spin' : ''}>
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
)
const IconCopy = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)
const IconCheck = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const IconMail = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
)
const IconStar = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
)
const IconAlert = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const IconImage = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
  </svg>
)
const IconTag = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
)

// ─── ProductThumb ─────────────────────────────────────────────
function ProductThumb({ url, name, size = 'md' }) {
  const [err, setErr] = useState(false)
  const cls = size === 'lg' ? 'w-16 h-16 rounded-xl' : 'w-10 h-10 rounded-lg'
  if (!url || err) return (
    <div className={`${cls} bg-gray-100 flex items-center justify-center flex-shrink-0`}>
      <IconImage />
    </div>
  )
  return <img src={url} alt={name} onError={() => setErr(true)}
    className={`${cls} object-cover flex-shrink-0 border border-gray-100`} />
}

// ─── CopyButton ───────────────────────────────────────────────
function CopyBtn({ text, label }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }
  return (
    <button onClick={copy}
      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold
                 bg-gray-100 hover:bg-[#0000E1] hover:text-white text-gray-500
                 transition-all duration-150 shrink-0">
      {copied ? <IconCheck size={11}/> : <IconCopy size={11}/>}
      {copied ? 'Copiado' : (label || 'Copiar')}
    </button>
  )
}

// ─── EmailCopyPanel ───────────────────────────────────────────
function EmailCopyPanel({ copy, title }) {
  if (!copy) return null
  const fields = [
    { key: 'asunto',    label: 'Asunto' },
    { key: 'asunto2',   label: 'Asunto 2' },
    { key: 'preheader', label: 'Preheader' },
    { key: 'body',      label: 'Body' },
    { key: 'boton',     label: 'Botón' },
  ]
  return (
    <div className="mt-4 rounded-xl border border-[#0000E1]/20 bg-blue-50/40 overflow-hidden">
      <div className="px-4 py-2.5 bg-[#0000E1]/5 border-b border-[#0000E1]/10 flex items-center gap-2">
        <IconMail size={14}/>
        <span className="text-xs font-bold text-[#0000E1]">{title || 'Email Copy Generado'}</span>
      </div>
      <div className="divide-y divide-[#0000E1]/10">
        {fields.map(({ key, label }) => (
          copy[key] ? (
            <div key={key} className="px-4 py-2.5 flex items-start gap-3">
              <span className="text-[11px] font-bold text-gray-400 w-20 shrink-0 pt-0.5 uppercase tracking-wide">
                {label}
              </span>
              <p className="text-xs text-gray-700 flex-1 leading-relaxed whitespace-pre-line">
                {copy[key]}
              </p>
              <CopyBtn text={copy[key]} />
            </div>
          ) : null
        ))}
      </div>
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────
const TABS = [
  { id: 'bestseller',  label: 'BestSeller' },
  { id: 'fabricantes', label: 'Fabricantes' },
  { id: 'gafas',       label: 'Gafas' },
]

// ─── BestSeller Section ───────────────────────────────────────
function BestSellerSection({ data, selectedIds, onToggle }) {
  if (!data) return null
  const { products, email_copy } = data
  const selCount = products.filter(p => selectedIds.has(p.sku)).length

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Los 6 mejores productos con promo activa de diferentes fabricantes.
        <span className="ml-1 text-[#0000E1] font-semibold">Johnson &amp; Johnson</span> siempre aparece primero.
      </p>

      {products.length === 0 ? (
        <EmptyState msg="No hay promos activas en este período." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {products.map(p => {
              const sel = selectedIds.has(p.sku)
              return (
                <div key={p.sku}
                  onClick={() => onToggle(p.sku)}
                  className={`card p-4 cursor-pointer transition-all duration-150 border-2
                    ${sel ? 'border-[#0000E1] bg-blue-50/40' : 'border-transparent hover:border-gray-200'}`}>
                  <div className="flex items-start gap-3">
                    {/* Checkbox visual */}
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all
                      ${sel ? 'bg-[#0000E1] border-[#0000E1]' : 'border-gray-300'}`}>
                      {sel && <IconCheck size={11}/>}
                    </div>
                    <ProductThumb url={p.url_image} name={p.product_name} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-800 leading-snug line-clamp-2">{p.product_name}</p>
                      <p className="text-[11px] text-gray-400 font-mono mt-1">{p.sku}</p>
                      <p className="text-xs font-semibold text-gray-500 mt-1 truncate">{p.fabricante}</p>
                      {p.product_type && (
                        <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-600 border border-purple-100">
                          {p.product_type}
                        </span>
                      )}
                    </div>
                  </div>
                  {p.promo_marca && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-start gap-1.5">
                      <span className="text-[#0000E1] mt-0.5 flex-shrink-0"><IconTag size={11}/></span>
                      <p className="text-[11px] text-[#0000E1] font-semibold leading-snug">{p.promo_marca}</p>
                      {p.total_desc_pct > 0 && (
                        <span className="ml-auto text-[11px] font-black bg-[#DEFF00] text-black px-1.5 py-0.5 rounded-full flex-shrink-0">
                          -{p.total_desc_pct}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {selCount > 0 && (
            <div className="mb-2 text-xs text-[#0000E1] font-semibold">
              {selCount} producto{selCount>1?'s':''} seleccionado{selCount>1?'s':''}
            </div>
          )}
          <EmailCopyPanel copy={email_copy} title="Email Copy — BestSeller" />
        </>
      )}
    </div>
  )
}

// ─── Fabricantes Section ──────────────────────────────────────
function FabricantesSection({ data, selectedGroupIds, onToggleGroup, brandFilter, onBrandFilter }) {
  if (!data) return null
  const { groups, brand_names } = data

  const visible = brandFilter
    ? groups.filter(g => g.fabricante === brandFilter)
    : groups

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Grupos de promos por fabricante, listos para email marketing segmentado.
      </p>

      {/* Brand filter */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        {['', ...(brand_names || [])].map(b => (
          <button key={b || '__all'}
            onClick={() => onBrandFilter(b)}
            className={`h-8 px-3 rounded-full text-xs font-semibold border transition-all duration-150
              ${brandFilter === b
                ? 'bg-[#0000E1] text-white border-[#0000E1]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#0000E1] hover:text-[#0000E1]'}`}>
            {b || 'Todos'}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState msg="No hay promos activas para este fabricante en el período." />
      ) : (
        <div className="space-y-4">
          {visible.map((group, i) => {
            const gid = `${group.fabricante}|${group.promo_marca}|${group.date_start}`
            const sel = selectedGroupIds.has(gid)
            const expiring = group.is_expiring_soon

            return (
              <div key={gid}
                className={`card overflow-hidden border-2 transition-all duration-150
                  ${sel ? 'border-[#0000E1]' : expiring ? 'border-amber-300' : 'border-transparent'}`}>

                {/* Card header clickable */}
                <div className={`px-5 py-4 flex items-start gap-3 cursor-pointer
                  ${expiring ? 'bg-amber-50/50' : 'bg-gray-50/50'}`}
                  onClick={() => onToggleGroup(gid)}>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all
                    ${sel ? 'bg-[#0000E1] border-[#0000E1]' : 'border-gray-300'}`}>
                    {sel && <IconCheck size={11}/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-black text-gray-900">{group.fabricante}</span>
                      {group.pais_nombre && <span className="badge-info text-[10px]">{group.pais_nombre}</span>}
                      {expiring && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                          <IconAlert size={11}/> Vence pronto
                        </span>
                      )}
                    </div>
                    <div className="flex items-start gap-1.5 mb-1.5">
                      <span className="text-[#0000E1] mt-0.5 flex-shrink-0"><IconTag size={12}/></span>
                      <p className="text-sm font-semibold text-[#0000E1] leading-snug">{group.promo_marca}</p>
                    </div>
                    <p className="text-xs text-gray-400">
                      {_fmt(group.date_start)} → {_fmt(group.date_end)}
                      {group.days_remaining !== null && (
                        <span className="ml-2">
                          {group.days_remaining >= 0
                            ? `· ${group.days_remaining} día${group.days_remaining!==1?'s':''} restante${group.days_remaining!==1?'s':''}`
                            : '· Vencida'}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-1 flex-shrink-0">
                    {group.products.length} SKU{group.products.length!==1?'s':''}
                  </span>
                </div>

                {/* Product list */}
                <div className="px-5 py-3 border-t border-gray-100">
                  <div className="flex flex-wrap gap-2">
                    {group.products.map(p => (
                      <div key={p.sku || p.product_name} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5 border border-gray-100">
                        <ProductThumb url={p.url_image} name={p.product_name} />
                        <div>
                          <p className="text-[11px] font-bold text-gray-700 max-w-[120px] truncate">{p.product_name}</p>
                          {p.sku && <p className="text-[10px] text-gray-400 font-mono">{p.sku}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Email copy — siempre visible */}
                <div className="px-5 pb-4">
                  <EmailCopyPanel copy={group.email_copy} title={`Email Copy — ${group.fabricante}`} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Gafas Section ────────────────────────────────────────────
function GafasSection({ data, selectedGroupIds, onToggleGroup }) {
  if (!data) return null
  const { has_data, groups } = data

  if (!has_data) return (
    <div className="card flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4 text-2xl">👓</div>
      <h3 className="text-sm font-bold text-gray-600 mb-1">Sin promos de Gafas en este período</h3>
      <p className="text-xs text-gray-400 max-w-xs">
        Cuando el CSV incluya productos tipo Gafas con promociones activas, aparecerán aquí automáticamente.
      </p>
    </div>
  )

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Promos activas en productos de tipo <strong>Gafas</strong>, agrupadas por fabricante.
      </p>
      <div className="space-y-4">
        {groups.map(group => {
          const gid = `gafas|${group.fabricante}|${group.promo_marca}|${group.date_start}`
          const sel = selectedGroupIds.has(gid)
          return (
            <div key={gid}
              className={`card overflow-hidden border-2 transition-all duration-150
                ${sel ? 'border-[#0000E1]' : 'border-transparent'}`}>
              <div className="px-5 py-4 flex items-start gap-3 cursor-pointer bg-gray-50/50"
                onClick={() => onToggleGroup(gid)}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5
                  ${sel ? 'bg-[#0000E1] border-[#0000E1]' : 'border-gray-300'}`}>
                  {sel && <IconCheck size={11}/>}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-gray-900 mb-1">{group.fabricante}</p>
                  <div className="flex items-start gap-1.5">
                    <span className="text-[#0000E1] mt-0.5"><IconTag size={12}/></span>
                    <p className="text-sm font-semibold text-[#0000E1]">{group.promo_marca}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {_fmt(group.date_start)} → {_fmt(group.date_end)}
                  </p>
                </div>
                <span className="text-xs font-semibold text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-1">
                  {group.products.length} producto{group.products.length!==1?'s':''}
                </span>
              </div>

              {/* Product list */}
              <div className="px-5 py-3 border-t border-gray-100">
                <div className="flex flex-wrap gap-2">
                  {group.products.map(p => (
                    <div key={p.sku || p.product_name} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5 border border-gray-100">
                      <ProductThumb url={p.url_image} name={p.product_name} />
                      <div>
                        <p className="text-[11px] font-bold text-gray-700 max-w-[140px] truncate">{p.product_name}</p>
                        {p.sku && <p className="text-[10px] text-gray-400 font-mono">{p.sku}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Email copy — siempre visible */}
              <div className="px-5 pb-4">
                <EmailCopyPanel copy={group.email_copy} title={`Email Copy — Gafas · ${group.fabricante}`} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────
function EmptyState({ msg }) {
  return (
    <div className="card flex flex-col items-center justify-center py-14 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3 text-xl">📭</div>
      <p className="text-sm text-gray-500">{msg}</p>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({length: 6}).map((_,i) => (
        <div key={i} className="card p-4">
          <div className="flex gap-3">
            <div className="w-16 h-16 bg-gray-100 rounded-xl animate-pulse flex-shrink-0"/>
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4"/>
              <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2"/>
              <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3"/>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────
export default function Campaigns() {
  const { country, dateFrom, dateTo } = useFilters()

  const [activeTab,     setActiveTab]     = useState('bestseller')
  const [campaignData,  setCampaignData]  = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [typeFilter,    setTypeFilter]    = useState('')
  const [brandFilter,   setBrandFilter]   = useState('')
  const [selectedBs,    setSelectedBs]    = useState(new Set())   // sku
  const [selectedGroups,setSelectedGroups]= useState(new Set())   // group id

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({
        ...(country     ? { country              } : {}),
        ...(dateFrom    ? { date_from: dateFrom  } : {}),
        ...(dateTo      ? { date_to:   dateTo    } : {}),
        ...(typeFilter  ? { product_type: typeFilter } : {}),
      })
      const res = await apiRequest(`/campaigns?${params}`)
      setCampaignData(res)
    } catch (err) {
      setError(err.message || 'Error cargando campañas')
    } finally {
      setLoading(false)
    }
  }, [country, dateFrom, dateTo, typeFilter])

  useEffect(() => { fetchData() }, []) // eslint-disable-line

  const prevRef = useRef({ country, dateFrom, dateTo, typeFilter })
  useEffect(() => {
    const p = prevRef.current
    if (p.country!==country||p.dateFrom!==dateFrom||p.dateTo!==dateTo||p.typeFilter!==typeFilter) {
      prevRef.current = { country, dateFrom, dateTo, typeFilter }
      setSelectedBs(new Set()); setSelectedGroups(new Set())
      fetchData()
    }
  }, [country, dateFrom, dateTo, typeFilter, fetchData])

  const toggleBs    = sku => setSelectedBs(s => { const n=new Set(s); n.has(sku)?n.delete(sku):n.add(sku); return n })
  const toggleGroup = id  => setSelectedGroups(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n })

  const uniqueTypes = campaignData?.meta?.unique_types || []

  return (
    <div className="animate-fade-in">

      {/* ── Page header ──────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campañas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Estrategias de email marketing según las promos activas en el período.
            {campaignData?.meta && (
              <span className="ml-2 text-gray-400">
                {campaignData.meta.total_active} promos activas
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Type filter */}
          {uniqueTypes.length > 0 && (
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="h-9 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg
                         outline-none focus:border-[#0000E1] text-gray-600 cursor-pointer">
              <option value="">Todos los tipos</option>
              {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold
                       border-[1.5px] border-blue-600 text-blue-600
                       hover:bg-blue-50 disabled:opacity-50 transition-all">
            <IconRefresh spin={loading}/>
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          ⚠️ {error} <button onClick={fetchData} className="ml-3 underline">Reintentar</button>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────── */}
      <div className="flex gap-1 mb-6 bg-gray-100/70 rounded-xl p-1 w-fit">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150
              ${activeTab === tab.id
                ? 'bg-white text-[#0000E1] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'}`}>
            {tab.label}
            {tab.id === 'gafas' && campaignData?.gafas?.has_data && (
              <span className="ml-1.5 w-1.5 h-1.5 bg-[#0000E1] rounded-full inline-block"/>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ──────────────────────────────── */}
      {loading ? (
        <Skeleton />
      ) : (
        <>
          {activeTab === 'bestseller' && (
            <BestSellerSection
              data={campaignData?.bestseller}
              selectedIds={selectedBs}
              onToggle={toggleBs}
            />
          )}
          {activeTab === 'fabricantes' && (
            <FabricantesSection
              data={campaignData?.fabricantes}
              selectedGroupIds={selectedGroups}
              onToggleGroup={toggleGroup}
              brandFilter={brandFilter}
              onBrandFilter={setBrandFilter}
            />
          )}
          {activeTab === 'gafas' && (
            <GafasSection
              data={campaignData?.gafas}
              selectedGroupIds={selectedGroups}
              onToggleGroup={toggleGroup}
            />
          )}
        </>
      )}

      {/* ── Floating selection bar ────────────────────── */}
      {(selectedBs.size + selectedGroups.size) > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                         bg-[#0000E1] text-white rounded-full px-6 py-3
                         flex items-center gap-4 shadow-xl shadow-blue-900/30">
          <span className="text-sm font-bold">
            {selectedBs.size + selectedGroups.size} seleccionado{selectedBs.size+selectedGroups.size>1?'s':''}
          </span>
          <div className="w-px h-4 bg-white/30"/>
          <button
            onClick={() => { setSelectedBs(new Set()); setSelectedGroups(new Set()) }}
            className="text-sm font-semibold text-white/80 hover:text-white transition-colors">
            Limpiar
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Util ─────────────────────────────────────────────────────
function _fmt(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso+'T12:00:00').toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
  } catch { return iso }
}
