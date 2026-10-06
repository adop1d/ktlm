import { expect, seedTasks, test, waitForList } from './fixtures';

/**
 * Búsquedas guardadas (fs/ff) y vista de archivo (a). Las tres teclas venían cableadas al
 * `default` del keymap, es decir, no hacían nada.
 */
test.describe('búsquedas guardadas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await waitForList(page);
  });

  test('fs abre el prompt y guarda la búsqueda actual con nombre', async ({ page }) => {
    await page.getByPlaceholder('Buscar tareas...').fill('Tarea 002');
    // El debounce son 300 ms: sin esperar, se guardaría el filtro vacío.
    await page.waitForTimeout(500);
    // Con el foco dentro del buscador el keymap no dispara, a propósito: si no, escribir
    // "fs" en la caja de busqueda guardaria una búsqueda por accidente.
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

    // El prompt ni se abre: no hay nada que guardar.
    await expect(page.getByRole('dialog', { name: 'Guardar esta búsqueda' })).toHaveCount(0);
  });

  test('ff muestra lo guardado y Enter lo aplica', async ({ page }) => {
    await page.getByPlaceholder('Buscar tareas...').fill('Tarea 002');
    await page.waitForTimeout(500);
    // Con el foco en el buscador el keymap ignora la tecla, a propósito.
    await page.locator('h1').click();
    await page.keyboard.press('f');
    await page.keyboard.press('s');
    const prompt = page.getByRole('dialog', { name: 'Guardar esta búsqueda' });
    await prompt.getByLabel('Guardar esta búsqueda').fill('las doses');
    await prompt.getByRole('button', { name: 'Guardar' }).click();

    // Se limpia la búsqueda y luego se recupera con ff.
    await page.getByPlaceholder('Buscar tareas...').fill('');
    await page.waitForTimeout(500);
    await page.locator('h1').click();
    await page.keyboard.press('f');
    await page.keyboard.press('f');

    const picker = page.getByRole('dialog', { name: 'Búsquedas guardadas' });
    await expect(picker).toBeVisible();
    // Dos botones hermanos (aplicar y borrar) comparten texto: se ancla en el de la fila.
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

    // Sin archivo vinculado no hay done.txt hermano que leer.
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
  // Las acciones apagadas sin archivo se listan, pero con el motivo.
  await expect(ayuda).toContainText('Apagados');
});
