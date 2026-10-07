import { expect, seedTasks, test, waitForList } from './fixtures';

/**
 * Saved searches (fs/ff) and the file view (a). All three keys were wired to the keymap's
 * `default`, which is to say they did nothing.
 */
test.describe('búsquedas guardadas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await waitForList(page);
  });

  test('fs abre el prompt y guarda la búsqueda actual con nombre', async ({ page }) => {
    await page.getByPlaceholder('Buscar tareas...').fill('Tarea 002');
    // The debounce is 300 ms: without waiting, the empty filter would be saved.
    await page.waitForTimeout(500);
    // With focus inside the search box the keymap deliberately does not fire: otherwise,
    // typing "fs" in the search box would save a search by accident.
    await page.locator('h1').click();

    await page.keyboard.press('f');
    await page.keyboard.press('s');

    const prompt = page.getByRole('dialog', { name: 'Guardar esta búsqueda' });
    await expect(prompt).toBeVisible();
    await prompt.getByLabel('Guardar esta búsqueda').fill('las doses');
    await prompt.getByRole('button', { name: 'Guardar' }).click();

    await expect(prompt).toBeHidden();
  });

  test('fs con la búsqueda vacía avisa en vez de guardar ruido', async ({ page }) => {
    await page.keyboard.press('f');
    await page.keyboard.press('s');

    // The prompt does not even open: there is nothing to save.
    await expect(page.getByRole('dialog', { name: 'Guardar esta búsqueda' })).toHaveCount(0);
  });

  test('ff muestra lo guardado y Enter lo aplica', async ({ page }) => {
    await page.getByPlaceholder('Buscar tareas...').fill('Tarea 002');
    await page.waitForTimeout(500);
    // With focus in the search box the keymap ignores the key, on purpose.
    await page.locator('h1').click();
    await page.keyboard.press('f');
    await page.keyboard.press('s');
    const prompt = page.getByRole('dialog', { name: 'Guardar esta búsqueda' });
    await prompt.getByLabel('Guardar esta búsqueda').fill('las doses');
    await prompt.getByRole('button', { name: 'Guardar' }).click();

    // The search is cleared and then recovered with ff.
    await page.getByPlaceholder('Buscar tareas...').fill('');
    await page.waitForTimeout(500);
    await page.locator('h1').click();
    await page.keyboard.press('f');
    await page.keyboard.press('f');

    const picker = page.getByRole('dialog', { name: 'Búsquedas guardadas' });
    await expect(picker).toBeVisible();
    // Two sibling buttons (apply and delete) share text: anchor on the one in the row.
    await expect(picker.locator('.tui-pane-item', { hasText: 'las doses' })).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(picker).toBeHidden();
    await expect(page.getByPlaceholder('Buscar tareas...')).toHaveValue('Tarea 002');
    await expect(page.locator('.tui-row')).toHaveCount(1);
  });

  test('ff con la lista vacía explica cómo guardar', async ({ page }) => {
    await page.keyboard.press('f');
    await page.keyboard.press('f');

    const picker = page.getByRole('dialog', { name: 'Búsquedas guardadas' });
    await expect(picker).toContainText('Ninguna todavía');
  });
});

test.describe('vista de archivo', () => {
  test('a pide un todo.txt antes de poder abrir el archivo', async ({ page }) => {
    await page.goto('/app');
    await waitForList(page);

    // Without a linked file there is no sibling done.txt to read.
    await page.keyboard.press('a');

    await expect(page.getByLabel('Archivo de hechas')).toContainText('Nada archivado todavía');
    await expect(page.getByRole('status')).toContainText('done.txt');
  });

  test('a vuelve a la lista y la barra lo dice', async ({ page }) => {
    await page.goto('/app');
    await waitForList(page);

    await page.keyboard.press('a');
    await expect(page.getByLabel('Archivo de hechas')).toBeVisible();

    await page.keyboard.press('a');
    await expect(page.getByLabel('Archivo de hechas')).toHaveCount(0);
    await expect(page.locator('.tui-row').first()).toBeVisible();
  });
});

test('los atajos de archivo quedan visibles en la ayuda', async ({ page }) => {
  await page.goto('/app');
  await waitForList(page);

  await page.keyboard.press('?');

  const ayuda = page.getByRole('dialog', { name: 'Atajos de teclado' });
  await expect(ayuda).toContainText('ff');
  await expect(ayuda).toContainText('fs');
  await expect(ayuda).toContainText('ver archivo');
    // Actions disabled without a file are listed, but with the reason.
  await expect(ayuda).toContainText('Apagados');
});
