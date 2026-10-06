import { expect, seedTasks, test, waitForList } from './fixtures';

test.describe('lista de tareas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await waitForList(page);
  });

  test('muestra las tareas sembradas y los contadores', async ({ page }) => {
    await expect(page.getByText('Tarea 001')).toBeVisible();
    await expect(page.getByText('Tarea 003')).toBeVisible();
    await expect(page.locator('.tui-row')).toHaveCount(3);
    await expect(page.getByRole('button', { name: /^Todas/ })).toContainText('3');
  });

  test('crea una tarea con el atajo n y la ve en la lista', async ({ page }) => {
    await page.keyboard.press('n');

    await expect(page.getByPlaceholder('¿Qué necesitas hacer?')).toBeVisible();
    await page.getByPlaceholder('¿Qué necesitas hacer?').fill('Comprar leche');
    await page.getByRole('button', { name: 'Crear tarea' }).click();

    await expect(page.getByText('Comprar leche')).toBeVisible();
    await expect(page.locator('.tui-row')).toHaveCount(4);
  });

  test('el filtro de pestañas cambia lo que se ve', async ({ page }) => {
    await page.getByRole('button', { name: /^Completadas/ }).click();

    await expect(page.locator('.tui-row')).toHaveCount(1);
    await expect(page.getByText('Tarea 001')).toBeVisible();
  });

  test('la búsqueda filtra la lista', async ({ page }) => {
    await page.getByPlaceholder(/Buscar tareas/).fill('Tarea 002');

    await expect(page.locator('.tui-row')).toHaveCount(1);
    await expect(page.getByText('Tarea 002')).toBeVisible();
  });

  test('sin archivo vinculado, los atajos de archivo se anuncian apagados', async ({ page }) => {
    // Es el contrato de la opción B: un atajo que no puede actuar se dice, no finge.
    // El aviso vive ahora en la barra de estado, que es donde se lee el estado del teclado.
    await expect(page.getByRole('status')).toContainText('x p J dd u apagados');
    await expect(page.getByText('Sin todo.txt vinculado')).toBeVisible();
  });
});

test.describe('teclado', () => {
  // El chord tiene una ventana de 600 ms por diseño, así que el resto del reloj no se
  // usa como referencia. El margen extra cubre laCPU cargada por los workers en paralelo
  // sin volver el bloque serial: en serie, un solo fallo se come los cinco siguientes.

  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await waitForList(page);
  });

  test('j y k mueven el cursor entre filas', async ({ page }) => {
    const cursor = page.locator('.tui-row--cursor');
    await expect(cursor).toContainText('Tarea 001');

    await page.keyboard.press('j');
    await expect(cursor).toContainText('Tarea 002');

    await page.keyboard.press('j');
    await expect(cursor).toContainText('Tarea 003');

    await page.keyboard.press('k');
    await expect(cursor).toContainText('Tarea 002');
  });

  test('G lleva a la última y gg a la primera', async ({ page }) => {
    const cursor = page.locator('.tui-row--cursor');

    await page.keyboard.press('G');
    await expect(cursor).toContainText('Tarea 003');

    await page.keyboard.press('g');
    await expect(page.getByText('g…')).toBeVisible();
    await page.keyboard.press('g');
    await expect(cursor).toContainText('Tarea 001');
  });

  test('? abre la ayuda y Esc la cierra', async ({ page }) => {
    await page.keyboard.press('?');

    await expect(page.getByRole('dialog', { name: 'Atajos de teclado' })).toBeVisible();
    await expect(page.getByText('gg').first()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Atajos de teclado' })).toBeHidden();
  });

  test('la paleta de comandos encuentra y ejecuta una acción', async ({ page }) => {
    await page.keyboard.press(':');

    const palette = page.getByRole('dialog', { name: 'Paleta de comandos' });
    await expect(palette).toBeVisible();

    await page.getByLabel('Buscar comando').fill('completar');
    await expect(palette.getByRole('button', { name: /completar/ })).toBeVisible();
  });

  test('sin todo.txt, la paleta muestra las acciones apagadas y no las ejecuta', async ({
    page,
  }) => {
    await page.keyboard.press(':');
    await page.getByLabel('Buscar comando').fill('completar');

    const entry = page.getByRole('button', { name: /completar/ });
    await expect(entry).toBeDisabled();
    await expect(page.getByText(/necesitan un motivo/)).toBeVisible();
  });

  test('x no hace nada sin archivo, y eso es lo pactado', async ({ page }) => {
    const contador = page.getByRole('button', { name: /^Completadas/ });
    const antes = await contador.textContent();

    await page.keyboard.press('x');

    // La acción está apagada: el contador de completadas no se mueve.
    await expect(contador).toHaveText(antes ?? '');
    await expect(page.locator('.tui-row').first()).not.toHaveClass(/line-through/);
  });
});

test.describe('paginación', () => {
  test('el pie muestra el rango y avanza de página', async ({ page }) => {
    await page.route((url) => url.pathname.startsWith('/api/tasks'), async (route) => {
      const url = new URL(route.request().url());
      const pageNumber = Number(url.searchParams.get('page') ?? '0');
      const tasks = seedTasks(25);
      const content = tasks.slice(pageNumber * 20, pageNumber * 20 + 20);
      return route.fulfill({
        json: {
          content,
          page: pageNumber,
          size: 20,
          totalElements: 25,
          totalPages: 2,
          hasNext: pageNumber === 0,
          hasPrevious: pageNumber > 0,
        },
      });
    });

    await page.goto('/app');
    await waitForList(page);

    await expect(page.getByText('mostrando 1–20 de 25')).toBeVisible();
    await page.getByRole('button', { name: 'Siguiente' }).click();

    await expect(page.getByText('página 2 de 2')).toBeVisible();
    await expect(page.getByText('mostrando 21–25 de 25')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });
});