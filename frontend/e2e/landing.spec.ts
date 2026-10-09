import { expect, publicTest as test } from './fixtures';

/**
 * The landing page is the first screen: entering should not mean landing on a contextless login.
 */
test.describe('portada', () => {
  test.beforeEach(async ({ page }) => {
    // No session seeded on purpose: the landing page is public and must render without logging in.
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

    // The look is real chrome, not an illustration: real rows and status bar.
    await expect(ventana.locator('.tui-row')).toHaveCount(4);
    await expect(ventana.locator('.tui-status')).toContainText('normal');
    await expect(ventana.locator('.tui-row--done')).toHaveCount(1);
  });

  test('el MCP tiene su sección y enlaza a la documentación', async ({ page }) => {
    const seccion = page.locator('.lp-mcp');
    await expect(seccion).toBeVisible();
    // The three steps are the content: somebody who runs them has it working.
    await expect(seccion.locator('li')).toHaveCount(3);
    await seccion.getByRole('link').click();
    await expect(page).toHaveURL(/\/docs$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/MCP/);
  });

  test('el botón de entrar lleva a la app', async ({ page }) => {
    await page.getByRole('link', { name: 'abrir la app' }).click();

    // Without a session, /app is protected and redirects to the login. With one, the list.
    await expect(page).toHaveURL(/\/login$/);
  });

  test('la tabla de atajos es la de tuxedo', async ({ page }) => {
    const tabla = page.locator('#teclas');
    await expect(tabla).toBeVisible();
    await expect(tabla).toContainText('gg');
    await expect(tabla).toContainText('dd');
    await expect(tabla).toContainText('Ctrl-d');
  });

  /**
   * The landing said the file only syncs in Chromium. That stopped being true when the file
   * moved to the server, and the copy was corrected — so this used to assert a claim the app
   * had stopped making. It now pins the replacement, which is the one worth keeping: the
   * file is the server's, and that is what makes the phone and an MCP agent agree.
   */
  test('avisa de que el archivo es del servidor', async ({ page }) => {
    await expect(page.getByText(/El archivo es del servidor/)).toBeVisible();
  });
});
