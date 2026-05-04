import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'child_process'

// ── Build-time version info ───────────────────────────────────────
// En Vercel, VERCEL_GIT_COMMIT_SHA se inyecta automáticamente.
// Localmente usamos git rev-parse como fallback.
let _commitSha = 'local'
try {
  _commitSha = (
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    execSync('git rev-parse --short HEAD 2>/dev/null').toString().trim() ||
    'local'
  )
} catch (_) {}

const _buildTime = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Cuando Electron lanza Vite, inyecta VITE_CACHE_DIR=/tmp/... para evitar
  // conflictos de permisos con node_modules/.vite creado desde el terminal.
  cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',

  // Constantes inyectadas en el bundle (reemplazadas en build time)
  define: {
    __APP_VERSION__:    JSON.stringify(_commitSha),
    __APP_BUILD_TIME__: JSON.stringify(_buildTime),
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@context': path.resolve(__dirname, './src/context'),
    }
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },

  server: {
    port: 3000,
    proxy: {
      // En desarrollo local, redirige /api/* a un servidor Python local (puerto 8000)
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
