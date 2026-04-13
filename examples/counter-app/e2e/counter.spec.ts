import { test, expect } from '@playwright/test';

test.describe('Counter Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/counter');
  });

  test('displays initial count of 0', async ({ page }) => {
    await expect(page.getByText('0').first()).toBeVisible();
    await expect(page.getByText(/Doubled:\s*0/)).toBeVisible();
  });

  test('increments count when + is clicked', async ({ page }) => {
    await page.getByRole('button', { name: '+' }).click();
    await expect(page.getByText('1').first()).toBeVisible();
    await expect(page.getByText(/Doubled:\s*2/)).toBeVisible();
  });

  test('hides decrement button when count is 0', async ({ page }) => {
    await expect(page.getByRole('button', { name: '-' })).not.toBeVisible();
  });

  test('shows decrement button after incrementing', async ({ page }) => {
    await page.getByRole('button', { name: '+' }).click();
    await expect(page.getByRole('button', { name: '-' })).toBeVisible();
  });

  test('decrements count when - is clicked', async ({ page }) => {
    await page.getByRole('button', { name: '+' }).click();
    await page.getByRole('button', { name: '+' }).click();
    await page.getByRole('button', { name: '-' }).click();
    await expect(page.getByText('1').first()).toBeVisible();
    await expect(page.getByText(/Doubled:\s*2/)).toBeVisible();
  });

  test('resets count to 0 when Reset is clicked', async ({ page }) => {
    await page.getByRole('button', { name: '+' }).click();
    await page.getByRole('button', { name: '+' }).click();
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByText('0').first()).toBeVisible();
    await expect(page.getByText(/Doubled:\s*0/)).toBeVisible();
  });

  test('hides decrement button after resetting', async ({ page }) => {
    await page.getByRole('button', { name: '+' }).click();
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByRole('button', { name: '-' })).not.toBeVisible();
  });

  test('navigates home via the back button', async ({ page }) => {
    await page.getByRole('button', { name: '← Home' }).click();
    await expect(page).toHaveURL('/');
  });

  test('navigates to counter page via the nav link', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Counter' }).click();
    await expect(page).toHaveURL('/counter');
    await expect(page.getByText('Forge Counter')).toBeVisible();
  });
});
