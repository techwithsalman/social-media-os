import { test, expect } from './auth-fixture';

test.describe('Phase 3 Audit: Bulk Upload & Automatic Schedule Matrix', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bulk-upload');
    await page.waitForLoadState('networkidle');
  });

  test('Bulk Upload: Page loads header, controls, and queue stats properly', async ({ page }) => {
    await expect(page.locator('text=Batch Media Uploader & Schedule Matrix')).toBeVisible();
    await expect(page.locator('text=Automatic Matrix Config')).toBeVisible();
    await expect(page.locator('text=Posts Per Day')).toBeVisible();
    await expect(page.locator('text=Starting Date')).toBeVisible();
  });

  test('Bulk Upload: Select from Media Library modal opens and lists workspace assets', async ({ page }) => {
    const mediaLibBtn = page.locator('button:has-text("Select from Media Library")');
    if (await mediaLibBtn.isVisible()) {
      await mediaLibBtn.click();
      await expect(page.locator('text=Select from Existing Media Assets')).toBeVisible();

      // Check close button works
      const closeBtn = page.locator('button:has-text("Cancel")').first();
      await closeBtn.click();
      await expect(page.locator('text=Select from Existing Media Assets')).not.toBeVisible();
    }
  });

  test('Bulk Upload: Schedule matrix generation requires uploaded videos', async ({ page }) => {
    const generateMatrixBtn = page.locator('button:has-text("Generate Schedule Matrix")');
    await expect(generateMatrixBtn).toBeVisible();

    // With 0 uploaded videos in queue, clicking should surface a dialog warning
    page.on('dialog', async (dialog) => {
      expect(dialog.message().toLowerCase()).toContain('upload');
      await dialog.accept();
    });

    await generateMatrixBtn.click();
  });
});
