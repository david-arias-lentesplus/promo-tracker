/**
 * 📄 /src/App.jsx
 * Agente 1 — Frontend (Skill A + C)
 * Routing principal con auth guard + FiltersProvider global
 */
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import { FiltersProvider } from '@context/FiltersContext'
import LoginPage    from '@components/LoginPage'
import Layout       from '@components/Layout'
import PrivateRoute from '@components/PrivateRoute'
import Dashboard    from '@pages/Dashboard'
import HSInfo       from '@pages/HSInfo'
import Campaigns    from '@pages/Campaigns'
import RawData      from '@pages/RawData'
import Analytics    from '@pages/Analytics'

export default function App() {
  return (
    <FiltersProvider>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected — todo dentro de Layout */}
        <Route element={<PrivateRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard  />} />
            <Route path="/hs-info"   element={<HSInfo     />} />
            <Route path="/campaigns" element={<Campaigns  />} />
            <Route path="/raw-data"  element={<RawData    />} />
            <Route path="/analytics" element={<Analytics  />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </FiltersProvider>
  )
}
