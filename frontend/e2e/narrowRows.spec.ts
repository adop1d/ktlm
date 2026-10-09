import type { Page } from '@playwright/test';
import { expect, seedTasks, test, waitForList } from './fixtures';

/**
 * A narrow list must not eat the title.
 *
 * The title column is the flexible one, so when the box narrows it is what collapses. Under
 * the threshold the meta drops to its own line instead, and the dates keep theirs.
 *
 * What is measured is the meta's width rather than the number of lines: `align-items:
 * baseline` gives each cell a slightly different `top` even when they share a line, so
 * counting distinct tops reports three lines on a row that has one.
 */
const medidas = (page: Page) =>
  page.locator('.tui-row').nth(1).evaluate((el) => {
    const fila = el.getBoundingClientRect();
    const meta = el.querySelector('.tui-row-meta')?.getBoundingClientRect();
    const titulo = el.querySelector('.tui-row-title')?.getBoundingClientRect();
    return {
      filaAncho: Math.round(fila.width),
      metaAncho: meta ? Math.round(meta.width) : 0,
      tituloAncho: titulo ? Math.round(titulo.width) : 0,
      alto: Math.round(fila.height),
    };
  });

test.describe('filas estrechas', () => {
  test('con ancho normal el título ocupa y la meta va a su derecha', async ({ page }) => {
    await seedTasks(page, 3);
    await page.goto('/app');
    await waitForList(page);

    const m = await medidas(page);
    // The bug this pins: with the line-number index out of the grid flow every cell shifted
    // one track left and the title inherited the priority column — 24px wide.
    expect(m.tituloAncho).toBeGreaterThan(180);
    expect(m.metaAncho).toBeLessThan(m.filaAncho);
  });

  test('en una caja estrecha la meta baja de línea y el título sobrevive', async ({ page }) => {
    await seedTasks(page, 3);
    await page.goto('/app');
    await waitForList(page);

    // The width is applied to the list itself, not the window: it is the box that has to
    // cope. A viewport media query would not have seen this case at all.
    await page.locator('.tui-list').evaluate((el) => {
      (el as HTMLElement).style.width = '22rem';
    });
    await page.waitForTimeout(250);

    const m = await medidas(page);
    // Wrapped: the meta spans the row's content box. Not `toBe(filaAncho)`, because the row
    // has horizontal padding and the meta fills what is inside it, not the border box.
    expect(m.metaAncho).toBeGreaterThan(m.filaAncho * 0.9);
    // And the title is still worth reading.
    expect(m.tituloAncho).toBeGreaterThan(90);
  });
});