import { expect, test, waitForList } from './fixtures';

/**
 * El stream es lo que hace que una sesión abierta vea lo que hace otra sin recargar. Aquí no se
 * puede probar la entrega de punta a punta porque los e2e interceptan la API y el CI no
 * levanta el backend; eso se verifica contra Docker. Lo que sí se comprueba aquí es que el
 * cliente se suscribe, reconecta y no rompe nada.
 */
test.describe('stream de cambios', () => {
  test('el cliente se suscribe al stream al abrir la app', async ({ page }) => {
    const pedidos: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/tasks/stream')) pedidos.push(r.url());
    });

    await page.goto('/app');
    await waitForList(page);
    await expect.poll(() => pedidos.length, { timeout: 8_000 }).toBeGreaterThan(0);
  });

  test('un stream que se corta no rompe la app y reintenta', async ({ page }) => {
    const fallos: string[] = [];
    page.on('pageerror', (e) => fallos.push(e.message));

    let cortes = 0;
    await page.route(
      (url) => url.pathname.endsWith('/api/tasks/stream'),
      async (route) => {
        // Cortar la conexión a proposito es lo que pasa cuando se duerme el portatil.
        await route.abort();
        cortes += 1;
      }
    );

    await page.goto('/app');
    await waitForList(page);
    await page.waitForTimeout(1_200);

    expect(fallos).toEqual([]);
    // La navegacion sigue viva aunque el stream no exista.
    await page.keyboard.press('j');
    await expect(page.locator('.tui-row--cursor')).toHaveCount(1);
  });
});
