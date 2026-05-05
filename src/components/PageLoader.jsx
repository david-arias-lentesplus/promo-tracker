import { useEffect, useState } from 'react'

/**
 * Full-screen loading overlay.
 * Appears instantly, fades out with ease-in-out when show → false.
 * Usage: <PageLoader show={loading} />
 */
export default function PageLoader({ show = true }) {
  const [mounted,  setMounted]  = useState(show)
  const [fadeOut,  setFadeOut]  = useState(false)

  useEffect(() => {
    if (show) {
      setFadeOut(false)
      setMounted(true)
    } else {
      setFadeOut(true)
      const t = setTimeout(() => setMounted(false), 340)
      return () => clearTimeout(t)
    }
  }, [show])

  if (!mounted) return null

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         9999,
        background:     '#fbfbff',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        opacity:        fadeOut ? 0 : 1,
        transition:     fadeOut ? 'opacity 0.32s ease-in-out' : 'none',
        pointerEvents:  fadeOut ? 'none' : 'auto',
      }}
    >
      <img
        src="/loader.gif"
        alt="Cargando…"
        style={{ width: 80, height: 80, objectFit: 'contain' }}
      />
    </div>
  )
}
