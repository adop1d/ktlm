import { expect, test } from '@playwright/test';

/**
 * La portada es la primera pantalla: entrar no debe ser encontrarse un login sin contexto.
 */
test.describe('portada', () => {
  test.beforeEach(async ({ page }) => {
    // Sin sesión sembrada a propósito: la portada es pública y se tiene que ver sin entrar.
    await page.addInitScript(() => window.localStorage.removeItem('auth-store'));
    await page.goto('/');
  });

  test('la raíz muestra la portada y no el login', async ({ page }) => {
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('todo.txt');
    await expect(page.getByLabel('Contraseña')).toHaveCount(0);
  });

  test('enseña la terminal con su status line', async ({ page }) => {
    const ventana = page.getByLabel('Vista de la aplicación');
    await expect(ventana).toBeVisible();

    // La firma es el cromo real, no una ilustración: filas y barra de estado de verdad.
    await expect(ventana.locator('.tui-row')).toHaveCount(4);
    await expect(ventana.locator('.tui-status')).toContainText('normal');
    await expect(ventana.locator('.tui-row--done')).toHaveCount(1);
  });

  test('el botón de entrar lleva a la app', async ({ page }) => {
    await page.getByRole('link', { name: 'abrir la app' }).click();

    // Sin sesión, /app está protegido y manda al login. Con sesión, la lista.
    await expect(page).toHaveURL(/\/login$/);
  });

  test('la tabla de atajos es la de tuxedo', async ({ page }) => {
    const tabla = page.locator('#teclas');
    await expect(tabla).toBeVisible();
    await expect(tabla).toContainText('gg');
    await expect(tabla).toContainText('dd');
    await expect(tabla).toContainText('Ctrl-d');
  });

  test('avisa de que el archivo solo se sincroniza en Chromium', async ({ page }) => {
    await expect(page.getByText(/Fuera de ahí/)).toBeVisible();
  });
});
