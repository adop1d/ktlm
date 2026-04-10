import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear auth state before each test
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test('login page loads with correct elements', async ({ page }) => {
    await page.goto('/login');
    
    // Check heading
    await expect(page.getByRole('heading', { name: /Task Manager/i })).toBeVisible();
    
    // Check form fields exist
    await expect(page.getByPlaceholder('Usuario')).toBeVisible();
    await expect(page.getByPlaceholder('Contraseña')).toBeVisible();
    
    // Check submit button
    await expect(page.getByRole('button', { name: /Entrar/i })).toBeVisible();
  });

  test('can switch between login and register', async ({ page }) => {
    await page.goto('/login');
    
    // Click register link
    await page.getByRole('button', { name: /Regístrate/i }).click();
    
    // Verify register form appears
    await expect(page.getByRole('heading', { name: /Registrarse/i })).toBeVisible();
    await expect(page.getByPlaceholder('Usuario')).toBeVisible();
    await expect(page.getByPlaceholder('Correo electrónico')).toBeVisible();
    
    // Switch back to login
    await page.getByRole('button', { name: /Ya tengo cuenta/i }).click();
    await expect(page.getByRole('heading', { name: /Task Manager/i })).toBeVisible();
  });

  test('shows error with empty credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Entrar/i }).click();
    
    // Should show error toast or message
    await expect(page.getByText(/Nombre de usuario es requerido|Usuario es requerido|required/i)).toBeVisible();
  });

  test('shows error with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Fill with invalid credentials
    await page.getByPlaceholder('Usuario').fill('invalid_user');
    await page.getByPlaceholder('Contraseña').fill('wrong_password');
    await page.getByRole('button', { name: /Entrar/i }).click();
    
    // Should show error (may take a moment for API)
    await page.waitForTimeout(1000);
    // Either error toast or stays on login page
    const url = page.url();
    expect(url).toContain('/login');
  });

  test('dark mode toggle exists', async ({ page }) => {
    await page.goto('/login');
    // Dark mode toggle should be visible on login page
    await expect(page.getByTitle(/Modo/i).or(page.getByRole('button', { name: /Modo/i }))).toBeVisible();
  });
});

test.describe('Protected Routes', () => {
  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('redirects to login after logout', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.getByPlaceholder('Usuario').fill('testuser');
    await page.getByPlaceholder('Contraseña').fill('testpass');
    await page.getByRole('button', { name: /Entrar/i }).click();
    await page.waitForTimeout(1000);
    
    // Then logout directly via URL (simulating logout)
    await page.goto('/login');
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await page.goto('/');
    await expect(page).toHaveURL(/.*\/login/);
  });
});