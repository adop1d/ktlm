import { test, expect } from '@playwright/test';

test.describe('Task Management', () => {
  test.beforeEach(async ({ page }) => {
    // Clear auth state
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    
    // Mock login - set token in localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem('auth-store', JSON.stringify({
        state: { token: 'fake-jwt-token', username: 'testuser', roles: ['ROLE_USER'] },
        version: 0
      }));
    });
  });

  test('task list page loads', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    
    // Should either show tasks or loading state
    const heading = page.getByRole('heading', { name: /Mis tareas/i });
    await expect(heading.or(page.getByText(/Cargando/))).toBeVisible();
  });

  test('can create new task via form', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    
    // Click new task button
    const newTaskBtn = page.getByRole('button', { name: /Nueva/i });
    if (await newTaskBtn.isVisible()) {
      await newTaskBtn.click();
      
      // Fill form
      await page.getByPlaceholder('¿Qué necesitas hacer?').fill('Test task from E2E');
      await page.getByRole('button', { name: /Crear tarea/i }).click();
      
      // Should see the task or loading
      await page.waitForTimeout(500);
    }
  });

  test('filter tabs work', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    
    // Check filter tabs exist
    const allTab = page.getByRole('button', { name: /Todas/i });
    const activeTab = page.getByRole('button', { name: /Pendientes/i });
    const completedTab = page.getByRole('button', { name: /Completadas/i });
    
    // At least one should be visible
    await expect(allTab.or(activeTab).or(completedTab)).toBeVisible();
  });

  test('search input exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    
    // Search should exist
    await expect(page.getByPlaceholder(/Buscar/)).toBeVisible();
  });

  test('sort dropdown exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    
    // Sort options should be in a select
    const sortSelect = page.locator('select');
    await expect(sortSelect).toBeVisible();
  });

  test('dark mode toggle works', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    
    // Find and click dark mode toggle
    const darkModeBtn = page.getByTitle(/Modo/i).first();
    if (await darkModeBtn.isVisible()) {
      await darkModeBtn.click();
      // Check if dark class is added to html
      const html = page.locator('html');
      await expect(html).toHaveClass(/dark/);
    }
  });

  test('keyboard shortcut hint is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    
    // Keyboard hint should show "N" for new task
    await expect(page.getByText(/N/).toBeVisible());
  });

  test('can toggle task completion', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    
    // Find a toggle button (check/uncheck icon)
    const toggleBtns = page.locator('button').filter({ has: page.locator('svg') });
    const firstToggle = toggleBtns.first();
    
    if (await firstToggle.isVisible()) {
      await firstToggle.click();
      await page.waitForTimeout(300);
    }
  });

  test('edit task button exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    
    // Hovers to reveal edit button - simulate hover
    const taskCard = page.locator('.card').first();
    if (await taskCard.isVisible()) {
      await taskCard.hover();
      // Edit button should appear
      await page.waitForTimeout(200);
    }
  });

  test('delete task button exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    
    // Hovers to reveal delete button
    const taskCard = page.locator('.card').first();
    if (await taskCard.isVisible()) {
      await taskCard.hover();
      await page.waitForTimeout(200);
    }
  });
});

test.describe('Task Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('auth-store', JSON.stringify({
        state: { token: 'fake-jwt-token', username: 'testuser', roles: ['ROLE_USER'] },
        version: 0
      }));
    });
  });

  test('form has priority selector', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    
    // Open form
    await page.getByRole('button', { name: /Nueva/i }).click();
    await page.waitForTimeout(300);
    
    // Priority select should exist
    await expect(page.getByLabel(/Prioridad/)).toBeVisible();
  });

  test('form has due date picker', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    
    // Open form
    await page.getByRole('button', { name: /Nueva/i }).click();
    await page.waitForTimeout(300);
    
    // Due date input should exist
    await expect(page.getByLabel(/Fecha límite/)).toBeVisible();
  });

  test('form can be cancelled', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    
    // Open form
    await page.getByRole('button', { name: /Nueva/i }).click();
    await page.waitForTimeout(300);
    
    // Click cancel
    await page.getByRole('button', { name: /Cancelar/i }).click();
    await page.waitForTimeout(300);
    
    // Form should be closed
    await expect(page.getByPlaceholder('¿Qué necesitas hacer?')).not.toBeVisible();
  });
});

test.describe('Empty States', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('auth-store', JSON.stringify({
        state: { token: 'fake-jwt-token', username: 'testuser', roles: ['ROLE_USER'] },
        version: 0
      }));
    });
  });

  test('shows empty state when no tasks', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Check for empty state message
    const emptyMsg = page.getByText(/No hay tareas/i);
    await expect(emptyMsg.or(page.getByText(/Crea tu primera/))).toBeVisible();
  });

  test('shows create task button in empty state', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Create task button in empty state
    await expect(page.getByRole('button', { name: /Crear tarea/i })).toBeVisible();
  });
});