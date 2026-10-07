import { expect, seedTasks, test, waitForList } from './fixtures';

/**
 * El formulario de edición tenía título, descripción, prioridad y fecha límite, y nada
 * más. Los proyectos, los contextos y la recurrencia se podían poner con el teclado pero no
 * a la vista, así que las dos formas de hacer lo mismo no coincidían.
 */
test('los campos que solo se podían poner con el teclado también están a la vista', async ({ page }) => {
  await seedTasks(page, 3);
  await page.goto('/app');
  await waitForList(page);
  await page.locator('h1').click();
  await page.keyboard.press('e');
  await page.locator('#task-start-date').waitFor();

  await page.locator('#task-start-date').fill('2026-11-15');
  await page.locator('#task-projects').fill('verificacion');
  await page.locator('#task-contexts').fill('escritorio');
  await page.locator('#task-recurrence').fill('+3d');

  // Chromium ignores a programmatic assignment to a date input unless it goes through the
  // native setter, so this asserts the value actually landed rather than assuming the fill
  // worked: a test that passes because the field silently stayed empty is worse than none.
  expect(await page.locator('#task-start-date').inputValue()).toBe('2026-11-15');

  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.locator('#task-start-date')).toHaveCount(0);
});
