/**
 * 📄 /src/App.jsx
 * Routing principal con auth guard + FiltersProvider global
 */
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import { FiltersProvider } from '@context/FiltersContext'
import { getCurrentUser }  from '@utils/api'
import LoginPage           from '@components/LoginPage'
import Layout              from '@components/Layout'
import PrivateRoute        from '@components/PrivateRoute'
import Dashboard           from '@pages/Dashboard'
import HSInfo              from '@pages/HSInfo'
import Campaigns           from '@pages/Campaigns'
import RawData             from '@pages/RawData'
import Analytics           from '@pages/Analytics'
import Settings            from '@pages/Settings'
import AccountProfile      from '@pages/AccountProfile'
import Notifications       from '@pages/Notifications'

/** Wraps a route so only admins can access it; others get redirected to /dashboard */
function AdminRoute({ children }) {
  const user = getCurrentUser()
  if (!user || user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <FiltersProvider>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected — everything inside Layout */}
        <Route element={<PrivateRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard      />} />
            <Route path="/hs-info"   element={<HSInfo         />} />
            <Route path="/campaigns" element={<Campaigns      />} />
            <Route path="/raw-data"  element={<RawData        />} />
            <Route path="/analytics" element={<Analytics      />} />
            <Route path="/profile"       element={<AccountProfile />} />
            <Route path="/notifications" element={<Notifications   />} />
            <Route path="/settings"  element={
              <AdminRoute><Settings /></AdminRoute>
            } />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </FiltersProvider>
  )
}
