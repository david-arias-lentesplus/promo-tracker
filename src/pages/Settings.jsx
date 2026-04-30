/**
 * 📄 /src/pages/Settings.jsx
 * Admin-only: User Management + Browserless Usage Tracker
 */
import React, { useState, useEffect, useCallback } from 'react'
import { apiRequest } from '@utils/api'

// ─── Icons ─────────────────────────────────────────────────────
const IconPlus    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const IconEdit    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IconTrash   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
const IconClose   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IconShield  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
const IconUser    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
const IconRefresh = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
const IconCheck   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
const IconXmark   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IconClock   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
const IconGlobe   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>

// ─── Helpers ────────────────────────────────────────────────────
function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
function avatarColor(str) {
  const colors = ['bg-blue-500','bg-purple-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-teal-500']
  let hash = 0
  for (const c of (str || '')) hash = hash * 31 + c.charCodeAt(0)
  return colors[Math.abs(hash) % colors.length]
}
function fmtMs(ms) {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
function fmtTs(ts) {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString('es-CO', {
      month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
    })
  } catch { return ts }
}
function getMonthLabel(key) {
  if (!key) return ''
  const [y, m] = key.split('-')
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${months[parseInt(m,10)-1]} ${y}`
}
function getResetDate() {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return next.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

// ─── Role Badge ─────────────────────────────────────────────────
function RoleBadge({ role }) {
  const isAdmin = role === 'admin'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold
      ${isAdmin ? 'bg-[#0000E1] text-white' : 'bg-gray-100 text-gray-600'}`}>
      {isAdmin ? <IconShield /> : <IconUser />}
      {isAdmin ? 'Admin' : 'Usuario'}
    </span>
  )
}

// ─── Toast ──────────────────────────────────────────────────────
function Toast({ msg, type, onClose }) {
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [msg, onClose])
  if (!msg) return null
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg
      text-sm font-medium transition-all ${type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
      {msg}
      <button onClick={onClose} className="opacity-70 hover:opacity-100"><IconClose /></button>
    </div>
  )
}

// ─── User Modal ─────────────────────────────────────────────────
const EMPTY_FORM = { username: '', display_name: '', email: '', password: '', role: 'user' }

function UserModal({ user, onClose, onSaved }) {
  const isEdit = !!user
  const [form, setForm]     = useState(isEdit
    ? { username: user.username, display_name: user.display_name || '', email: user.email || '', password: '', role: user.role || 'user' }
    : { ...EMPTY_FORM })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isEdit) {
        const body = { display_name: form.display_name, email: form.email, role: form.role }
        if (form.password.trim()) body.password = form.password.trim()
        await apiRequest(`/users?id=${user.id}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await apiRequest('/users', { method: 'POST', body: JSON.stringify(form) })
      }
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {isEdit ? 'Editar usuario' : 'Crear nuevo usuario'}
            </h2>
            {isEdit && <p className="text-xs text-gray-400 mt-0.5">@{user.username}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500">
            <IconClose />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Username *</label>
              <input value={form.username} onChange={e => set('username', e.target.value)} required
                placeholder="ej. juan.perez"
                className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0000E1] focus:ring-2 focus:ring-[#0000E1]/15"/>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre completo</label>
            <input value={form.display_name} onChange={e => set('display_name', e.target.value)}
              placeholder="ej. Juan Pérez"
              className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0000E1] focus:ring-2 focus:ring-[#0000E1]/15"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="ej. juan@empresa.com"
              className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0000E1] focus:ring-2 focus:ring-[#0000E1]/15"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              {isEdit ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}
            </label>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
              required={!isEdit} placeholder={isEdit ? '••••••••' : 'Mínimo 6 caracteres'}
              className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0000E1] focus:ring-2 focus:ring-[#0000E1]/15"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Rol</label>
            <select value={form.role} onChange={e => set('role', e.target.value)}
              className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0000E1] bg-white">
              <option value="user">Usuario</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-9 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 h-9 rounded-lg bg-[#0000E1] text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60">
              {loading ? 'Guardando…' : (isEdit ? 'Guardar cambios' : 'Crear usuario')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Confirm ─────────────────────────────────────────────
function DeleteConfirm({ user, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleDelete() {
    setError('')
    setLoading(true)
    try {
      await apiRequest(`/users?id=${user.id}`, { method: 'DELETE' })
      onDeleted()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <IconTrash />
          </div>
          <h2 className="text-base font-bold text-gray-900 mb-1">¿Eliminar usuario?</h2>
          <p className="text-sm text-gray-500">
            Esta acción eliminará permanentemente a <strong>{user.display_name || user.username}</strong>.
          </p>
        </div>
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 text-center">
            {error}
          </div>
        )}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleDelete} disabled={loading}
            className="flex-1 h-9 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60">
            {loading ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Browserless Usage Tracker ───────────────────────────────────
function BrowserlessTracker() {
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiRequest('/scraper_stats')
      setStats(data.stats || null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  // Mes actual
  const monthKey  = new Date().toISOString().slice(0, 7)           // '2026-04'
  const monthData = stats?.monthly?.[monthKey] || { calls: 0, units_used: 0, history: [] }
  const plan      = stats?.plan  || { units_per_month: 1000, reset_day: 1 }

  const unitsUsed  = monthData.units_used  || 0
  const unitsTotal = plan.units_per_month  || 1000
  const calls      = monthData.calls       || 0
  const history    = monthData.history     || []
  const pct        = Math.min(100, Math.round((unitsUsed / unitsTotal) * 100))

  const barColor = pct >= 90 ? 'bg-red-500'
                 : pct >= 70 ? 'bg-amber-400'
                 : 'bg-[#0000E1]'

  const statusBadge = (status) => {
    if (status === 'ok' || status === 'warning') return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700">
        <IconCheck /> ok
      </span>
    )
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-600">
        <IconXmark /> error
      </span>
    )
  }

  return (
    <div className="mt-8">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-black flex items-center justify-center">
            <IconGlobe />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 leading-none">Browserless</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Consumo del plan gratuito · {getMonthLabel(monthKey)}</p>
          </div>
        </div>
        <button
          onClick={loadStats}
          disabled={loading}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 text-xs font-semibold
                     text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-colors disabled:opacity-50">
          <IconRefresh /> Actualizar
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center text-sm text-gray-400">
          Cargando estadísticas…
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-8 text-center text-sm text-red-500">
          {error}
        </div>
      ) : (
        <>
          {/* KPI cards + barra */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
            {/* Barra de progreso */}
            <div className="mb-5">
              <div className="flex items-end justify-between mb-1.5">
                <span className="text-2xl font-black text-gray-900 tabular-nums">
                  {unitsUsed}
                  <span className="text-sm font-semibold text-gray-400 ml-1">/ {unitsTotal.toLocaleString()} unidades</span>
                </span>
                <span className={`text-sm font-bold ${pct >= 90 ? 'text-red-500' : pct >= 70 ? 'text-amber-500' : 'text-[#0000E1]'}`}>
                  {pct}%
                </span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
                <IconClock />
                Reset el 1° de cada mes · Próximo reset: {getResetDate()}
                &nbsp;·&nbsp;
                1 unidad = hasta 30 s de sesión Chrome
              </p>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Scraps realizados', value: calls, sub: `este mes` },
                { label: 'Unidades usadas',   value: unitsUsed, sub: `de ${unitsTotal.toLocaleString()} disponibles` },
                { label: 'Promedio por scrap', value: calls > 0 ? (unitsUsed / calls).toFixed(1) : '—', sub: 'unidades/scrap' },
              ].map(({ label, value, sub }) => (
                <div key={label} className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-500 font-medium mb-0.5">{label}</p>
                  <p className="text-xl font-black text-gray-900 tabular-nums">{value}</p>
                  <p className="text-[10px] text-gray-400">{sub}</p>
                </div>
              ))}
            </div>

            {pct >= 80 && (
              <div className={`mt-4 rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center gap-2
                ${pct >= 90 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                ⚠️ {pct >= 90
                  ? `Quedan solo ${unitsTotal - unitsUsed} unidades. Considera reducir el uso o actualizar el plan.`
                  : `Has usado el ${pct}% del plan. Quedan ${unitsTotal - unitsUsed} unidades.`}
              </div>
            )}
          </div>

          {/* Historial de llamadas */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Historial de scraping — {getMonthLabel(monthKey)}
              </span>
              <span className="text-xs text-gray-400">{history.length} registro{history.length !== 1 ? 's' : ''}</span>
            </div>

            {history.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-gray-400">
                No hay scraps registrados este mes.
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="grid grid-cols-[1.4fr_1.2fr_0.8fr_0.8fr_0.7fr_0.6fr] gap-3 px-5 py-2
                                text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-50">
                  <span>Fecha</span>
                  <span>Tipo promo</span>
                  <span>SKU</span>
                  <span>Duración</span>
                  <span>Unidades</span>
                  <span>Estado</span>
                </div>
                {history.map(entry => (
                  <div key={entry.id}
                    className="grid grid-cols-[1.4fr_1.2fr_0.8fr_0.8fr_0.7fr_0.6fr] gap-3 px-5 py-3 items-center
                               border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors text-xs">
                    <span className="text-gray-500 font-mono">{fmtTs(entry.timestamp)}</span>
                    <span className="font-semibold text-gray-800 truncate">{entry.tipo_promo || '—'}</span>
                    <span className="text-gray-500 font-mono truncate">{entry.sku || <span className="text-gray-300">—</span>}</span>
                    <span className="text-gray-600 tabular-nums">{fmtMs(entry.elapsed_ms)}</span>
                    <span className="font-bold text-gray-800 tabular-nums">
                      {entry.units} unit{entry.units !== 1 ? 's' : ''}
                    </span>
                    <span>{statusBadge(entry.status)}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Link al dashboard de Browserless */}
          <p className="text-[11px] text-gray-400 mt-2 text-right">
            Ver dashboard completo en{' '}
            <a href="https://browserless.io/account" target="_blank" rel="noopener noreferrer"
               className="text-[#0000E1] hover:underline font-medium">
              browserless.io/account
            </a>
          </p>
        </>
      )}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────
export default function Settings() {
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [modal, setModal]       = useState(null)
  const [toast, setToast]       = useState({ msg: '', type: 'ok' })

  const showToast = (msg, type = 'ok') => setToast({ msg, type })

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiRequest('/users')
      setUsers(data.users || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  function handleSaved(msg) {
    setModal(null)
    showToast(msg || 'Cambios guardados')
    loadUsers()
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Configuración</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de usuarios y consumo de servicios</p>
        </div>
        <button
          onClick={() => setModal('create')}
          className="flex items-center gap-2 h-9 px-4 rounded-xl bg-[#0000E1] text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">
          <IconPlus />
          Crear usuario
        </button>
      </div>

      {/* Users table card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100
                        text-xs font-semibold text-gray-400 uppercase tracking-wide">
          <span>Usuario</span>
          <span>Email</span>
          <span>Rol</span>
          <span>Creado</span>
          <span>Acciones</span>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">Cargando usuarios…</div>
        ) : error ? (
          <div className="px-5 py-12 text-center text-sm text-red-500">{error}</div>
        ) : users.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">No hay usuarios registrados.</div>
        ) : (
          users.map(u => (
            <div key={u.id}
              className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-4 px-5 py-4 items-center
                         border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatarColor(u.username)}`}>
                  {initials(u.display_name || u.username)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {u.display_name || u.username}
                  </p>
                  <p className="text-xs text-gray-400 truncate">@{u.username}</p>
                </div>
              </div>
              <span className="text-sm text-gray-600 truncate">{u.email || '—'}</span>
              <RoleBadge role={u.role} />
              <span className="text-xs text-gray-400">{u.created_at || '—'}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setModal({ edit: u })}
                  className="w-7 h-7 rounded-lg border border-gray-200 hover:bg-[#0000E1] hover:border-[#0000E1]
                             hover:text-white flex items-center justify-center text-gray-500 transition-colors"
                  title="Editar">
                  <IconEdit />
                </button>
                <button
                  onClick={() => setModal({ delete: u })}
                  className="w-7 h-7 rounded-lg border border-gray-200 hover:bg-red-600 hover:border-red-600
                             hover:text-white flex items-center justify-center text-gray-500 transition-colors"
                  title="Eliminar">
                  <IconTrash />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && !error && (
        <p className="text-xs text-gray-400 mt-3 text-right">
          {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* ── Browserless Usage Tracker ───────────────────── */}
      <BrowserlessTracker />

      {/* Modals */}
      {modal === 'create' && (
        <UserModal
          user={null}
          onClose={() => setModal(null)}
          onSaved={() => handleSaved('Usuario creado exitosamente')}
        />
      )}
      {modal?.edit && (
        <UserModal
          user={modal.edit}
          onClose={() => setModal(null)}
          onSaved={() => handleSaved('Usuario actualizado')}
        />
      )}
      {modal?.delete && (
        <DeleteConfirm
          user={modal.delete}
          onClose={() => setModal(null)}
          onDeleted={() => handleSaved('Usuario eliminado')}
        />
      )}

      <Toast msg={toast.msg} type={toast.type} onClose={() => setToast({ msg: '', type: 'ok' })} />
    </div>
  )
}
