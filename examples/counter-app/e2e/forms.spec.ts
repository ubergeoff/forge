import { test, expect, type Page, type Locator } from '@playwright/test';

// Vorra's [formControl] binding wires value updates via the native 'input'
// event, and touched state via 'blur'. Playwright's fill() + locator.blur()
// go through CDP and create events in Playwright's own frame context, not the
// page's JS context — so Vorra's addEventListener handlers never fire.
//
// The fix: use locator.evaluate() to create and dispatch events directly
// inside the page's JS context, where they are indistinguishable from real
// browser-generated events.
async function fillControl(locator: Locator, value: string) {
  await locator.fill(value);
  await locator.evaluate((el: HTMLInputElement) =>
    el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
  );
}

async function touchControl(locator: Locator) {
  await locator.evaluate((el: HTMLElement) =>
    el.dispatchEvent(new FocusEvent('blur', { bubbles: false }))
  );
}

// The profile form labels are <label> elements with no for/id association, so
// getByLabel() doesn't resolve them. The CSS adjacent-sibling combinator (+)
// finds the input immediately following the matching label. Playwright's
// :has-text() pseudo-class works inside locator() selectors.
function labelledInput(page: Page, labelText: string) {
  return page.locator(`label:has-text("${labelText}") + input`);
}

// The template always renders all 5 skill slot divs; hidden slots use
// display:none via :show. This locator counts only visible skill inputs.
function visibleSkillInputs(page: Page) {
  return page.locator('input[placeholder="Skill name (required)"]:visible');
}

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
      await expect(page.locator('form').first().getByText('INVALID')).toBeVisible();
    });

    test('shows email error after touching with invalid value', async ({ page }) => {
      const emailInput = page.getByPlaceholder('you@example.com');
      await fillControl(emailInput, 'not-an-email');
      await touchControl(emailInput);
      await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    });

    test('shows password error after touching with short value', async ({ page }) => {
      const passwordInput = page.getByPlaceholder('Min 8 characters');
      await fillControl(passwordInput, 'short');
      await touchControl(passwordInput);
      await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible();
    });

    test('Sign in button enables when form is valid', async ({ page }) => {
      await fillControl(page.getByPlaceholder('you@example.com'), 'user@example.com');
      await fillControl(page.getByPlaceholder('Min 8 characters'), 'password123');
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    });

    test('shows success message on valid submit', async ({ page }) => {
      await fillControl(page.getByPlaceholder('you@example.com'), 'user@example.com');
      await fillControl(page.getByPlaceholder('Min 8 characters'), 'password123');
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByText('✓ Logged in as user@example.com')).toBeVisible();
    });

    test('shows error message after valid submit then corrupting a field', async ({ page }) => {
      // Submit a valid form first so loginSubmitted = true
      await fillControl(page.getByPlaceholder('you@example.com'), 'user@example.com');
      await fillControl(page.getByPlaceholder('Min 8 characters'), 'password123');
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByText('✓ Logged in as user@example.com')).toBeVisible();

      // Corrupt the email — form turns invalid while loginSubmitted stays true
      await fillControl(page.getByPlaceholder('you@example.com'), 'bad-email');
      await expect(page.getByText('✗ Please fix the errors above.')).toBeVisible();
    });

    test('Reset clears the form and hides the message', async ({ page }) => {
      await fillControl(page.getByPlaceholder('you@example.com'), 'user@example.com');
      await fillControl(page.getByPlaceholder('Min 8 characters'), 'password123');
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
      await expect(labelledInput(page, 'First name')).toHaveValue('Ada');
      await expect(labelledInput(page, 'Last name')).toHaveValue('Lovelace');
      await expect(labelledInput(page, 'Age (0 – 120)')).toHaveValue('28');
    });

    test('patchValue → Alan Turing fills all four fields', async ({ page }) => {
      await page.getByRole('button', { name: 'patchValue → Alan Turing' }).click();
      await expect(labelledInput(page, 'First name')).toHaveValue('Alan');
      await expect(labelledInput(page, 'Last name')).toHaveValue('Turing');
      await expect(labelledInput(page, 'Age (0 – 120)')).toHaveValue('41');
      await expect(labelledInput(page, 'Website (must start with http)')).toHaveValue('https://turing.io');
    });

    test('reset() clears all fields to empty / 0', async ({ page }) => {
      await page.getByRole('button', { name: 'reset()' }).click();
      await expect(labelledInput(page, 'First name')).toHaveValue('');
      await expect(labelledInput(page, 'Last name')).toHaveValue('');
      await expect(labelledInput(page, 'Age (0 – 120)')).toHaveValue('0');
      await expect(labelledInput(page, 'Website (must start with http)')).toHaveValue('');
    });

    test('shows website URL error when value is invalid', async ({ page }) => {
      const websiteInput = labelledInput(page, 'Website (must start with http)');
      await fillControl(websiteInput, 'not-a-url');
      await touchControl(websiteInput);
      await expect(page.getByText('Must be a valid URL starting with http:// or https://')).toBeVisible();
    });

    test('live snapshot reflects patchValue changes', async ({ page }) => {
      await page.getByRole('button', { name: 'patchValue → Alan Turing' }).click();
      await expect(page.locator('div').filter({ hasText: /value:.*Alan.*Turing/ }).first()).toBeVisible();
    });
  });

  // ---------------------------------------------------------------------------
  // Demo 3: FormArray — dynamic skills
  // ---------------------------------------------------------------------------
  test.describe('Demo 3 — FormArray (dynamic skills)', () => {
    test('starts with 2 skill slots visible', async ({ page }) => {
      await expect(visibleSkillInputs(page)).toHaveCount(2);
    });

    test('Add skill button adds a third slot', async ({ page }) => {
      await page.getByRole('button', { name: '+ Add skill' }).click();
      await expect(visibleSkillInputs(page)).toHaveCount(3);
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
      await expect(visibleSkillInputs(page)).toHaveCount(2);
    });

    test('Remove last is disabled when only 1 skill remains', async ({ page }) => {
      await page.getByRole('button', { name: 'Remove last' }).click();
      await expect(page.getByRole('button', { name: 'Remove last' })).toBeDisabled();
    });

    test('array stats reflect current length', async ({ page }) => {
      await expect(page.locator('div').filter({ hasText: /length:.*2/ }).first()).toBeVisible();
    });

    test('initial skills (TypeScript, Signals) are pre-filled', async ({ page }) => {
      await expect(visibleSkillInputs(page).nth(0)).toHaveValue('TypeScript');
      await expect(visibleSkillInputs(page).nth(1)).toHaveValue('Signals');
    });
  });
});
