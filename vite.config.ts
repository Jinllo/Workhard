/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // Cloudflare Pages expone el commit desplegado; así la app muestra qué versión corre.
    'import.meta.env.VITE_COMMIT_SHA': JSON.stringify(process.env.CF_PAGES_COMMIT_SHA ?? 'local'),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
