import { Page, expect, test } from '@playwright/test';
import { mockTasks, seedSession, seedTasks } from './fixtures';

/**
 * Autenticación contra la API simulada. Este archivo NO usa el fixture de `fixtures.ts`, que
 * siembra sesión: aquí lo que se prueba es precisamente el camino de "no hay sesión", y
 * mezclar ambos hacía que un beforeEach borrara el token recién puesto.
 */
const mockAuth = (page: Page) =>
  page.route(
    (url) => url.pathname.startsWith('/api/auth'),
    async (route) => {
    const body = route.request().postDataJSON() as { username: string };
    const ok = body.username === 'tester';
    return route.fulfill({
      status: ok ? 200 : 401,
      json: ok
        ? {
            token: 'jwt-de-prueba',
            type: 'Bearer',
            username: 'tester',
            email: 't@t.com',
            roles: ['ROLE_USER'],
          }
        : { error: 'Unauthorized' },
      });
    }
  );

test.describe('sin sesión', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.removeItem('auth-store'));
    await mockAuth(page);
    await mockTasks(page, { tasks: seedTasks(3) });
    await page.goto('/login');
  });

  test('el login muestra el formulario', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Bienvenido' })).toBeVisible();
    await expect(page.getByLabel('Usuario')).toBeVisible();
    await expect(page.getByLabel('Contraseña')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('sin sesión, /app manda al login', async ({ page }) => {
    await page.goto('/app');

    await expect(page).toHaveURL(/\/login$/);
  });

  test('inicia sesión y aterriza en la lista', async ({ page }) => {
    await page.getByLabel('Usuario').fill('tester');
    await page.getByLabel('Contraseña').fill('secret123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    // El login lleva a la app, no a la portada.
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.locator('.tui-titlebar')).toBeVisible();
  });

  test('credenciales inválidas se quedan en el login con el error visible', async ({ page }) => {
    await page.getByLabel('Usuario').fill('intruso');
    await page.getByLabel('Contraseña').fill('malaclave');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText(/Unauthorized/i).first()).toBeVisible();
  });
});

test.describe('con sesión', () => {
  test('salir limpia la sesión y devuelve al login', async ({ page }) => {
    await seedSession(page, 'jwt');
    await mockAuth(page);
    await mockTasks(page, { tasks: seedTasks(3) });

    await page.goto('/app');
    await expect(page.locator('.tui-titlebar')).toBeVisible();

    await page.getByRole('button', { name: 'salir' }).click();

    await expect(page).toHaveURL(/\/login$/);
  });
});