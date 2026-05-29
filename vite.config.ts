import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    headers: {
      // Allow Firebase auth popup to talk back to the opener window
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
})
