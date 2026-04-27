/**
 * 📄 /src/hooks/useAuth.js
 * Agente 1 — Frontend
 * 
 * Hook para gestionar el estado de autenticación del usuario.
 */
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginRequest } from '@utils/api'

export function useAuth() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  
  const isAuthenticated = !!localStorage.getItem('token')
  
  const login = useCallback(async (username, password) => {
    setLoading(true)
    setError(null)
    try {
      const data = await loginRequest(username, password)
      localStorage.setItem('token', data.token)
      navigate('/hs-info')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [navigate])
  
  const logout = useCallback(() => {
    localStorage.removeItem('token')
    navigate('/login')
  }, [navigate])
  
  return { isAuthenticated, login, logout, loading, error }
}
