/**
 * 📄 /src/pages/Notifications.jsx
 * Promos por vencer — estados nueva/leída, toggle ocultar leídas
 * Leídas se persisten en localStorage: 'notif_read_ids'
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { apiRequest } from '@utils/api'
import { useFilters } from '@context/FiltersContext'

// ─── LocalStorage helpers ───────────────────────────────────────
const LS_KEY = 'notif_read_ids'

function getReadIds() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]')) }
  catch { return new Set() }
}
function saveReadIds(set) {
  localStorage.setItem(LS_KEY, JSON.stringify([...set]))
  window.dispatchEvent(new Event('notif_read_changed'))
}
function markRead(id) {
  const s = getReadIds(); s.add(id); saveReadIds(s)
}
function markAllRead(ids) {
  const s = getReadIds(); ids.forEach(id => s.add(id)); saveReadIds(s)
}

// ─── Icons ─────────────────────────────────────────────────────
const IconBell    = ({ size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
const IconClock   = ({ size = 13 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
const IconCalendar= ({ size = 13 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
const IconCheck   = ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
const IconEye     = ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
const IconEyeOff  = ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
const IconRefresh = ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>

// ─── Urgency helpers ────────────────────────────────────────────
function urgency(days) {
  if (days === 0) return { label: '¡Vence hoy!',      color: 'bg-red-600',    text: 'text-red-600',    border: 'border-red-200',    bg: 'bg-red-50'    }
  if (days === 1) return { label: 'Vence mañana',      color: 'bg-red-500',    text: 'text-red-500',    border: 'border-red-200',    bg: 'bg-red-50'    }
  if (days <= 3)  return { label: `${days} días`,      color: 'bg-orange-500', text: 'text-orange-600', border: 'border-orange-200', bg: 'bg-orange-50' }
  return           { label: `${days} días`,             color: 'bg-amber-400',  text: 'text-amber-600',  border: 'border-amber-200',  bg: 'bg-amber-50'  }
}

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    const [y, m, d] = iso.split('-')
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`
  } catch { return iso }
}

// ─── Single notification card ───────────────────────────────────
function NotifCard({ item, isRead, onMarkRead }) {
  const u = urgency(item.days_remaining)

  return (
    <div className={`relative flex gap-4 p-4 rounded-2xl border transition-all
      ${isRead
        ? 'bg-white border-gray-100 opacity-60'
        : `${u.bg} ${u.border} border shadow-sm`
      }`}>

      {/* Unread dot */}
      {!isRead && (
        <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${u.color} shadow-sm`} />
      )}

      {/* Product image */}
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border border-gray-100 flex-shrink-0 flex items-center justify-center">
        {item.image_url
          ? <img src={item.image_url} alt={item.product_name}
              className="w-full h-full object-contain p-1"
              onError={e => { e.target.style.display='none' }} />
          : <span className="text-[10px] text-gray-400 text-center px-1 leading-tight">
              {item.sku || '—'}
            </span>
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          {/* Urgency badge */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-white ${u.color} flex-shrink-0`}>
            <IconClock size={10} />
            {u.label}
          </span>
          {isRead && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">
              <IconCheck size={10} /> Leída
            </span>
          )}
        </div>

        {item.product_url
          ? <a href={item.product_url} target="_blank" rel="noopener noreferrer"
                className="text-sm font-bold text-[#0000E1] mt-1.5 leading-snug truncate hover:underline block"
                title={item.product_name}>
              {item.product_name}
            </a>
          : <p className="text-sm font-bold text-gray-900 mt-1.5 leading-snug truncate" title={item.product_name}>
              {item.product_name}
            </p>
        }

        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {item.sku && (
            <span className="text-[11px] font-mono text-gray-500 bg-white/70 px-1.5 py-0.5 rounded border border-gray-200">
              {item.sku}
            </span>
          )}
          <span className="text-xs text-gray-500">{item.fabricante}</span>
          {item.pais_nombre && (
            <span className="text-xs text-gray-400">{item.pais_nombre}</span>
          )}
        </div>

        {item.promo_marca && (
          <p className="text-xs text-gray-600 mt-1 truncate">
            {item.promo_marca}
          </p>
        )}

        {/* Dates */}
        <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <IconCalendar size={11} /> Inicio: {fmtDate(item.date_start)}
          </span>
          <span className={`flex items-center gap-1 font-semibold ${u.text}`}>
            <IconCalendar size={11} /> Fin: {fmtDate(item.date_end)}
          </span>
        </div>
      </div>

      {/* Mark read button */}
      {!isRead && (
        <button
          onClick={() => onMarkRead(item.id)}
          className="flex-shrink-0 self-start mt-0.5 flex items-center gap-1 px-2.5 py-1 rounded-lg
                     bg-white/80 border border-gray-200 text-xs font-semibold text-gray-500
                     hover:bg-white hover:text-gray-800 transition-colors"
          title="Marcar como leída">
          <IconCheck size={12} />
          Leída
        </button>
      )}
    </div>
  )
}

// ─── Empty state ────────────────────────────────────────────────
function EmptyState({ hideRead }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <IconBell size={28} />
      </div>
      <p className="text-base font-bold text-gray-700">
        {hideRead ? 'No hay notificaciones nuevas' : 'Sin promos por vencer pronto'}
      </p>
      <p className="text-sm text-gray-400 mt-1 max-w-xs">
        {hideRead
          ? 'Todas las alertas han sido revisadas.'
          : 'Las promos que vencen en los próximos 7 días aparecerán aquí.'}
      </p>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────
export default function Notifications() {
  const { country } = useFilters()

  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [readIds, setReadIds]   = useState(getReadIds)
  const [hideRead, setHideRead] = useState(false)
  const [days, setDays]         = useState(7)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (country) params.set('country', country)
      params.set('days', days)
      const data = await apiRequest(`/notifications?${params}`)
      const notifs = data.notifications || []
      setItems(notifs)
      // Persist full ID list so Layout badge can compute unread count without an API call
      localStorage.setItem('notif_all_ids', JSON.stringify(notifs.map(n => n.id)))
      window.dispatchEvent(new Event('notif_items_changed'))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [country, days])

  useEffect(() => { load() }, [load])

  // Sync readIds when changed from other tab or same page
  useEffect(() => {
    const sync = () => setReadIds(getReadIds())
    window.addEventListener('notif_read_changed', sync)
    return () => window.removeEventListener('notif_read_changed', sync)
  }, [])

  function handleMarkRead(id) {
    markRead(id)
    setReadIds(getReadIds())
  }

  function handleMarkAllRead() {
    markAllRead(items.map(i => i.id))
    setReadIds(getReadIds())
  }

  const unreadItems = useMemo(() => items.filter(i => !readIds.has(i.id)), [items, readIds])
  const readItems   = useMemo(() => items.filter(i =>  readIds.has(i.id)), [items, readIds])
  const displayed   = hideRead ? unreadItems : items

  const unreadCount  = unreadItems.length
  const hasUnread    = unreadCount > 0

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            Notificaciones
            {hasUnread && (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full
                               bg-[#0000E1] text-white text-xs font-bold">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Promociones por vencer — alertas de vencimiento próximo
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Days threshold selector */}
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="h-8 px-2 text-xs bg-white border border-gray-200 rounded-lg outline-none
                       focus:border-[#0000E1] text-gray-600 font-medium">
            <option value={3}>3 días</option>
            <option value={7}>7 días</option>
            <option value={14}>14 días</option>
            <option value={30}>30 días</option>
          </select>

          {/* Hide/show read */}
          <button
            onClick={() => setHideRead(h => !h)}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-semibold transition-colors
              ${hideRead
                ? 'bg-[#0000E1] text-white border-[#0000E1]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            {hideRead ? <><IconEye size={13} /> Mostrar leídas</> : <><IconEyeOff size={13} /> Ocultar leídas</>}
          </button>

          {/* Mark all read */}
          {hasUnread && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200
                         bg-white text-xs font-semibold text-gray-600 hover:border-gray-300 transition-colors">
              <IconCheck size={13} />
              Marcar todas
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={load}
            className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center
                       text-gray-500 hover:bg-gray-50 transition-colors"
            title="Actualizar">
            <IconRefresh size={13} />
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {!loading && !error && items.length > 0 && (
        <div className="flex items-center gap-4 mb-5 text-xs text-gray-500">
          <span>
            <strong className="text-gray-900">{items.length}</strong> promo{items.length !== 1 ? 's' : ''} por vencer
          </span>
          <span className="w-px h-3 bg-gray-200" />
          <span className={hasUnread ? 'text-[#0000E1] font-semibold' : ''}>
            <strong>{unreadCount}</strong> nueva{unreadCount !== 1 ? 's' : ''}
          </span>
          {readItems.length > 0 && (
            <>
              <span className="w-px h-3 bg-gray-200" />
              <span><strong>{readItems.length}</strong> leída{readItems.length !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-7 h-7 border-2 border-[#0000E1] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-sm text-red-600 font-medium">{error}</p>
          <button onClick={load} className="mt-3 text-xs text-red-500 underline">Reintentar</button>
        </div>
      ) : displayed.length === 0 ? (
        <EmptyState hideRead={hideRead} />
      ) : (
        <div className="space-y-3">
          {/* Unread section */}
          {!hideRead && unreadItems.length > 0 && (
            <>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1 mb-2">
                Nuevas — {unreadItems.length}
              </p>
              {unreadItems.map(item => (
                <NotifCard
                  key={item.id}
                  item={item}
                  isRead={false}
                  onMarkRead={handleMarkRead}
                />
              ))}
            </>
          )}

          {/* Read section */}
          {!hideRead && readItems.length > 0 && (
            <>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1 mt-5 mb-2">
                Leídas — {readItems.length}
              </p>
              {readItems.map(item => (
                <NotifCard
                  key={item.id}
                  item={item}
                  isRead={true}
                  onMarkRead={handleMarkRead}
                />
              ))}
            </>
          )}

          {/* When hideRead = true, show only unread */}
          {hideRead && unreadItems.map(item => (
            <NotifCard
              key={item.id}
              item={item}
              isRead={false}
              onMarkRead={handleMarkRead}
            />
          ))}
        </div>
      )}
    </div>
  )
}
