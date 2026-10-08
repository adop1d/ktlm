import { expect, seedTasks, test, waitForList } from './fixtures';

/**
 * Shortcuts that were not quite right: `e`/`i` opened a blank form instead of editing the
 * task under the cursor, and `S`, `yy` and `yb` did nothing.
 */
test.describe('atajos que faltaban o estaban mal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await waitForList(page);
    // Focus must not sit in a field, or the keystrokes would go there instead of to the engine.
    await page.locator('h1').click();
  });

  test('S cicla el orden', async ({ page }) => {
    const selector = page.getByRole('combobox');
    await expect(selector).toHaveValue('file');

    await page.keyboard.press('S');
    await expect(selector).toHaveValue('priority');

    await page.keyboard.press('S');
    await expect(selector).toHaveValue('due');

    // The cycle returns to the file order.
    await page.keyboard.press('S');
    await expect(selector).toHaveValue('file');
  });

  test('e edita la línea de la tarea del cursor, no una vacía', async ({ page }) => {
    await page.keyboard.press('e');

    // `e` opens the line editor, which shows the line as the file will hold it rather than
    // as labelled boxes. The title of the first row is the cursor's, and it is already
    // there: opening blank under an edit key was the bug this replaced.
    const titulo = page.getByLabel('Título de la tarea');
    await expect(titulo).toBeVisible();
    await expect(titulo).toHaveValue(seedTasks(3)[0].title);
  });

  test('E abre el formulario con la tarea del cursor, no uno vacío', async ({ page }) => {
    await page.keyboard.press('E');

    const campo = page.getByPlaceholder('¿Qué necesitas hacer?');
    await expect(campo).toBeVisible();
    await expect(campo).toHaveValue(seedTasks(3)[0].title);
  });

  test('n sí abre el formulario vacío', async ({ page }) => {
    await page.keyboard.press('n');

    const campo = page.getByPlaceholder('¿Qué necesitas hacer?');
    await expect(campo).toBeVisible();
    // And the `n` is not typed inside: the key belongs to the engine, not the field.
    await expect(campo).toHaveValue('');
  });

  test('sin archivo vinculado, yy e yb están apagados como x', async ({ page }) => {
    await page.keyboard.press('y');
    await page.keyboard.press('y');
    await page.keyboard.press('y');
    await page.keyboard.press('b');

    // Without a uid there is no line to copy, so it says nothing: same as `x` with the list.
    await expect(page.getByText('Línea copiada')).toHaveCount(0);
    await expect(page.getByText('Texto copiado')).toHaveCount(0);
  });
});