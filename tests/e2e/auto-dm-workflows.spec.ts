import { test, expect } from './auth-fixture';

test.describe('Phase 3 Audit: Auto DM Automation Modules (Instagram & Facebook)', () => {
  test('Instagram Auto DM: Page loads active rules and activity views', async ({ page }) => {
    await page.goto('/instagram-auto-dm');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("Instagram Auto DM")')).toBeVisible();
    await expect(page.locator('a:has-text("Create Automation")').first()).toBeVisible();

    // Check tabs or activity link
    const activityLink = page.locator('a[href*="/instagram-auto-dm/activity"]').first();
    await expect(activityLink).toBeVisible();
    await activityLink.click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('text=Activity').first()).toBeVisible();
  });

  test('Facebook Auto DM: Page loads active rules and activity views', async ({ page }) => {
    await page.goto('/facebook-auto-dm');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("Facebook Auto DM")')).toBeVisible();
    await expect(page.locator('a:has-text("Create Automation")').first()).toBeVisible();

    // Check activity navigation
    const activityLink = page.locator('a[href*="/facebook-auto-dm/activity"]').first();
    await expect(activityLink).toBeVisible();
    await activityLink.click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('text=Activity').first()).toBeVisible();
  });
});
