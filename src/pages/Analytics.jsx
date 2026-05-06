/**
 * 📄 /src/pages/Analytics.jsx
 * Auditoría de promociones — lista paginada + verificación por scraping
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import PageLoader from '../components/PageLoader'
import { apiRequest } from '@utils/api'
import { useFilters }  from '@context/FiltersContext'

// ─── Icons ─────────────────────────────────────────────────────────
const IconEdit    = ({ s=14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IconTrash   = ({ s=13 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const IconSave    = ({ s=13 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
const IconBug     = ({ s=15 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2l1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6z"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>
// ─── end extra icons
const IconSearch      = ({ s=14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const IconCheck       = ({ s=14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
const IconX           = ({ s=14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IconAlert       = ({ s=14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
const IconLoader      = ({ s=14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
const IconPlay        = ({ s=13 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
const IconExternal    = ({ s=11 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
const IconChevron     = ({ s=14, dir='left' }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points={dir==='left'?'15 18 9 12 15 6':'9 18 15 12 9 6'}/></svg>
const IconCheckSquare = ({ s=15 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
const IconSquare      = ({ s=15 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
const IconMinus       = ({ s=15 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
const IconZap         = ({ s=14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
const IconRefresh     = ({ s=13 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>

// ─── Helpers ────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  try {
    const [y,m,d] = iso.split('-')
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`
  } catch { return iso }
}

// ─── Error Boundary ─────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('[Analytics ErrorBoundary]', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <tr>
          <td colSpan={10} className="px-4 pb-3 pt-0">
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-bold text-red-700 mb-1">Error al mostrar el resultado</p>
              <p className="text-[11px] text-red-600 font-mono">
                {String(this.state.error?.message || this.state.error)}
              </p>
              <button
                className="mt-2 text-[11px] text-red-500 underline"
                onClick={() => this.setState({ hasError: false, error: null })}>
                Reintentar
              </button>
            </div>
          </td>
        </tr>
      )
    }
    return this.props.children
  }
}

// ─── Status badge ────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = (status || '').toLowerCase()
  if (s === 'activo')   return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Activo</span>
  if (s === 'inactivo') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">Inactivo</span>
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">{status || '—'}</span>
}

// ─── Days remaining pill ─────────────────────────────────────────────
function DaysPill({ days }) {
  if (days === null || days === undefined) return <span className="text-gray-400 text-xs">—</span>
  if (days < 0)   return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-400">Vencida</span>
  if (days === 0) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white">Hoy</span>
  if (days <= 3)  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white">{days}d</span>
  if (days <= 7)  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-black">{days}d</span>
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">{days}d</span>
}

// ─── Verification badge ──────────────────────────────────────────────
function VerifBadge({ state, onClick, tipoPrmo }) {
  // Cupón: no aplica scraping
  const isCupon = (() => {
    const t = (tipoPrmo || '').toLowerCase().trim()
    const CUPON_SET = new Set(['cupón','cupon','cupones','cupónes','código','codigo'])
    return CUPON_SET.has(t) || (t.startsWith('cup') && t.length <= 12)
  })()
  if (isCupon) return (
    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-[11px] font-semibold text-gray-400 whitespace-nowrap cursor-default"
          title="Los cupones requieren un código específico y no pueden verificarse automáticamente">
      — No aplica
    </span>
  )

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
  if (state.status === 'skipped') return (
    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-[11px] font-semibold text-gray-400 whitespace-nowrap"
          title={state.message}>
      — Omitido
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

// ─── Debug Panel (solo se muestra en warning/error) ──────────────────
function DebugPanel({ debug }) {
  const [open, setOpen] = useState(false)
  if (!debug) return null

  const screenshots = debug.screenshots       || {}
  const steps       = Array.isArray(debug.steps) ? debug.steps : []
  const pageUrl     = debug.page_url          || ''
  const cartRaw     = debug.cart_raw          || ''
  const allPrices   = debug.cart_all_prices   || []
  const selectorHit = debug.selector_hit      || ''
  const bodySnippet = debug.body_snippet      || debug.body_text || ''
  const errorMsg    = debug.error             || ''
  const legacyB64   = debug.screenshot_b64   || null

  const ssEntries = Object.entries(screenshots)
  const hasInfo   = steps.length > 0 || ssEntries.length > 0 || legacyB64 ||
                    allPrices.length > 0 || cartRaw || bodySnippet || pageUrl || errorMsg

  if (!hasInfo) return null

  return (
    <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden text-[11px]">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors font-semibold text-gray-600">
        <span>🔍 Debug paso a paso</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="p-3 space-y-3 bg-white">
          {steps.length > 0 && (
            <div>
              <p className="font-semibold text-gray-700 mb-1">Pasos de ejecución:</p>
              <ol className="space-y-0.5 pl-1">
                {steps.map((s, i) => (
                  <li key={i} className={`flex gap-2 items-start ${s.ok === false ? 'text-red-600' : 'text-gray-700'}`}>
                    <span className="font-bold w-4 flex-shrink-0">{s.n || i + 1}</span>
                    <span className="leading-snug">{s.msg}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {pageUrl && (
            <p className="text-gray-600">
              <span className="font-semibold">URL final: </span>
              <a href={pageUrl} target="_blank" rel="noopener noreferrer"
                className="text-[#0000E1] underline break-all">{pageUrl}</a>
            </p>
          )}
          {selectorHit && (
            <p className="text-gray-600">
              <span className="font-semibold">Selector precio: </span>
              <code className="bg-gray-100 px-1 rounded">{selectorHit}</code>
            </p>
          )}
          {allPrices.length > 0 && (
            <div>
              <p className="font-semibold text-gray-700 mb-1">Precios extraídos:</p>
              <div className="flex flex-wrap gap-2">
                {allPrices.map((p, i) => (
                  <span key={i} className="px-2 py-0.5 bg-gray-100 rounded font-mono">
                    {Number(p).toLocaleString()}
                  </span>
                ))}
              </div>
            </div>
          )}
          {errorMsg && <p className="text-red-600 font-semibold">Error: {errorMsg}</p>}
          {cartRaw && (
            <div>
              <p className="font-semibold text-gray-700 mb-1">Resumen del carrito:</p>
              <pre className="bg-gray-100 rounded p-2 whitespace-pre-wrap max-h-28 overflow-y-auto text-[10px]">{cartRaw}</pre>
            </div>
          )}
          {bodySnippet && !cartRaw && (
            <div>
              <p className="font-semibold text-gray-700 mb-1">Texto de la página:</p>
              <pre className="bg-gray-100 rounded p-2 whitespace-pre-wrap max-h-28 overflow-y-auto text-[10px]">{bodySnippet}</pre>
            </div>
          )}
          {ssEntries.length > 0 && (
            <div>
              <p className="font-semibold text-gray-700 mb-2">Screenshots ({ssEntries.length}):</p>
              <div className="space-y-2">
                {ssEntries.map(([label, b64]) => (
                  <div key={label}>
                    <p className="text-gray-500 mb-1 font-mono">{label}</p>
                    <img src={`data:image/png;base64,${b64}`} alt={label}
                      className="max-w-full rounded border border-gray-200 cursor-pointer"
                      onClick={() => window.open(`data:image/png;base64,${b64}`, '_blank')}
                      title="Click para abrir en nueva pestaña" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {legacyB64 && ssEntries.length === 0 && (
            <div>
              <p className="font-semibold text-gray-700 mb-1">Screenshot:</p>
              <img src={`data:image/png;base64,${legacyB64}`} alt="debug"
                className="max-w-full rounded border border-gray-200" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Result Panel ────────────────────────────────────────────────────
function ResultPanel({ state, onClose }) {
  if (!state || state.loading) return null

  const isOk = state.status === 'ok'

  const colors = {
    ok:      'bg-emerald-50 border-emerald-200',
    warning: 'bg-amber-50 border-amber-200',
    error:   'bg-red-50 border-red-200',
    pending: 'bg-gray-50 border-gray-200',
  }
  const textColors = {
    ok:      'text-emerald-800',
    warning: 'text-amber-800',
    error:   'text-red-800',
    pending: 'text-gray-600',
  }

  const cls  = colors[state.status]    || colors.pending
  const tcls = textColors[state.status] || textColors.pending
  const det  = state.details || {}

  return (
    <tr>
      <td colSpan={10} className="px-4 pb-3 pt-0">
        <div className={`rounded-xl border p-3 ${cls}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold ${tcls} mb-1`}>{state.message}</p>

              {/* Precio tachado details */}
              {(state.tipo === 'precio_tachado' || state.tipo === 'Precio tachado') &&
               (det.price_full || det.price_final) && (
                <div className="flex flex-wrap gap-4 text-[11px] text-gray-600 mt-1">
                  {det.price_full  && <span>Precio full: <strong className="line-through">{Number(det.price_full).toLocaleString()}</strong></span>}
                  {det.price_final && <span>Precio final: <strong>{Number(det.price_final).toLocaleString()}</strong></span>}
                  {det.discount_real != null && <span>Descuento real: <strong>{det.discount_real}%</strong></span>}
                  {det.discount_csv  != null && <span>Descuento CSV: <strong>{det.discount_csv}%</strong></span>}
                  {det.diff_pp       != null && <span>Diferencia: <strong>{det.diff_pp} pp</strong></span>}
                </div>
              )}

              {/* Tier Price details */}
              {(state.tipo === 'tier_price' || state.tipo === 'Tier Price') && (
                <div className="mt-1 space-y-1.5">
                  <div className="flex flex-wrap gap-3 text-[11px] text-gray-500">
                    {det.fields_filled && Object.keys(det.fields_filled).length > 0 && (
                      <span>Campos: {Object.entries(det.fields_filled).map(([k,v]) => `${k}: ${v}`).join(' | ')}</span>
                    )}
                    {det.qty && <span>Cajas: <strong>{det.qty}</strong></span>}
                    {det.cart_url && (
                      <a href={det.cart_url} target="_blank" rel="noopener noreferrer"
                        className="text-[#0000E1] underline">Ver carrito ↗</a>
                    )}
                  </div>

                  {det.subtotal && (
                    <div className="bg-white/70 rounded-lg border border-gray-200 px-3 py-2 text-[11px] inline-flex flex-col gap-1 min-w-[260px] mt-1">
                      <div className="flex justify-between gap-8">
                        <span className="text-gray-500">Precio del ítem (subtotal)</span>
                        <span className="font-semibold text-gray-700 tabular-nums">
                          {Number(det.subtotal).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between gap-8 text-blue-700">
                        <span>Descuento CSV ({det.discount_csv}%)</span>
                        <span className="font-semibold tabular-nums">
                          −{det.expected_disc_amt != null
                              ? Number(det.expected_disc_amt).toLocaleString()
                              : Number(det.subtotal * det.discount_csv / 100).toLocaleString()}
                        </span>
                      </div>
                      <div className="border-t border-gray-200 mt-0.5 pt-0.5"/>
                      <div className="flex justify-between gap-8">
                        <span className="text-gray-500">Total esperado</span>
                        <span className="font-semibold tabular-nums text-gray-700">
                          {det.expected_total != null
                            ? Number(det.expected_total).toLocaleString()
                            : Number(det.subtotal * (1 - det.discount_csv / 100)).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between gap-8">
                        <span className="text-gray-500">Total real (resumen carrito)</span>
                        <span className={`font-bold tabular-nums ${
                          det.diff_pp != null && det.diff_pp <= 2
                            ? 'text-emerald-700' : 'text-red-600'
                        }`}>
                          {det.total != null ? Number(det.total).toLocaleString() : '—'}
                        </span>
                      </div>
                      {det.diff_pp != null && (
                        <div className={`flex justify-between gap-8 text-[10px] pt-0.5 ${
                          det.diff_pp <= 2 ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          <span>Diferencia</span>
                          <span className="font-semibold tabular-nums">
                            {det.diff_pp <= 2
                              ? '✓ Dentro del rango'
                              : `${Number(det.diff_abs ?? 0).toLocaleString()} (${det.diff_pp} pp)`}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Obsequios: lista de ítems del carrito */}
              {(state.tipo === 'Obsequios' || state.tipo === 'obsequios') &&
               Array.isArray(det.cart_items) && det.cart_items.length > 0 && (
                <div className="mt-2">
                  <p className="text-[11px] font-semibold text-gray-600 mb-1.5">
                    Productos en carrito ({det.cart_items.length}):
                  </p>
                  <div className="space-y-1.5">
                    {det.cart_items.map((item, idx) => {
                      const isGift = det.gift_items?.some(g => g.name === item.name)
                      return (
                        <div key={idx}
                          className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-[11px]
                            ${isGift ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-100'}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            {isGift
                              ? <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-bold text-[10px] flex-shrink-0">OBSEQUIO</span>
                              : <span className="px-1.5 py-0.5 rounded-md bg-gray-200 text-gray-600 font-semibold text-[10px] flex-shrink-0">#{idx + 1}</span>
                            }
                            <span className={`truncate ${isGift ? 'font-bold text-emerald-800' : 'text-gray-700'}`}>
                              {item.name || '—'}
                            </span>
                          </div>
                          <span className={`flex-shrink-0 font-mono font-semibold ${isGift ? 'text-emerald-600' : 'text-gray-500'}`}>
                            {item.price != null && item.price > 0
                              ? Number(item.price).toLocaleString()
                              : item.price === 0 ? 'Gratis' : '—'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Steps + Debug solo cuando NO es OK */}
              {!isOk && Array.isArray(det.steps) && det.steps.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {det.steps.map((s, i) => (
                    <p key={i} className={`text-[10px] ${s.ok === false ? 'text-red-500' : 'text-gray-500'}`}>
                      {s.msg}
                    </p>
                  ))}
                </div>
              )}

              {state.elapsed_ms && (
                <p className="text-[10px] text-gray-400 mt-1">{state.elapsed_ms}ms</p>
              )}

              {/* Debug panel solo en warning/error */}
              {!isOk && det.debug && <DebugPanel debug={det.debug} />}
            </div>

            <button onClick={onClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors mt-0.5">
              <IconX s={13} />
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ─── Product thumbnail ────────────────────────────────────────────────
function Thumb({ url, name }) {
  const [err, setErr] = useState(false)
  if (!url || err) return (
    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
      <span className="text-[8px] text-gray-400 text-center leading-tight px-0.5">{(name || '').slice(0,6)}</span>
    </div>
  )
  return (
    <img src={url} alt={name} onError={() => setErr(true)}
      className="w-9 h-9 rounded-lg object-contain bg-white border border-gray-100 flex-shrink-0" />
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────
function FilterBar({ meta, filters, onChange }) {
  const sel = (k, v) => onChange({ ...filters, [k]: v, page: 1 })

  return (
    <div className="flex items-center gap-2 flex-wrap">
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

      {Object.entries(filters).filter(([k,v]) => k !== 'page' && k !== 'limit' && v).length > 0 && (
        <button onClick={() => onChange({ page: 1, limit: filters.limit })}
          className="h-8 px-3 text-xs font-semibold text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
          Limpiar filtros
        </button>
      )}
    </div>
  )
}

// ─── Browserless Usage Bar ───────────────────────────────────────────
// Muestra consumo mensual de Browserless + simulación de costo en la vista actual.
// Solo visible para admins (el endpoint devuelve 403 para no-admins → se oculta).
function fmtMs(ms) {
  if (!ms || ms <= 0) return '0s'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}m ${ss < 10 ? '0' : ''}${ss}s`
}

function BrowserlessBar({ scrapableCount, verifStates, currentDataKeys,
                          bulkRunning, bulkProgress, scrapTimings,
                          verifOk, verifWarn, verifErr }) {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiRequest('/scraper_stats')
      setStats(res.stats || null)
    } catch {
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3 mb-4 flex items-center gap-2 text-xs text-gray-400">
      <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"/>
      Cargando consumo Browserless…
    </div>
  )
  if (!stats) return null   // no-admin o sin datos → no mostrar

  const monthKey   = new Date().toISOString().slice(0, 7)               // "2026-05"
  const monthData  = stats.monthly?.[monthKey] || { calls: 0, units_used: 0, history: [] }
  const plan       = stats.plan || { units_per_month: 1000, reset_day: 1 }
  const totalUnits = plan.units_per_month
  const usedUnits  = monthData.units_used || 0
  const usedCalls  = monthData.calls      || 0
  const pct        = Math.min(100, (usedUnits / totalUnits) * 100)

  // Avg unidades por scrap (de historial; si no hay datos, asumimos 1.5)
  const avgUnitsPerScrap = usedCalls > 0 ? (usedUnits / usedCalls) : 1.5

  // Scraps realizados en la sesión actual (solo los de la vista corriente y con engine browserless)
  let sessionUnits   = 0
  let sessionScraps  = 0
  let sessionLocal   = 0
  Object.entries(verifStates).forEach(([k, v]) => {
    if (!currentDataKeys.has(k) || v.loading) return
    const eng = (v.engine || '').toLowerCase()
    if (eng.includes('browserless')) {
      sessionScraps++
      sessionUnits += Math.max(1, Math.ceil((v.elapsed_ms || 30000) / 30000))
    } else if (eng.includes('local') || eng.includes('playwright')) {
      sessionLocal++
    }
  })

  // Pendientes en la vista actual
  const verifiedInView = Object.keys(verifStates).filter(k => currentDataKeys.has(k) && !verifStates[k].loading).length
  const pendingInView  = Math.max(0, scrapableCount - verifiedInView)
  const estPending     = Math.round(pendingInView * avgUnitsPerScrap)
  const remaining      = Math.max(0, totalUnits - usedUnits)

  // Color de la barra
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-[#0000E1]'

  // Mes en español
  const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const [yy, mm]  = monthKey.split('-')
  const monthLabel = `${monthNames[parseInt(mm) - 1]} ${yy}`

  // Próximo reset
  const now       = new Date()
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, plan.reset_day)
  const daysLeft  = Math.ceil((resetDate - now) / 86400000)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#0000E1]/10 flex items-center justify-center">
            <IconZap s={13} className="text-[#0000E1]" />
          </div>
          <span className="text-xs font-bold text-gray-700">Consumo Browserless</span>
          <span className="text-[10px] text-gray-400 capitalize">{monthLabel}</span>
          {pct >= 80 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
              {pct >= 90 ? '⚠ Cuota crítica' : '⚠ Cuota alta'}
            </span>
          )}
        </div>
        <button onClick={fetchStats}
          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors">
          <IconRefresh s={11}/> Actualizar
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[11px] text-gray-500 mb-1">
          <span><strong className="text-gray-800 text-xs">{usedUnits}</strong> unidades usadas</span>
          <span>{remaining} restantes de {totalUnits.toLocaleString()} · reset en {daysLeft}d</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`}
               style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
          <span>{usedCalls} scraps realizados este mes</span>
          <span>{pct.toFixed(1)}%</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">

        {/* Vista actual */}
        <div className="bg-gray-50 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-gray-400 font-medium mb-0.5">Vista actual</p>
          <p className="text-sm font-black text-gray-800">
            {verifiedInView}<span className="text-gray-400 font-normal text-xs">/{scrapableCount}</span>
          </p>
          <p className="text-[10px] text-gray-400">
            {scrapableCount > 0 ? Math.round(verifiedInView / scrapableCount * 100) : 0}% verificados
          </p>
        </div>

        {/* Costo sesión */}
        <div className={`rounded-xl px-3 py-2.5 ${sessionLocal > 0 ? 'bg-emerald-50' : 'bg-blue-50'}`}>
          <p className="text-[10px] text-gray-400 font-medium mb-0.5">Esta sesión</p>
          {sessionLocal > 0 ? (
            <>
              <p className="text-sm font-black text-emerald-700">{sessionLocal} local{sessionLocal > 1 ? 'es' : ''}</p>
              <p className="text-[10px] text-emerald-600">0 unidades · dev mode</p>
            </>
          ) : (
            <>
              <p className="text-sm font-black text-[#0000E1]">{sessionUnits} u</p>
              <p className="text-[10px] text-blue-600">{sessionScraps} scrap{sessionScraps !== 1 ? 's' : ''} · browserless</p>
            </>
          )}
        </div>

        {/* Estimado pendiente */}
        <div className="bg-amber-50 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-gray-400 font-medium mb-0.5">Pendiente (vista)</p>
          <p className="text-sm font-black text-amber-700">~{estPending} u</p>
          <p className="text-[10px] text-amber-600">{pendingInView} scraps × {avgUnitsPerScrap.toFixed(1)} avg</p>
        </div>

        {/* Alcance restante */}
        <div className={`rounded-xl px-3 py-2.5 ${remaining < estPending ? 'bg-red-50' : 'bg-gray-50'}`}>
          <p className="text-[10px] text-gray-400 font-medium mb-0.5">Presupuesto restante</p>
          <p className={`text-sm font-black ${remaining < estPending ? 'text-red-600' : 'text-gray-800'}`}>
            {remaining} u
          </p>
          <p className={`text-[10px] ${remaining < estPending ? 'text-red-500' : 'text-gray-400'}`}>
            {remaining < estPending
              ? `⚠ faltan ~${estPending - remaining} u`
              : `≈ ${Math.floor(remaining / avgUnitsPerScrap)} scraps más`}
          </p>
        </div>
      </div>

      {/* ── Barra de progreso de verificación ── */}
      {(bulkRunning || (verifOk + verifWarn + verifErr) > 0) && (() => {
        const totalDone   = bulkRunning ? bulkProgress.done  : (verifOk + verifWarn + verifErr)
        const totalTarget = bulkRunning ? bulkProgress.total : scrapableCount
        const pctDone     = totalTarget > 0 ? Math.round(totalDone / totalTarget * 100) : 0
        const avgMs       = scrapTimings.length > 0
          ? scrapTimings.reduce((s, t) => s + t.elapsed_ms, 0) / scrapTimings.length
          : 0
        const remaining_scraps = totalTarget - totalDone
        const etaMs       = avgMs > 0 ? remaining_scraps * avgMs : 0
        const verifSkip   = Object.values(verifStates).filter(v => currentDataKeys.has && v.status === 'skipped').length

        return (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-700">Progreso de verificación</span>
                {bulkRunning && (
                  <span className="flex items-center gap-1 text-[11px] text-[#0000E1] font-semibold">
                    <IconLoader s={11}/> Ejecutando…
                  </span>
                )}
              </div>
              <span className="text-[11px] font-bold text-gray-500">
                {totalDone}/{totalTarget} · {pctDone}%
              </span>
            </div>

            {/* Barra segmentada por estado */}
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex mb-2">
              {totalTarget > 0 && (
                <>
                  <div className="h-full bg-emerald-400 transition-all duration-300"
                       style={{ width: `${verifOk / totalTarget * 100}%` }} />
                  <div className="h-full bg-amber-400 transition-all duration-300"
                       style={{ width: `${verifWarn / totalTarget * 100}%` }} />
                  <div className="h-full bg-red-400 transition-all duration-300"
                       style={{ width: `${verifErr / totalTarget * 100}%` }} />
                  <div className="h-full bg-gray-300 transition-all duration-300"
                       style={{ width: `${verifSkip / totalTarget * 100}%` }} />
                </>
              )}
            </div>

            {/* Leyenda de estados */}
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-[11px] mb-2">
              {verifOk   > 0 && <span className="flex items-center gap-1 text-emerald-600 font-semibold"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/>✓ {verifOk} OK</span>}
              {verifWarn > 0 && <span className="flex items-center gap-1 text-amber-600 font-semibold"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>⚠ {verifWarn} Advertencia</span>}
              {verifErr  > 0 && <span className="flex items-center gap-1 text-red-600 font-semibold"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>✗ {verifErr} Error</span>}
              {verifSkip > 0 && <span className="flex items-center gap-1 text-gray-400 font-semibold"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block"/>— {verifSkip} Omitidos</span>}
              {remaining_scraps > 0 && <span className="text-gray-400">{remaining_scraps} pendientes</span>}
            </div>

            {/* Tiempos */}
            {avgMs > 0 && (
              <div className="flex items-center gap-4 text-[10px] text-gray-400">
                <span>⏱ Promedio por scrap: <strong className="text-gray-600">{fmtMs(avgMs)}</strong></span>
                {bulkRunning && etaMs > 0 && (
                  <span>ETA: <strong className="text-gray-600">~{fmtMs(etaMs)}</strong></span>
                )}
                {!bulkRunning && scrapTimings.length > 0 && (
                  <span>Total sesión: <strong className="text-gray-600">{fmtMs(scrapTimings.reduce((s,t) => s + t.elapsed_ms, 0))}</strong></span>
                )}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────
export default function Analytics() {
  const { country, dateFrom, dateTo } = useFilters()

  const [data,         setData]         = useState([])
  const [meta,         setMeta]         = useState({})
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [filters,      setFilters]      = useState({ page: 1, limit: 200 })
  const [verifStates,  setVerifStates]  = useState({})
  const [openPanel,    setOpenPanel]    = useState(null)
  const [selectedKeys, setSelectedKeys] = useState(new Set())
  const [bulkRunning,  setBulkRunning]  = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 })
  const [scrapTimings, setScrapTimings] = useState([])   // [{elapsed_ms, status}]
  const bulkAbort     = useRef(false)
  const bulkStartTime = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const p = new URLSearchParams()
      if (country)              p.set('country',      country)
      if (dateFrom)             p.set('date_from',    dateFrom)
      if (dateTo)               p.set('date_to',      dateTo)
      if (filters.search)       p.set('search',       filters.search)
      if (filters.status)       p.set('status',       filters.status)
      if (filters.fabricante)   p.set('fabricante',   filters.fabricante)
      if (filters.tipo_promo)   p.set('tipo_promo',   filters.tipo_promo)
      if (filters.product_type) p.set('product_type', filters.product_type)
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

  // Reset selection when data changes
  useEffect(() => { setSelectedKeys(new Set()) }, [data])

  function rowKey(row) {
    const tipo = (row.tipo_promo || 'sin_tipo').replace(/\s+/g, '_')
    const qty  = String(row.qty_max_promo || '').replace(/\s+/g, '') || '0'
    const pct  = String(row.total_desc_pct ?? '0')
    return `${row.sku || row.product_name}_${row.date_end}_${row.pais}_${tipo}_${qty}_${pct}`
  }

  // ─── Verifica un solo producto ────────────────────────────────────
  async function verifySingle(row) {
    const key = rowKey(row)
    setOpenPanel(key)

    if (!row.product_url) {
      setVerifStates(s => ({ ...s, [key]: {
        status: 'error',
        message: 'Este producto no tiene URL asociada.',
        details: {},
      }}))
      return { status: 'error' }
    }

    setVerifStates(s => ({ ...s, [key]: { loading: true } }))
    try {
      const res = await apiRequest('/scraper', {
        method: 'POST',
        body: JSON.stringify({
          url:           row.product_url,
          tipo_promo:    row.tipo_promo,
          sku:           row.sku,
          desc_pct:      row.total_desc_pct || 0,
          qty_max_promo: row.qty_max_promo || '1',
          debug:         true,
        }),
      })
      setVerifStates(s => ({ ...s, [key]: res }))
      // Registrar tiempo para ETA
      if (res.elapsed_ms != null) {
        setScrapTimings(prev => [...prev.slice(-99), { elapsed_ms: res.elapsed_ms, status: res.status || 'unknown' }])
      }
      return res
    } catch (err) {
      const errState = { status: 'error', message: err.message, details: {} }
      setVerifStates(s => ({ ...s, [key]: errState }))
      return errState
    }
  }

  function handleVerify(row) {
    const key = rowKey(row)
    const verif = verifStates[key]
    if (!verif || verif.loading) {
      verifySingle(row)
    } else {
      setOpenPanel(openPanel === key ? null : key)
    }
  }

  // ─── Verificación masiva ──────────────────────────────────────────
  async function handleBulkVerify() {
    const rows = selectedKeys.size > 0
      ? scrapableRows.filter(r => selectedKeys.has(rowKey(r)))
      : scrapableRows  // "todos" = scrapeables (sin cupones, sin dups)

    if (rows.length === 0) return

    setBulkRunning(true)
    bulkAbort.current = false
    bulkStartTime.current = Date.now()
    setBulkProgress({ done: 0, total: rows.length })
    setOpenPanel(null)

    // Marcar todos como loading
    const loadingStates = {}
    rows.forEach(r => { loadingStates[rowKey(r)] = { loading: true } })
    setVerifStates(s => ({ ...s, ...loadingStates }))

    for (let i = 0; i < rows.length; i++) {
      if (bulkAbort.current) break
      const row = rows[i]
      await verifySingle(row)
      setBulkProgress({ done: i + 1, total: rows.length })
      // Pequeña pausa para que Browserless libere el contexto antes del siguiente scrap
      if (i < rows.length - 1 && !bulkAbort.current) {
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
    }

    setBulkRunning(false)
  }

  function handleBulkStop() {
    bulkAbort.current = true
    setBulkRunning(false)
  }

  // ─── Selección ───────────────────────────────────────────────────
  // Deduplicate by rowKey (SKU+date+pais+tipo) — mismo tipo de promo en mismo SKU
  // no se scrappea dos veces. Cupones excluidos (requieren código específico).
  const _CUPON_TIPOS = new Set(['cupón','cupon','cupones','cupónes','código','codigo'])
  const _isCupon = (t) => { const l = (t||'').toLowerCase().trim(); return _CUPON_TIPOS.has(l) || (l.startsWith('cup') && l.length <= 12) }
  const keySeen = new Set()
  const scrapableRows = data.filter(r => {
    if (!r.product_url) return false
    if (_isCupon(r.tipo_promo)) return false
    const k = rowKey(r)
    if (keySeen.has(k)) return false
    keySeen.add(k)
    return true
  })
  const allSelected   = scrapableRows.length > 0 && scrapableRows.every(r => selectedKeys.has(rowKey(r)))
  const someSelected  = scrapableRows.some(r => selectedKeys.has(rowKey(r)))

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(scrapableRows.map(rowKey)))
    }
  }

  function toggleRow(row) {
    const key = rowKey(row)
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const totalPages = meta.total_pages || 1
  const page       = filters.page || 1

  // Solo contamos los resultados de las filas visibles en el país/filtro actual
  const currentDataKeys = useMemo(() => new Set(data.map(rowKey)), [data])
  const verifList = Object.entries(verifStates)
    .filter(([k, v]) => currentDataKeys.has(k) && !v.loading)
    .map(([, v]) => v)
  const verifOk   = verifList.filter(v => v.status === 'ok').length
  const verifWarn = verifList.filter(v => v.status === 'warning').length
  const verifErr  = verifList.filter(v => v.status === 'error').length

  const nSelected = selectedKeys.size

  const [activeTab,   setActiveTab]   = useState('audit')  // 'audit' | 'debug'
  const [showReport,  setShowReport]  = useState(false)

  // Construir lista de items warning/error para el report (con row original)
  const reportItems = Object.entries(verifStates)
    .filter(([k, v]) => currentDataKeys.has(k) && !v.loading &&
                        (v.status === 'warning' || v.status === 'error'))
    .map(([k, v]) => ({
      key:    k,
      result: v,
      row:    data.find(r => rowKey(r) === k) || null,
    }))

  return (
    <div>
      <PageLoader show={loading} />

      {/* Report modal */}
      {showReport && (
        <ScrapReportModal
          items={reportItems}
          data={data}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Auditoría de promociones — verifica si las promos están correctamente activadas
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          {verifOk   > 0 && <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold"><IconCheck s={12}/>{verifOk} OK</span>}
          {verifWarn > 0 && <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold"><IconAlert s={12}/>{verifWarn} Advertencia{verifWarn !== 1 ? 's' : ''}</span>}
          {verifErr  > 0 && <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-bold"><IconX s={12}/>{verifErr} Error{verifErr !== 1 ? 'es' : ''}</span>}

          {/* Make Report: visible cuando hay warnings o errores y no está corriendo bulk */}
          {reportItems.length > 0 && !bulkRunning && (
            <button
              onClick={() => setShowReport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
                         bg-gray-900 text-white hover:bg-gray-700 transition-colors shadow-sm">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              Make Report
              <span className="ml-0.5 bg-white/20 text-white px-1.5 py-0.5 rounded-md text-[10px] font-bold">
                {reportItems.length}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all
            ${activeTab === 'audit' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <IconZap s={13}/> Auditoría
        </button>
        <button
          onClick={() => setActiveTab('debug')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all
            ${activeTab === 'debug' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <IconBug s={14}/> Product Debug
        </button>
      </div>

      {activeTab === 'debug' && <ProductDebugTab />}

      {activeTab === 'audit' && <>

      {/* Browserless usage bar + progreso */}
      <BrowserlessBar
        scrapableCount={scrapableRows.length}
        verifStates={verifStates}
        currentDataKeys={currentDataKeys}
        bulkRunning={bulkRunning}
        bulkProgress={bulkProgress}
        scrapTimings={scrapTimings}
        verifOk={verifOk}
        verifWarn={verifWarn}
        verifErr={verifErr}
      />

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <FilterBar meta={meta} filters={filters} onChange={setFilters} />
      </div>

      {/* Bulk action bar */}
      <div className={`mb-3 rounded-xl border px-4 py-2.5 flex items-center justify-between gap-3 transition-all
        ${nSelected > 0 ? 'bg-[#0000E1] border-[#0000E1] shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>

        <div className="flex items-center gap-3">
          {/* Select-all checkbox */}
          <button
            onClick={toggleSelectAll}
            className={`flex items-center justify-center w-5 h-5 rounded transition-colors
              ${nSelected > 0 ? 'text-white' : 'text-gray-400 hover:text-gray-600'}`}
            title={allSelected ? 'Deseleccionar todo' : 'Seleccionar todos con URL'}>
            {allSelected
              ? <IconCheckSquare s={16} />
              : someSelected
                ? <IconMinus s={16} />
                : <IconSquare s={16} />}
          </button>

          {nSelected > 0
            ? <span className="text-sm font-bold text-white">{nSelected} producto{nSelected > 1 ? 's' : ''} seleccionado{nSelected > 1 ? 's' : ''}</span>
            : <span className="text-xs text-gray-500">Selecciona productos para verificar en bloque</span>
          }

          {/* Progreso bulk */}
          {bulkRunning && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-white/90">
              <IconLoader s={12} />
              {bulkProgress.done}/{bulkProgress.total} verificados…
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {nSelected > 0 && !bulkRunning && (
            <button onClick={() => setSelectedKeys(new Set())}
              className="text-xs font-semibold text-white/80 hover:text-white transition-colors px-2">
              Limpiar selección
            </button>
          )}

          {bulkRunning
            ? <button onClick={handleBulkStop}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/20 hover:bg-white/30
                           text-xs font-bold text-white transition-colors border border-white/30">
                <IconX s={11}/> Detener
              </button>
            : <button
                onClick={handleBulkVerify}
                disabled={loading}
                className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-colors
                  ${nSelected > 0
                    ? 'bg-white text-[#0000E1] hover:bg-white/90'
                    : 'bg-[#0000E1] border border-[#0000E1] text-white hover:bg-[#0000CC]'}`}>
                <IconPlay s={11}/>
                {nSelected > 0
                  ? `Verificar ${nSelected} seleccionados`
                  : `Verificar todos (${scrapableRows.length})`}
              </button>
          }
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {/* Checkbox header */}
                <th className="pl-4 pr-2 py-3 w-8">
                  <span className="sr-only">Seleccionar</span>
                </th>
                {['Producto','SKU','Fabricante','Estado','Promo Marca','Tipo Promo','Descuento','Vigencia','Verificación'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-20 text-sm text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-[#0000E1] border-t-transparent rounded-full animate-spin"/>
                    Cargando productos…
                  </div>
                </td></tr>
              ) : error ? (
                <tr><td colSpan={10} className="text-center py-12 text-sm text-red-500">{error}</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-16 text-sm text-gray-400">
                  No hay productos para los filtros seleccionados.
                </td></tr>
              ) : data.map((row, i) => {
                const key     = rowKey(row)
                const verif   = verifStates[key]
                const isOpen  = openPanel === key
                const checked = selectedKeys.has(key)
                const hasUrl  = !!row.product_url

                return (
                  <React.Fragment key={`${key}-${i}`}>
                    <tr className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${isOpen ? 'bg-gray-50/50' : ''} ${checked ? 'bg-blue-50/30' : ''}`}>

                      {/* Checkbox */}
                      <td className="pl-4 pr-2 py-3">
                        {hasUrl && (
                          <button
                            onClick={() => toggleRow(row)}
                            className={`flex items-center justify-center w-5 h-5 rounded transition-colors
                              ${checked ? 'text-[#0000E1]' : 'text-gray-300 hover:text-gray-500'}`}>
                            {checked ? <IconCheckSquare s={15}/> : <IconSquare s={15}/>}
                          </button>
                        )}
                      </td>

                      {/* Producto */}
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

                      {/* Estado */}
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
                          ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 whitespace-nowrap">{row.tipo_promo}</span>
                          : <span className="text-gray-400 text-xs">—</span>
                        }
                      </td>

                      {/* Descuento */}
                      <td className="px-4 py-3">
                        {row.total_desc_pct > 0
                          ? <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-[#DEFF00] text-black">-{row.total_desc_pct}%</span>
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

                      {/* Verificación */}
                      <td className="px-4 py-3">
                        <VerifBadge
                          state={verif}
                          onClick={() => handleVerify(row)}
                          tipoPrmo={row.tipo_promo}
                        />
                      </td>
                    </tr>

                    {/* Result panel */}
                    {isOpen && verif && !verif.loading && (
                      <ErrorBoundary key={`eb-${key}`}>
                        <ResultPanel state={verif} onClose={() => setOpenPanel(null)} />
                      </ErrorBoundary>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && !error && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <p className="text-xs text-gray-500">
                {meta.total?.toLocaleString()} productos · página {page} de {totalPages}
              </p>
              <select
                value={filters.limit || 200}
                onChange={e => setFilters(f => ({ ...f, limit: Number(e.target.value), page: 1 }))}
                className="h-7 px-2 text-xs border border-gray-200 rounded-lg bg-white text-gray-600
                           outline-none focus:border-[#0000E1] cursor-pointer">
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
                <option value={200}>200 por página</option>
                <option value={500}>500 por página</option>
              </select>
            </div>
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

      </>} {/* end activeTab === 'audit' */}
    </div>
  )
}




// ─── ScrapReportModal ─────────────────────────────────────────────────────────
/**
 * Modal que muestra los productos con warning/error del scraping actual
 * y permite exportar un PDF completo con screenshots.
 */

const STATUS_META = {
  warning: { label: 'Advertencia', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: '⚠' },
  error:   { label: 'Error',       color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: '✗' },
}

function generateReportHTML(items, data) {
  const now   = new Date().toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'short' })
  const total = items.length
  const warns = items.filter(i => i.status === 'warning').length
  const errs  = items.filter(i => i.status === 'error').length

  const rowMap = {}
  data.forEach(r => { rowMap[r.sku] = r })

  const itemsHTML = items.map(({ key, result, row }) => {
    const meta   = STATUS_META[result.status] || STATUS_META.warning
    const shots  = result.details?.debug?.screenshots || result.debug?.screenshots || {}
    const steps  = result.details?.steps || result.steps || []
    const msg    = result.message || ''
    const pname  = row?.product_name || key
    const sku    = row?.sku || ''
    const pais   = row?.pais || ''
    const tipo   = row?.tipo_promo || ''
    const url    = result.url || row?.product_url || ''
    const disc   = result.details?.discount_real != null ? `${result.details.discount_real}%` : '—'
    const elapsed= result.elapsed_ms ? `${(result.elapsed_ms/1000).toFixed(1)}s` : ''

    const stepsHTML = steps.length ? `
      <div style="margin-top:10px">
        <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Pasos del scraping</div>
        <ol style="margin:0;padding:0 0 0 18px;font-size:12px;color:#374151">
          ${steps.map(s => `<li style="margin-bottom:3px;color:${s.ok===false?'#dc2626':'#374151'}">${s.msg||''}</li>`).join('')}
        </ol>
      </div>` : ''

    const shotsHTML = Object.keys(shots).length ? `
      <div style="margin-top:14px">
        <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Capturas de pantalla</div>
        <div style="display:flex;flex-direction:column;gap:12px">
          ${Object.entries(shots).map(([label, b64]) => `
            <div>
              <div style="font-size:11px;font-weight:600;color:#9ca3af;margin-bottom:4px">${label}</div>
              <img src="data:image/png;base64,${b64}"
                   style="width:100%;border:1px solid #e5e7eb;border-radius:6px;display:block" />
            </div>`).join('')}
        </div>
      </div>` : ''

    return `
    <div style="border:1px solid ${meta.border};border-radius:10px;background:${meta.bg};
                padding:18px;margin-bottom:20px;page-break-inside:avoid">

      <!-- Header del ítem -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:18px;font-weight:900;color:${meta.color}">${meta.icon}</span>
            <span style="font-size:14px;font-weight:800;color:#111827">${pname}</span>
            ${sku ? `<code style="font-size:11px;background:#f3f4f6;padding:2px 7px;border-radius:4px;color:#6b7280">${sku}</code>` : ''}
            ${pais ? `<code style="font-size:11px;background:#dbeafe;padding:2px 6px;border-radius:4px;color:#1d4ed8">${pais}</code>` : ''}
          </div>
          <div style="margin-top:5px;display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:#6b7280">
            ${tipo ? `<span>Tipo promo: <strong>${tipo}</strong></span>` : ''}
            ${disc !== '—' ? `<span>Descuento detectado: <strong>${disc}</strong></span>` : ''}
            ${elapsed ? `<span>Tiempo: <strong>${elapsed}</strong></span>` : ''}
          </div>
        </div>
        <div style="flex-shrink:0">
          <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;
                       background:${meta.color};color:#fff">${meta.label.toUpperCase()}</span>
        </div>
      </div>

      <!-- Mensaje de error/warning -->
      <div style="background:#fff;border:1px solid ${meta.border};border-radius:6px;
                  padding:10px 14px;font-size:13px;color:#1f2937;margin-bottom:8px">
        ${msg}
      </div>

      <!-- URL -->
      ${url ? `<div style="font-size:10px;color:#9ca3af;word-break:break-all;margin-bottom:4px">URL: ${url}</div>` : ''}

      ${stepsHTML}
      ${shotsHTML}
    </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Scrap Report — ${now}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           margin: 0; padding: 32px 40px; background: #fff; color: #111827; }
    @media print {
      body { padding: 20px 28px; }
      .no-print { display: none !important; }
    }
    h1 { font-size: 22px; font-weight: 900; margin: 0 0 4px; }
    .subtitle { font-size: 13px; color: #6b7280; margin-bottom: 24px; }
    .stats { display: flex; gap: 16px; margin-bottom: 28px; flex-wrap: wrap; }
    .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 18px; text-align: center; }
    .stat-n { font-size: 22px; font-weight: 900; }
    .stat-l { font-size: 11px; color: #6b7280; margin-top: 2px; }
  </style>
</head>
<body>
  <h1>Scrap Report</h1>
  <div class="subtitle">Generado el ${now}</div>

  <div class="stats">
    <div class="stat"><div class="stat-n">${total}</div><div class="stat-l">Productos con alertas</div></div>
    <div class="stat"><div class="stat-n" style="color:#d97706">${warns}</div><div class="stat-l">Advertencias</div></div>
    <div class="stat"><div class="stat-n" style="color:#dc2626">${errs}</div><div class="stat-l">Errores</div></div>
  </div>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:24px"/>

  ${itemsHTML}
</body>
</html>`
}


function ScrapReportModal({ items, data, onClose }) {
  const warns = items.filter(i => i.result.status === 'warning').length
  const errs  = items.filter(i => i.result.status === 'error').length

  function exportPDF() {
    const html = generateReportHTML(items, data)
    const win  = window.open('', '_blank', 'width=1000,height=800')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 600)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.55)' }}
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-black text-gray-900">Scrap Report</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {items.length} producto{items.length !== 1 ? 's' : ''} con alertas&nbsp;·&nbsp;
              {warns > 0 && <span className="text-amber-600 font-bold">{warns} advertencia{warns !== 1 ? 's' : ''}</span>}
              {warns > 0 && errs > 0 && ' · '}
              {errs > 0 && <span className="text-red-600 font-bold">{errs} error{errs !== 1 ? 'es' : ''}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportPDF}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0000E1] text-white
                         text-xs font-bold hover:bg-blue-700 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export PDF
            </button>
            <button onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
              <IconX s={15}/>
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {items.map(({ key, result, row }) => {
            const meta   = STATUS_META[result.status] || STATUS_META.warning
            const shots  = result.details?.debug?.screenshots || result.debug?.screenshots || {}
            const steps  = result.details?.steps || result.steps || []
            const pname  = row?.product_name || key
            const sku    = row?.sku || ''
            const pais   = row?.pais || ''
            const tipo   = row?.tipo_promo || ''
            const url    = result.url || row?.product_url || ''
            const disc   = result.details?.discount_real != null
                            ? `${result.details.discount_real}%` : null

            return (
              <div key={key}
                   style={{ background: meta.bg, borderColor: meta.border }}
                   className="rounded-xl border p-4">

                {/* Item header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base">{meta.icon}</span>
                      <span className="font-bold text-gray-900 text-sm truncate">{pname}</span>
                      {sku && <code className="text-[11px] bg-white/80 px-1.5 py-0.5 rounded text-gray-500 border border-gray-200">{sku}</code>}
                      {pais && <code className="text-[11px] bg-blue-50 px-1.5 py-0.5 rounded text-blue-600">{pais}</code>}
                    </div>
                    <div className="flex gap-3 flex-wrap mt-1.5">
                      {tipo && <span className="text-[11px] text-gray-500">Tipo: <strong>{tipo}</strong></span>}
                      {disc && <span className="text-[11px] text-gray-500">Descuento detectado: <strong>{disc}</strong></span>}
                      {result.elapsed_ms && <span className="text-[11px] text-gray-400">{(result.elapsed_ms/1000).toFixed(1)}s</span>}
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full text-white"
                        style={{ background: meta.color }}>
                    {meta.label.toUpperCase()}
                  </span>
                </div>

                {/* Mensaje */}
                <div className="bg-white rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 mb-2">
                  {result.message}
                </div>

                {/* URL */}
                {url && (
                  <p className="text-[10px] text-gray-400 truncate mb-2">
                    <a href={url} target="_blank" rel="noopener noreferrer"
                       className="hover:text-[#0000E1] transition-colors">{url}</a>
                  </p>
                )}

                {/* Steps */}
                {steps.length > 0 && (
                  <details className="mb-3">
                    <summary className="text-[11px] font-semibold text-gray-500 cursor-pointer select-none hover:text-gray-700">
                      Pasos ({steps.length})
                    </summary>
                    <ol className="mt-2 space-y-0.5 pl-4 list-decimal">
                      {steps.map((s, i) => (
                        <li key={i} className={`text-[11px] ${s.ok === false ? 'text-red-500' : 'text-gray-600'}`}>
                          {s.msg}
                        </li>
                      ))}
                    </ol>
                  </details>
                )}

                {/* Screenshots */}
                {Object.keys(shots).length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                      Capturas ({Object.keys(shots).length})
                    </p>
                    {Object.entries(shots).map(([label, b64]) => (
                      <div key={label}>
                        <p className="text-[10px] text-gray-400 mb-1">{label}</p>
                        <img src={`data:image/png;base64,${b64}`}
                             alt={label}
                             className="w-full rounded-lg border border-gray-200 block" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


// ─── ProductDebugTab ──────────────────────────────────────────────────────────

/** Colapsa filas con el mismo SKU en una sola, acumulando los países en `paises[]` */
function deduplicateBySkU(rawRows) {
  const map = new Map()
  for (const r of rawRows) {
    const key = r.sku ? r.sku.toUpperCase() : `__nosku_${r.product_name}`
    if (!map.has(key)) {
      map.set(key, { ...r, paises: r.pais ? [r.pais] : [] })
    } else {
      const existing = map.get(key)
      if (r.pais && !existing.paises.includes(r.pais)) {
        existing.paises.push(r.pais)
      }
      // Mantener la primera URL no vacía
      if (!existing.product_url && r.product_url) {
        existing.product_url = r.product_url
      }
    }
  }
  return Array.from(map.values())
}

function EditModal({ row, overrides, onSave, onClose, saving }) {
  const current = overrides[row.sku] || row.product_url || ''
  const [val, setVal] = React.useState(current)

  function handleSave() {
    const url = val.trim()
    if (url) onSave(row.sku, url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.45)' }}
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Editar URL del producto</h3>
            <p className="text-xs text-gray-500 mt-0.5">{row.product_name || 'Sin nombre'}</p>
          </div>
          <button onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors flex-shrink-0">
            <IconX s={16}/>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* SKU + País */}
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
              {row.sku}
            </span>
            <span className="text-xs text-gray-500">{row.pais_nombre || row.pais}</span>
            {overrides[row.sku] && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Override activo
              </span>
            )}
          </div>

          {/* Current URL (read-only) */}
          {current && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1 uppercase tracking-wide">
                URL actual
              </label>
              <p className="text-xs font-mono text-gray-500 bg-gray-50 rounded-lg px-3 py-2 break-all border border-gray-100">
                {current}
              </p>
            </div>
          )}

          {/* New URL input */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              {current ? 'Nueva URL' : 'URL del producto'}
            </label>
            <input
              autoFocus
              type="url"
              value={val}
              onChange={e => setVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter')  handleSave()
                if (e.key === 'Escape') onClose()
              }}
              placeholder="https://lentesplus.com/co/…"
              className="w-full text-sm px-3 py-2.5 border border-gray-200 rounded-xl outline-none
                         font-mono text-gray-700 focus:border-[#0000E1] focus:ring-1 focus:ring-[#0000E1]/20
                         transition-colors"
            />
            <p className="text-[10px] text-gray-400 mt-1.5">
              Pega la URL del producto desde el sitio de lentesplus. Se aplica al próximo scraping.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/50">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
            Cancelar
          </button>
          <button
            disabled={saving || !val.trim() || val.trim() === current}
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold
                       bg-[#0000E1] text-white hover:bg-blue-700 disabled:opacity-40 transition-colors">
            {saving ? <IconLoader s={13}/> : <IconSave s={13}/>}
            Guardar URL
          </button>
        </div>
      </div>
    </div>
  )
}


function ProductDebugTab() {
  const [rows,      setRows]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [overrides, setOverrides] = useState({})   // {sku: url}
  const [editRow,   setEditRow]   = useState(null)  // row being edited in modal
  const [saving,    setSaving]    = useState(false)
  const [search,    setSearch]    = useState('')
  const [tabFilter, setTabFilter] = useState('all') // 'all' | 'no_url' | 'overridden'
  const [toast,     setToast]     = useState(null)

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2800)
  }

  // Load all products + active overrides
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [prodRes, ovRes] = await Promise.all([
          apiRequest('/analytics?limit=200&page=1'),
          apiRequest('/analytics?mode=url_overrides'),
        ])
        if (cancelled) return
        // Load up to 20 pages (4000 products) to avoid missing SKUs
        const allData = [...(prodRes.data || [])]
        const totalPages = prodRes.meta?.total_pages || 1
        if (totalPages > 1) {
          const extra = await Promise.all(
            Array.from({ length: Math.min(totalPages - 1, 19) }, (_, i) =>
              apiRequest(`/analytics?limit=200&page=${i + 2}`)
            )
          )
          if (!cancelled) {
            extra.forEach(r => allData.push(...(r.data || [])))
          }
        }
        if (!cancelled) {
          setRows(deduplicateBySkU(allData))
          setOverrides(ovRes.overrides || {})
        }
      } catch (e) {
        console.error('[ProductDebug] load error', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function handleSave(sku, url) {
    setSaving(true)
    try {
      await apiRequest('/analytics', {
        method: 'PATCH',
        body: JSON.stringify({ sku, url }),
      })
      setOverrides(prev => ({ ...prev, [sku]: url }))
      setRows(prev => prev.map(r => r.sku === sku ? { ...r, product_url: url } : r))
      setEditRow(null)
      showToast(`URL actualizada para ${sku}`)
    } catch (e) {
      showToast('Error al guardar', false)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveOverride(sku) {
    setSaving(true)
    try {
      await apiRequest(`/analytics?sku=${encodeURIComponent(sku)}`, { method: 'DELETE' })
      const next = { ...overrides }
      delete next[sku]
      setOverrides(next)
      showToast(`Override eliminado para ${sku}`)
    } catch (e) {
      showToast('Error al eliminar override', false)
    } finally {
      setSaving(false)
    }
  }

  // Compute filtered rows synchronously (no useMemo — avoids stale closure issues)
  const q = search.trim().toLowerCase()
  const visible = rows.filter(r => {
    if (tabFilter === 'no_url'    && r.product_url)     return false
    if (tabFilter === 'overridden' && !overrides[r.sku]) return false
    if (q && !(
      (r.sku          || '').toLowerCase().includes(q) ||
      (r.product_name || '').toLowerCase().includes(q) ||
      (r.product_url  || '').toLowerCase().includes(q)
    )) return false
    return true
  })

  const noUrlCount      = rows.filter(r => !r.product_url).length
  const overriddenCount = Object.keys(overrides).length

  return (
    <>
      {/* Edit modal */}
      {editRow && (
        <EditModal
          row={editRow}
          overrides={overrides}
          onSave={handleSave}
          onClose={() => setEditRow(null)}
          saving={saving}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold
          ${toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px] h-8 px-3
                          border border-gray-200 rounded-xl bg-gray-50 focus-within:border-[#0000E1]
                          focus-within:bg-white transition-colors">
            <IconSearch s={13} />
            <input
              type="text"
              placeholder="Buscar por SKU, nombre o URL…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400 text-gray-700"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="text-gray-300 hover:text-gray-500 transition-colors">
                <IconX s={12}/>
              </button>
            )}
          </div>
          {/* Filter pills */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {[
              { id: 'all',        label: `Todos (${rows.length})` },
              { id: 'no_url',     label: `Sin URL (${noUrlCount})` },
              { id: 'overridden', label: `Con override (${overriddenCount})` },
            ].map(f => (
              <button key={f.id} onClick={() => setTabFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                  ${tabFilter === f.id
                    ? 'bg-[#0000E1] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
            <IconLoader s={16}/> Cargando productos…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide w-28">SKU</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Producto</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide w-14">País</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">URL</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide w-28">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                      {loading ? 'Cargando…' : 'No hay productos que coincidan'}
                    </td>
                  </tr>
                ) : visible.map(row => {
                  const hasOverride = !!overrides[row.sku]
                  const hasUrl      = !!row.product_url

                  return (
                    <tr key={`${row.sku}-${row.pais}`}
                      className="hover:bg-gray-50/70 transition-colors">

                      {/* SKU */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-[11px] text-gray-600 bg-gray-100
                                           px-1.5 py-0.5 rounded w-fit">
                            {row.sku}
                          </span>
                          {hasOverride && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50
                                             px-1.5 py-0.5 rounded border border-amber-200 w-fit">
                              Override
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Nombre */}
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-xs text-gray-800 line-clamp-2">{row.product_name || '—'}</p>
                        {row.fabricante && (
                          <p className="text-[10px] text-gray-400 mt-0.5">{row.fabricante}</p>
                        )}
                      </td>

                      {/* País */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(row.paises && row.paises.length > 0
                            ? row.paises
                            : row.pais ? [row.pais] : ['—']
                          ).map(p => (
                            <span key={p}
                              className="text-[10px] font-semibold text-gray-500 bg-gray-100
                                         px-1.5 py-0.5 rounded leading-tight">
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* URL */}
                      <td className="px-4 py-3 max-w-[300px]">
                        {hasUrl ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-mono text-gray-500 truncate block max-w-[260px]"
                                  title={row.product_url}>
                              {row.product_url}
                            </span>
                            <a href={row.product_url} target="_blank" rel="noopener noreferrer"
                               className="text-gray-300 hover:text-[#0000E1] flex-shrink-0 transition-colors">
                              <IconExternal s={10}/>
                            </a>
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-red-500 font-semibold">
                            <IconAlert s={11}/> Sin URL
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setEditRow(row)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100
                                       text-gray-600 text-[11px] font-semibold hover:bg-gray-200 transition-colors">
                            <IconEdit s={11}/> Editar
                          </button>
                          {hasOverride && (
                            <button
                              disabled={saving}
                              onClick={() => handleRemoveOverride(row.sku)}
                              title="Eliminar override — volver a URL original del CSV"
                              className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100
                                         transition-colors disabled:opacity-40">
                              <IconTrash s={11}/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {!loading && (
          <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {visible.length} de {rows.length} producto{rows.length !== 1 ? 's' : ''}
              {overriddenCount > 0 && (
                <> · <span className="text-amber-600 font-semibold">{overriddenCount} con override</span></>
              )}
            </p>
            <p className="text-[10px] text-gray-400">
              Los cambios se aplican al próximo scraping del producto
            </p>
          </div>
        )}
      </div>
    </>
  )
}
