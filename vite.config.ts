import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // PORT is set by tooling (e.g. the Claude Code preview harness); Vite
  // otherwise defaults to 5173, which collides with other local dev servers.
  server: {
    port: Number(process.env.PORT) || 5174,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Kokoda Tracker',
        short_name: 'Kokoda',
        description:
          'Team training tracker for the Kokoda Challenge Brisbane.',
        display: 'standalone',
        theme_color: '#2e7d32',
        background_color: '#ffffff',
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // Full runtime caching (map tiles, Firestore offline) lands with F7.
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          mui: ['@mui/material', '@mui/icons-material'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
