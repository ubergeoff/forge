import { test, expect } from '@playwright/test';

test.describe('Forms Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forms');
  });

  // ---------------------------------------------------------------------------
  // Demo 1: FormControl & FormGroup — Login
  // ---------------------------------------------------------------------------
  test.describe('Demo 1 — Login form', () => {
    test('Sign in button is disabled initially', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled();
    });

    test('form status is INVALID initially', async ({ page }) => {
      const status = page.locator('form').first().getByText('INVALID');
      await expect(status).toBeVisible();
    });

    test('shows email error after touching with invalid value', async ({ page }) => {
      const emailInput = page.getByPlaceholder('you@example.com');
      await emailInput.fill('not-an-email');
      await emailInput.blur();
      await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    });

    test('shows password error after touching with short value', async ({ page }) => {
      const passwordInput = page.getByPlaceholder('Min 8 characters');
      await passwordInput.fill('short');
      await passwordInput.blur();
      await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible();
    });

    test('Sign in button enables when form is valid', async ({ page }) => {
      await page.getByPlaceholder('you@example.com').fill('user@example.com');
      await page.getByPlaceholder('Min 8 characters').fill('password123');
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    });

    test('shows success message on valid submit', async ({ page }) => {
      await page.getByPlaceholder('you@example.com').fill('user@example.com');
      await page.getByPlaceholder('Min 8 characters').fill('password123');
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByText('✓ Logged in as user@example.com')).toBeVisible();
    });

    test('shows error message when submitting invalid form via Reset then resubmit path', async ({ page }) => {
      // Force submit via keyboard on a touched-invalid form
      await page.getByPlaceholder('you@example.com').fill('bad');
      await page.getByPlaceholder('Min 8 characters').fill('short');
      // markAsTouched is triggered by submitLogin even though button is disabled;
      // we invoke it by pressing Enter inside the form
      await page.getByPlaceholder('Min 8 characters').press('Enter');
      await expect(page.getByText('✗ Please fix the errors above.')).toBeVisible();
    });

    test('Reset clears the form and hides the message', async ({ page }) => {
      await page.getByPlaceholder('you@example.com').fill('user@example.com');
      await page.getByPlaceholder('Min 8 characters').fill('password123');
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByText('✓ Logged in as user@example.com')).toBeVisible();

      await page.getByRole('button', { name: 'Reset' }).first().click();
      await expect(page.getByText('✓ Logged in as user@example.com')).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled();
    });
  });

  // ---------------------------------------------------------------------------
  // Demo 2: FormGroup — patchValue & reset
  // ---------------------------------------------------------------------------
  test.describe('Demo 2 — Profile form (patchValue & reset)', () => {
    test('pre-fills with initial values (Ada Lovelace, 28)', async ({ page }) => {
      await expect(page.getByLabel('First name')).toHaveValue('Ada');
      await expect(page.getByLabel('Last name')).toHaveValue('Lovelace');
      await expect(page.getByLabel('Age (0 – 120)')).toHaveValue('28');
    });

    test('patchValue → Alan Turing fills all four fields', async ({ page }) => {
      await page.getByRole('button', { name: 'patchValue → Alan Turing' }).click();
      await expect(page.getByLabel('First name')).toHaveValue('Alan');
      await expect(page.getByLabel('Last name')).toHaveValue('Turing');
      await expect(page.getByLabel('Age (0 – 120)')).toHaveValue('41');
      await expect(page.getByLabel('Website (must start with http)')).toHaveValue('https://turing.io');
    });

    test('reset() clears all fields to empty / 0', async ({ page }) => {
      await page.getByRole('button', { name: 'reset()' }).click();
      await expect(page.getByLabel('First name')).toHaveValue('');
      await expect(page.getByLabel('Last name')).toHaveValue('');
      await expect(page.getByLabel('Age (0 – 120)')).toHaveValue('0');
      await expect(page.getByLabel('Website (must start with http)')).toHaveValue('');
    });

    test('shows website URL error when value is invalid', async ({ page }) => {
      const websiteInput = page.getByLabel('Website (must start with http)');
      await websiteInput.fill('not-a-url');
      await websiteInput.blur();
      await expect(page.getByText('Must be a valid URL starting with http:// or https://')).toBeVisible();
    });

    test('live snapshot reflects patchValue changes', async ({ page }) => {
      await page.getByRole('button', { name: 'patchValue → Alan Turing' }).click();
      const snapshot = page.locator('div').filter({ hasText: /value:.*Alan.*Turing/ }).first();
      await expect(snapshot).toBeVisible();
    });
  });

  // ---------------------------------------------------------------------------
  // Demo 3: FormArray — dynamic skills
  // ---------------------------------------------------------------------------
  test.describe('Demo 3 — FormArray (dynamic skills)', () => {
    test('starts with 2 skill slots visible', async ({ page }) => {
      await expect(page.getByText('length:')).toBeVisible();
      // Two inputs with placeholder "Skill name (required)" are visible initially
      const inputs = page.getByPlaceholder('Skill name (required)');
      await expect(inputs).toHaveCount(2);
    });

    test('Add skill button adds a third slot', async ({ page }) => {
      await page.getByRole('button', { name: '+ Add skill' }).click();
      const inputs = page.getByPlaceholder('Skill name (required)');
      await expect(inputs).toHaveCount(3);
    });

    test('Add skill is disabled at 5 skills', async ({ page }) => {
      const addBtn = page.getByRole('button', { name: '+ Add skill' });
      await addBtn.click();
      await addBtn.click();
      await addBtn.click();
      await expect(addBtn).toBeDisabled();
    });

    test('Remove last decreases slot count', async ({ page }) => {
      await page.getByRole('button', { name: '+ Add skill' }).click();
      await page.getByRole('button', { name: 'Remove last' }).click();
      const inputs = page.getByPlaceholder('Skill name (required)');
      await expect(inputs).toHaveCount(2);
    });

    test('Remove last is disabled when only 1 skill remains', async ({ page }) => {
      await page.getByRole('button', { name: 'Remove last' }).click();
      await expect(page.getByRole('button', { name: 'Remove last' })).toBeDisabled();
    });

    test('array stats reflect current length', async ({ page }) => {
      await expect(page.getByText(/length:/).first()).toBeVisible();
      // Default length is 2
      const statsPanel = page.locator('div').filter({ hasText: /length:.*2/ }).first();
      await expect(statsPanel).toBeVisible();
    });

    test('initial skills (TypeScript, Signals) are pre-filled', async ({ page }) => {
      const inputs = page.getByPlaceholder('Skill name (required)');
      await expect(inputs.nth(0)).toHaveValue('TypeScript');
      await expect(inputs.nth(1)).toHaveValue('Signals');
    });
  });
});
