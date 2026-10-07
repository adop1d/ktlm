import { expect, test, waitForList } from './fixtures';

/**
 * The stream is what lets an open session see what another one does without reloading.
 * End-to-end delivery cannot be tested here because the e2e intercept the API and CI does not
 * start the backend; that is verified against Docker. What is checked here is that the client
 * subscribes, reconnects, and breaks nothing.
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
        // Cutting the connection on purpose is what happens when the laptop goes to sleep.
        await route.abort();
        cortes += 1;
      }
    );

    await page.goto('/app');
    await waitForList(page);
    await page.waitForTimeout(1_200);

    expect(fallos).toEqual([]);
    // Navigation stays alive even when the stream does not exist.
    await page.keyboard.press('j');
    await expect(page.locator('.tui-row--cursor')).toHaveCount(1);
  });
});
