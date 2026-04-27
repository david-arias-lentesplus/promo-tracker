/**
 * 📄 /src/components/LoginPage.jsx
 * Agente 1 — Frontend (Skill C: Auth)
 * Design System: LIVO
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginRequest } from '@utils/api'

// ─── Icons (inline SVG) ──────────────────────────────────────
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
)

const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

const EyeIcon = ({ closed }) => closed ? (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
) : (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)

const ArrowRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
)

const SpinnerIcon = () => (
  <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.3"/>
    <path d="M12 2v4" strokeOpacity="1"/>
  </svg>
)

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername]     = useState('')
  const [password, setPassword]     = useState('')
  const [showPass,  setShowPass]    = useState(false)
  const [loading,   setLoading]     = useState(false)
  const [error,     setError]       = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setLoading(true)
    setError('')
    try {
      const data = await loginRequest(username.trim(), password)
      localStorage.setItem('token', data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Credenciales inválidas. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F2F3F7] flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">

        {/* ── Card ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-livo-xl px-10 py-10">

          {/* Logo & heading */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black text-blue-600 tracking-tight leading-tight">
              PromoTracker
            </h1>
            <p className="mt-2 text-sm text-gray-500 font-medium">
              Analytics Dashboard Authentication
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Username */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <UserIcon />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="input-base pl-9"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-gray-700">
                  Password
                </label>
                <button
                  type="button"
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <LockIcon />
                </span>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="input-base pl-9 pr-10"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  <EyeIcon closed={showPass} />
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <SpinnerIcon />
                  <span>Autenticando…</span>
                </>
              ) : (
                <>
                  <span>Login securely</span>
                  <ArrowRightIcon />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center mt-6 text-xs text-gray-400">
          PromoTracker · Internal Dashboard · Acceso restringido
        </p>
      </div>
    </div>
  )
}
