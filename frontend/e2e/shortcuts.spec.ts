import { expect, seedTasks, test, waitForList } from './fixtures';

/**
 * Atajos que no estaban bien del todo: `e`/`i` abrían el formulario en blanco en vez de
 * editar la tarea del cursor, y `S`, `yy` y `yb` no hacían nada.
 */
test.describe('atajos que faltaban o estaban mal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await waitForList(page);
    // El foco no puede quedar en un campo, o las teclas irían ahí y no al motor.
    await page.locator('h1').click();
  });

  test('S cicla el orden', async ({ page }) => {
    const selector = page.getByRole('combobox');
    await expect(selector).toHaveValue('file');

    await page.keyboard.press('S');
    await expect(selector).toHaveValue('priority');

    await page.keyboard.press('S');
    await expect(selector).toHaveValue('due');

    // El ciclo vuelve al orden del archivo.
    await page.keyboard.press('S');
    await expect(selector).toHaveValue('file');
  });

  test('e abre el formulario con la tarea del cursor, no uno vacío', async ({ page }) => {
    await page.keyboard.press('e');

    const campo = page.getByPlaceholder('¿Qué necesitas hacer?');
    await expect(campo).toBeVisible();
    // La primera fila es la del cursor, y su título es el de la semilla.
    await expect(campo).toHaveValue(seedTasks(3)[0].title);
  });

  test('n sí abre el formulario vacío', async ({ page }) => {
    await page.keyboard.press('n');

    const campo = page.getByPlaceholder('¿Qué necesitas hacer?');
    await expect(campo).toBeVisible();
    // Y la `n` no se escribe dentro: la tecla es del motor, no del campo.
    await expect(campo).toHaveValue('');
  });

  test('sin archivo vinculado, yy e yb están apagados como x', async ({ page }) => {
    await page.keyboard.press('y');
    await page.keyboard.press('y');
    await page.keyboard.press('y');
    await page.keyboard.press('b');

    // Sin uid no hay línea que copiar, así que no dice nada: igual que `x` con la lista.
    await expect(page.getByText('Línea copiada')).toHaveCount(0);
    await expect(page.getByText('Texto copiado')).toHaveCount(0);
  });
});