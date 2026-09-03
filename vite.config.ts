import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const localTelemetryProxy = {
  target: 'http://127.0.0.1:8795',
  changeOrigin: true,
  rewrite: (path: string) => path.replace(/^\/shipos-bridge/, ''),
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/shipos-bridge': localTelemetryProxy,
      '/api': {
        target: process.env.VITE_SHIPOS_API_URL ?? 'http://localhost:5010',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/shipos-bridge': localTelemetryProxy,
    },
  },
})
