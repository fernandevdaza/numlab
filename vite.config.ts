import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Rutas relativas: la misma compilación funciona en GitHub Pages (subcarpeta) y en Electron (file://).
  base: './',
  server: { port: 5173 },
  build: { chunkSizeWarningLimit: 6000 },
})
