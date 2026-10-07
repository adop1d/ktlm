// defineConfig de vitest, no de vite: es el que conoce la clave `test` de abajo.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'KTLM',
        short_name: 'KTLM',
        description: 'KTLM, gestor de tareas compatible con todo.txt',
        theme_color: '#6366f1',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Sin `html` a propósito. Si el documento está en la precarga, el service worker
        // sirve el index.html viejo hasta que se registra una versión nueva del worker, y
        // durante esa ventana la app carga un bundle que el servidor ya no tiene. Parece
        // que el build no llegó y no lo es: el documento va siempre a la red.
        globPatterns: ['**/*.{js,css,ico,png,svg,webmanifest}'],
        cleanupOutdatedCaches: true,
        // Sin fallback de navegación: las rutas las resuelve la red, no una copia en caché.
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    open: true,
  },

  // ---------- Vitest configuration ----------
  test: {
    globals: true,
    environment: 'jsdom',
    // loads this file before each test suite
    setupFiles: ['./vitest.setup.ts'],
    // En vitest 3 los límites viven bajo `thresholds`; `statements` ya no es una clave de primer nivel.
    coverage: {
      reporter: ['text', 'json'],
      thresholds: { statements: 80 },
    },
  },
});
