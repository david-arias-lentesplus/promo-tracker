/**
 * 📄 /src/context/FiltersContext.jsx
 * Estado global de filtros: País + Rango de Fechas.
 * Defaults: país = Todos, fechas = hoy.
 */
import React, { createContext, useContext, useState } from 'react'

const FiltersContext = createContext(null)

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export function FiltersProvider({ children }) {
  const [country,  setCountry]  = useState('')           // '' = Todos
  const [dateFrom, setDateFrom] = useState(todayISO)     // default: hoy
  const [dateTo,   setDateTo]   = useState(todayISO)     // default: hoy

  return (
    <FiltersContext.Provider value={{
      country,  setCountry,
      dateFrom, setDateFrom,
      dateTo,   setDateTo,
    }}>
      {children}
    </FiltersContext.Provider>
  )
}

export function useFilters() {
  const ctx = useContext(FiltersContext)
  if (!ctx) throw new Error('useFilters must be used inside FiltersProvider')
  return ctx
}
