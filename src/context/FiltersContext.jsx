/**
 * 📄 /src/context/FiltersContext.jsx
 * Estado global de filtros: País + Rango de Fechas.
 * Afecta todas las vistas del sistema.
 */
import React, { createContext, useContext, useState } from 'react'

const FiltersContext = createContext(null)

export function FiltersProvider({ children }) {
  const [country,  setCountry]  = useState('')   // código: 'CO', 'CL', etc.
  const [dateFrom, setDateFrom] = useState('')   // 'YYYY-MM-DD'
  const [dateTo,   setDateTo]   = useState('')   // 'YYYY-MM-DD'

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
