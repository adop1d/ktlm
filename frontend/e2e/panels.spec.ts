import { expect, seedTasks, test, waitForList } from './fixtures';

/** `[` and `]` open the side panels, same as in tuxedo. */
test.describe('paneles laterales', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await waitForList(page);
  });

  test('[ abre el panel de filtros y ] el de detalle', async ({ page }) => {
    await expect(page.getByRole('complementary', { name: 'Filtros' })).toHaveCount(0);

    await page.keyboard.press('[');
    await expect(page.getByRole('complementary', { name: 'Filtros' })).toBeVisible();

    await page.keyboard.press(']');
    await expect(page.getByRole('complementary', { name: 'Detalle' })).toBeVisible();

    // both at once: three columns
    const clases = await page.locator('.tui-body').getAttribute('class');
    expect(clases).toContain('tui-body--both');
  });

  test('el panel de filtros lista proyectos y contextos con su cuenta', async ({ page }) => {
    await page.keyboard.press('[');

    const panel = page.getByRole('complementary', { name: 'Filtros' });
    await expect(panel.getByRole('button', { name: '+salud' })).toBeVisible();
    await expect(panel.getByRole('button', { name: '@oficina' })).toBeVisible();
  });

  test('elegir un proyecto filtra la lista', async ({ page }) => {
    await page.keyboard.press('[');
    await page.getByRole('complementary', { name: 'Filtros' }).getByRole('button', { name: '+salud' }).click();

    // The backend receives the filter and returns only that project.
    await expect(page.locator('.tui-row')).toHaveCount(2);
  });

  test('el panel de detalle enseña la línea tal cual va al archivo', async ({ page }) => {
    await page.keyboard.press(']');

    const panel = page.getByRole('complementary', { name: 'Detalle' });
    await expect(panel).toBeVisible();
    await expect(panel.getByText('uid:')).toBeVisible();
  });

  test('los paneles se cierran con la misma tecla', async ({ page }) => {
    await page.keyboard.press('[');
    await expect(page.getByRole('complementary', { name: 'Filtros' })).toBeVisible();
    await page.keyboard.press('[');
    await expect(page.getByRole('complementary', { name: 'Filtros' })).toHaveCount(0);
  });

  test('la barra de estado está pegada al borde inferior de la ventana', async ({ page }) => {
    const barra = page.locator('.tui-status');
    await expect(barra).toBeVisible();

    const caja = await barra.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { bottom: Math.round(r.bottom), alto: window.innerHeight };
    });
    // The difference is subpixel rounding, not positioning.
    expect(Math.abs(caja.bottom - caja.alto)).toBeLessThanOrEqual(1);
  });

  test('el modal de ayuda queda centrado y dentro de la ventana', async ({ page }) => {
    await page.keyboard.press('?');

    const modal = page.getByRole('dialog', { name: 'Atajos de teclado' });
    await expect(modal).toBeVisible();

    const caja = await modal.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, viewportH: window.innerHeight };
    });
    expect(caja.top).toBeGreaterThanOrEqual(0);
    expect(caja.bottom).toBeLessThanOrEqual(caja.viewportH + 1);
  });
});

test.describe('la lista se lee como una rejilla de terminal', () => {
  test('cada fila tiene columnas alineadas y la fuente es monoespaciada', async ({ page, api }) => {
    api.tasks = seedTasks(3, 'Informe');
    await page.goto('/app');
    await waitForList(page);

    const fila = page.locator('.tui-row').first();
    const estilos = await fila.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { display: cs.display, columnas: cs.gridTemplateColumns, gap: cs.columnGap };
    });
    expect(estilos.display).toBe('grid');
    // Four columns: index, priority, body and metadata.
    expect(estilos.columnas.split(' ')).toHaveLength(4);
    expect(Number.parseFloat(estilos.gap)).toBeGreaterThan(0);

    const fuente = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(fuente).toContain('Inconsolata Nerd Font');
  });

  test('la fila con el cursor queda marcada', async ({ page }) => {
    await page.goto('/app');
    await waitForList(page);

    await expect(page.locator('.tui-row--cursor')).toHaveCount(1);
    await page.keyboard.press('j');
    await expect(page.locator('.tui-row--cursor')).toHaveCount(1);
    // The one that was marked no longer is.
    await expect(page.locator('.tui-row').first()).not.toHaveClass(/tui-row--cursor/);
  });
});