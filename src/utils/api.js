/**
 * 📄 /src/utils/api.js
 * Cliente HTTP con auth automática.
 * Solo cierra sesión en 401 con mensaje de auth — no en errores de red o 500.
 */
const BASE_URL = '/api'

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token')

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  }

  let response
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, config)
  } catch (networkErr) {
    // Error de red (dev-server caído, sin conexión) — NO cerrar sesión
    throw new Error(`Sin conexión con el servidor. ¿Está corriendo dev-server.py?`)
  }

  // Leer body una sola vez
  let data
  try {
    data = await response.json()
  } catch {
    throw new Error(`Respuesta inesperada del servidor (${response.status})`)
  }

  // Solo cerrar sesión si el 401 es un error de autenticación real
  if (response.status === 401) {
    const isAuthError = data?.message &&
      (data.message.includes('Token') || data.message.includes('expirado') ||
       data.message.includes('inválido') || data.message.includes('autorizado'))

    if (isAuthError) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
      throw new Error('Sesión expirada. Inicia sesión nuevamente.')
    }
    throw new Error(data?.message || 'No autorizado')
  }

  if (!response.ok) {
    throw new Error(data?.message || `Error del servidor (${response.status})`)
  }

  return data
}

export async function loginRequest(username, password) {
  let response
  try {
    response = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
  } catch {
    throw new Error('No se puede conectar con el servidor.')
  }

  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'Credenciales inválidas')
  if (data.user) localStorage.setItem('user', JSON.stringify(data.user))
  return data
}

export function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null') }
  catch { return null }
}
