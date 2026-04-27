/**
 * 📄 /src/components/PrivateRoute.jsx
 * Agente 1 — Frontend (Skill C: Auth)
 * Protege rutas que requieren autenticación.
 */
import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'

export default function PrivateRoute() {
  const token = localStorage.getItem('token')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  // Token existe → renderizar la ruta hija
  return <Outlet />
}
