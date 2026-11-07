/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        // the PDF exporter and its Thai font are only needed on first export, so they aren't part of the install
        globIgnores: ['**/reportPdf-*.js'],
        runtimeCaching: [{
          urlPattern: ({ url }) => /\/assets\/reportPdf-.*\.js$/.test(url.pathname) || url.pathname === '/fonts/NotoSansThai.ttf',
          handler: 'CacheFirst',
          options: { cacheName: 'pdf-export', expiration: { maxEntries: 4 } },
        }],
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'MeMoney',
        short_name: 'MeMoney',
        description: 'Expense & income tracker',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f2f2f7',
        theme_color: '#f2f2f7',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: { proxy: { '/api': 'http://localhost:3000' } },
  test: { environment: 'node' },
})
