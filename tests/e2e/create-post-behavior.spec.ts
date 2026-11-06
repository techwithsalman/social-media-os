import { test, expect } from './auth-fixture';

test.describe('Phase 2: Create Post Realistic & Unexpected User Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/create-post');
    await page.waitForLoadState('networkidle');
  });

  test('User Behavior: Rapid account selection and deselection does not crash UI', async ({ page }) => {
    await expect(page.locator('text=SELECT TARGET CHANNELS')).toBeVisible();

    const toggleAllBtn = page.locator('button:has-text("Select All"), button:has-text("Deselect All")');
    await expect(toggleAllBtn).toBeVisible();

    for (let i = 0; i < 6; i++) {
      await toggleAllBtn.click();
    }

    await expect(page.locator('text=SELECT TARGET CHANNELS')).toBeVisible();
    await expect(page.locator('text=MASTER CAPTION')).toBeVisible();
    await expect(page.locator('text=UPLOAD MEDIA')).toBeVisible();
  });

  test('User Behavior: Deselect all accounts then attempt submit triggers validation gracefully', async ({ page }) => {
    const captionArea = page.locator('textarea[placeholder*="Write your post caption here"]');
    await expect(captionArea).toBeVisible();
    await captionArea.fill('Test resilient caption #socialmedia');

    // Deselect all accounts
    const deselectBtn = page.locator('button:has-text("Deselect All")');
    if (await deselectBtn.isVisible()) {
      await deselectBtn.click();
    }

    // Submit buttons must be disabled
    const postNowBtn = page.locator('button:has-text("Post Now")').first();
    await expect(postNowBtn).toBeDisabled();

    const scheduleBtn = page.locator('button:has-text("Schedule Post")').first();
    await expect(scheduleBtn).toBeDisabled();
  });

  test('User Behavior: Empty caption and no media prevents submission', async ({ page }) => {
    const postNowBtn = page.locator('button:has-text("Post Now")').first();
    await expect(postNowBtn).toBeDisabled();
  });

  test('User Behavior: Clear Form opens confirmation modal and resets composer state when confirmed', async ({ page }) => {
    const captionArea = page.locator('textarea[placeholder*="Write your post caption here"]');
    await expect(captionArea).toBeVisible();
    await captionArea.fill('Caption to be cleared');

    // Click top "Clear Form" button
    const clearBtn = page.locator('button[title*="Clear all inputs and start a fresh blank post"]');
    await clearBtn.click();

    // Modal should appear
    await expect(page.locator('text=Discard In-Progress Post?')).toBeVisible();

    // Click confirm in modal
    const modalConfirmBtn = page.locator('button:has-text("Clear Form")').last();
    await modalConfirmBtn.click();

    await expect(captionArea).toHaveValue('');
    await expect(page.locator('text=SELECT TARGET CHANNELS')).toBeVisible();
  });

  test('User Behavior: Mobile layout responsiveness', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('text=SELECT TARGET CHANNELS')).toBeVisible();
    await expect(page.locator('text=MASTER CAPTION')).toBeVisible();
    await expect(page.locator('text=UPLOAD MEDIA')).toBeVisible();
  });
});
