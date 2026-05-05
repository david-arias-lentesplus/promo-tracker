/**
 * 📄 /src/pages/AccountProfile.jsx
 * Any authenticated user — view and update own profile
 * PUT /api/me — requires current_password
 */
import React, { useState, useEffect } from 'react'
import PageLoader from '../components/PageLoader'
import { apiRequest, getCurrentUser } from '@utils/api'

// ─── Icons ─────────────────────────────────────────────────────
const IconCheck = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
const IconLock  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
const IconEye   = ({ off }) => off
  ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

// ─── Password input ─────────────────────────────────────────────
function PasswordInput({ label, value, onChange, placeholder, required }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full h-10 pl-3 pr-9 text-sm border border-gray-200 rounded-xl outline-none
                     focus:border-[#0000E1] focus:ring-2 focus:ring-[#0000E1]/15"
        />
        <button type="button" onClick={() => setShow(s => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
          <IconEye off={show} />
        </button>
      </div>
    </div>
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
      text-sm font-medium ${type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
      {type !== 'error' && <IconCheck />}
      {msg}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────
export default function AccountProfile() {
  const localUser = getCurrentUser()

  const [profile, setProfile]         = useState(null)
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [toast, setToast]             = useState({ msg: '', type: 'ok' })

  // Form state
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail]             = useState('')
  const [currentPw, setCurrentPw]     = useState('')
  const [newPw, setNewPw]             = useState('')
  const [confirmPw, setConfirmPw]     = useState('')

  useEffect(() => {
    async function fetchProfile() {
      try {
        const data = await apiRequest('/me')
        const u = data.user
        setProfile(u)
        setDisplayName(u.display_name || '')
        setEmail(u.email || '')
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (newPw && newPw !== confirmPw) {
      setError('Las contraseñas nuevas no coinciden')
      return
    }
    if (newPw && newPw.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }

    setSaving(true)
    try {
      const body = {
        current_password: currentPw,
        display_name:     displayName,
        email:            email,
      }
      if (newPw) body.new_password = newPw

      const data = await apiRequest('/me', { method: 'PUT', body: JSON.stringify(body) })

      // Update localStorage
      const stored = getCurrentUser()
      if (stored) {
        const updated = {
          ...stored,
          display_name: data.user?.display_name || stored.display_name,
          email:        data.user?.email        || stored.email,
        }
        localStorage.setItem('user', JSON.stringify(updated))
      }

      setProfile(data.user)
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      setToast({ msg: 'Perfil actualizado exitosamente', type: 'ok' })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader show={true} />

  const displayUser = profile || localUser
  const rolLabel    = displayUser?.role === 'admin' ? 'Administrador' : 'Usuario'

  return (
    <div className="max-w-2xl">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Mi perfil</h1>
        <p className="text-sm text-gray-500 mt-0.5">Administra tu información personal</p>
      </div>

      <div className="space-y-5">
        {/* Avatar card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-[#0000E1] flex items-center justify-center
                            text-white text-2xl font-black flex-shrink-0">
              {initials(displayUser?.display_name || displayUser?.username)}
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">
                {displayUser?.display_name || displayUser?.username}
              </p>
              <p className="text-sm text-gray-500">@{displayUser?.username}</p>
              <span className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold
                ${displayUser?.role === 'admin' ? 'bg-[#0000E1] text-white' : 'bg-gray-100 text-gray-600'}`}>
                {rolLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Edit form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-800">Información personal</h2>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Info fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre completo</label>
                <input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl outline-none
                             focus:border-[#0000E1] focus:ring-2 focus:ring-[#0000E1]/15"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl outline-none
                             focus:border-[#0000E1] focus:ring-2 focus:ring-[#0000E1]/15"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center gap-2 mb-4 text-xs font-semibold text-gray-500">
                <IconLock />
                Cambiar contraseña
              </div>
              <div className="space-y-3">
                <PasswordInput
                  label="Contraseña actual *"
                  value={currentPw}
                  onChange={setCurrentPw}
                  placeholder="Requerida para guardar cambios"
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <PasswordInput
                    label="Nueva contraseña"
                    value={newPw}
                    onChange={setNewPw}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <PasswordInput
                    label="Confirmar nueva contraseña"
                    value={confirmPw}
                    onChange={setConfirmPw}
                    placeholder="Repetir contraseña"
                  />
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={saving || !currentPw}
                className="flex items-center gap-2 h-9 px-5 rounded-xl bg-[#0000E1] text-white text-sm
                           font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? 'Guardando…' : (
                  <><IconCheck /> Guardar cambios</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <Toast msg={toast.msg} type={toast.type} onClose={() => setToast({ msg: '', type: 'ok' })} />
    </div>
  )
}
