import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Development is loopback-only. Users run the bundled runtime, never a Vite LAN server.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5174', changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', request => {
            // This proxy is a local development client, never a tablet access boundary.
            request.setHeader('Origin', 'http://127.0.0.1:5174')
          })
        },
      },
    },
  },
  preview: { host: '127.0.0.1', port: 5173, strictPort: true },
})
