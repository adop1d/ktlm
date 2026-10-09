// defineConfig from vitest, not vite: it is the one that knows the `test` key below.
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
        name: 'KTM',
        short_name: 'KTM',
        description: 'KTM, gestor de tareas compatible con todo.txt',
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
        // No `html` on purpose. If the document is precached, the service worker serves
        // the old index.html until a new version of the worker is registered, and during
        // that window the app loads a bundle the server no longer has. It looks like the
        // build did not land and it did: the document always goes to the network.
        globPatterns: ['**/*.{js,css,ico,png,svg,webmanifest}'],
        cleanupOutdatedCaches: true,
        // No navigation fallback: the network resolves the routes, not a cached copy.
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
    // In vitest 3 the limits live under `thresholds`; `statements` is no longer a top level key.
    coverage: {
      reporter: ['text', 'json'],
      thresholds: { statements: 80 },
    },
  },
});
