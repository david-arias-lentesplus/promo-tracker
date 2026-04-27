import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
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
