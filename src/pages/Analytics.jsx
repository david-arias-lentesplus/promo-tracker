/**
 * 📄 /src/pages/Analytics.jsx
 * Agente 1 — Placeholder (se implementará en fases posteriores)
 */
import React from 'react'

const meta = {
  HSInfo:    { title: 'HS Info',    desc: 'Home Slider Info — Promociones vigentes por fabricante.',          color: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-600'   },
  Campaigns: { title: 'Campañas',   desc: 'Agrupación de productos por fabricante y tipo de oferta.',         color: 'bg-pink-50',   border: 'border-pink-200',   text: 'text-pink-600'   },
  Analytics: { title: 'Analytics',  desc: 'Auditoría: precio CSV vs. precio real del checkout (scraping).', color: 'bg-[#DEFF00]/10', border: 'border-[#DEFF00]/40', text: 'text-gray-800' },
}['Analytics']

export default function Analytics() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{meta.title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{meta.desc}</p>
      </div>
      <div className={`card flex flex-col items-center justify-center py-24 text-center ${meta.color} border ${meta.border}`}>
        <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-4 shadow-livo-sm">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className={meta.text}>
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <p className={`text-base font-bold ${meta.text} mb-1`}>Próximamente</p>
        <p className="text-xs text-gray-500 max-w-xs">
          Esta vista se implementará en la siguiente fase del proyecto,
          conectada con los datos reales del backend.
        </p>
      </div>
    </div>
  )
}
