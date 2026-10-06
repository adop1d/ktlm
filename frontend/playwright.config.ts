import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // El CI ya reintentaba; en local también. Hay tests con ventana de tiempo (el chord de
  // 600 ms) que bajo carga de CPU pueden fallar sin que haya un fallo de verdad.
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    // La app es un PWA: sin esto el service worker sirve el index cacheado y los tests
    // assertan contra un build viejo que no es el que está en disco.
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});