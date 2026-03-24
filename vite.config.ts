import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Post chunk (~148 kB gz) includes markdown + highlight.js + Supabase client
    // All lazy-loaded — only fetched when a post page is opened
    chunkSizeWarningLimit: 600,
  },
})
