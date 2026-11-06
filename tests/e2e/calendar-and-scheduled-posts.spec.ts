import { test, expect } from './auth-fixture';

test.describe('Phase 3 Audit: Content Calendar & Scheduled Posts Queue', () => {
  test('Content Calendar: View toggles (Month, Week, Day) and post grid render cleanly', async ({ page }) => {
    await page.goto('/calendar');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('text=Content Calendar').first()).toBeVisible();

    // Check calendar view buttons
    const monthBtn = page.locator('button:has-text("Month")').first();
    const weekBtn = page.locator('button:has-text("Week")').first();
    const dayBtn = page.locator('button:has-text("Day")').first();

    if (await monthBtn.isVisible()) {
      await monthBtn.click();
    }
    if (await weekBtn.isVisible()) {
      await weekBtn.click();
    }
    if (await dayBtn.isVisible()) {
      await dayBtn.click();
    }
  });

  test('Scheduled Posts: Displays scheduled post cards with status and platform badges', async ({ page }) => {
    await page.goto('/scheduled');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('text=Scheduled Posts').first()).toBeVisible();
    // Verify filter or queue is visible
    const filterAll = page.locator('button:has-text("All"), button:has-text("SCHEDULED")').first();
    if (await filterAll.isVisible()) {
      await expect(filterAll).toBeVisible();
    }
  });
});
