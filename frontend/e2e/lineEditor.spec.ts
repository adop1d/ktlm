import { expect, seedTasks, test, waitForList } from './fixtures';

/**
 * The line editor is the todo.txt line being written, not a form. These check the parts
 * that are easy to get wrong: that the letters reach the line, that they do not fire while
 * the cursor is in the title, and that Enter writes it.
 */
test.describe('editor de línea', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await waitForList(page);
    await page.locator('h1').click();
  });

  test('p cambia la prioridad sin salir de la línea', async ({ page }) => {
    await page.keyboard.press('e');
    const editor = page.locator('.tui-editor');
    await expect(editor).toBeVisible();

    const prioridad = page.locator('.tui-editor-seg').first();
    await page.keyboard.press('Tab');
    await page.keyboard.press('p');

    // A -> B, the cycle tuxedo does. The point is that it changed and stayed on the line.
    await expect(prioridad).not.toHaveText('(A)');
  });

  test('+ y c abren un prompt y escriben el token', async ({ page }) => {
    await page.keyboard.press('e');
    await page.keyboard.press('Tab');
    await page.keyboard.press('+');

    const prompt = page.locator('.tui-editor-prompt input');
    await expect(prompt).toBeVisible();
    await prompt.fill('casa');
    await prompt.press('Enter');

    await expect(page.locator('.tui-editor')).toContainText('+casa');
  });

  test('una letra en el título se escribe, no cicla la prioridad', async ({ page }) => {
    await page.keyboard.press('e');
    const titulo = page.getByLabel('Título de la tarea');
    await titulo.fill('comprar pan');

    const prioridadAntes = await page.locator('.tui-editor-seg').first().textContent();

    // The title has the focus, so `p` is a character. If the key were also read as the
    // priority cycle, writing a task called "comprar pan" would quietly change its priority.
    await titulo.press('p');
    await expect(titulo).toHaveValue('comprar panp');
    await expect(page.locator('.tui-editor-seg').first()).toHaveText(prioridadAntes ?? '');
  });

  test('Esc cancela y no deja el editor abierto', async ({ page }) => {
    await page.keyboard.press('e');
    await expect(page.locator('.tui-editor')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('.tui-editor')).toHaveCount(0);
  });
});

test.describe('idioma', () => {
  test('el conmutador cambia los textos de la barra', async ({ page }) => {
    await page.goto('/app');
    await waitForList(page);

    // Pinned to Spanish by the fixture; the button is the way out of it.
    await expect(page.locator('.tui-titlebar-button', { hasText: 'salir' })).toBeVisible();

    // Exact match on purpose: `hasText: 'EN'` also matches `tokens`, which is one
    // of the other buttons in the bar.
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.locator('.tui-titlebar-button', { hasText: 'log out' })).toBeVisible();

    await page.getByRole('button', { name: 'ES', exact: true }).click();
    await expect(page.locator('.tui-titlebar-button', { hasText: 'salir' })).toBeVisible();
  });

  test('la elección se recuerda al recargar', async ({ page }) => {
    await page.goto('/app');
    await waitForList(page);
    // Exact match on purpose: `hasText: 'EN'` also matches `tokens`, which is one
    // of the other buttons in the bar.
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.locator('.tui-titlebar-button', { hasText: 'log out' })).toBeVisible();

    await page.reload();
    await waitForList(page);
    // Without the store it would fall back to the browser locale, which in CI is English
    // for the wrong reason and would pass here and fail on a Spanish machine.
    await expect(page.locator('.tui-titlebar-button', { hasText: 'log out' })).toBeVisible();
  });
});
