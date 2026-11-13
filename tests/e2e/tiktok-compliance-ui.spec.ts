import { test, expect } from './auth-fixture';
import path from 'path';

test.describe('TikTok Direct Post Audit Compliance & Real Browser UI Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept upload presigned to test deduplication & satisfy video attachment
    await page.route('**/api/upload/presigned', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          alreadyExists: true,
          media: {
            id: 'mock_video_dedup_001',
            url: 'https://cdn.example.com/test-compliance-video.mp4',
            mimeType: 'video/mp4',
            originalName: 'compliance_test.mp4',
            filename: 'compliance_test.mp4',
            size: 1048576,
          },
        }),
      });
    });

    await page.goto('/create-post');
    await page.waitForLoadState('domcontentloaded');
  });

  test('Check 1-8: Real Browser UI Verification of all Compliance States, Prompts, Preview, and Confirmation Modal', async ({ page }) => {
    // 1. Wait for connected accounts to finish loading
    await expect(page.locator('text=SELECT TARGET CHANNELS')).toBeVisible();
    await expect(page.locator('text=Loading connected accounts...')).toHaveCount(0, { timeout: 15000 });

    // Ensure clean account selection state: Deselect all first
    const deselectBtn = page.locator('button:has-text("Deselect All")');
    if (await deselectBtn.isVisible()) {
      await deselectBtn.click();
    } else {
      const selectAllBtn = page.locator('button:has-text("Select All")');
      if (await selectAllBtn.isVisible()) {
        await selectAllBtn.click();
        await page.locator('button:has-text("Deselect All")').click();
      }
    }

    // Select TikTok account only
    const tiktokCard = page.locator('[data-account-platform="TIKTOK"]').first();
    await expect(tiktokCard).toBeVisible();
    await tiktokCard.click();

    // 7. Verify Live Platform Preview Bug Fix Remains Intact:
    // When only TikTok is selected, preview strictly displays TikTok branding and Salman Khan (@salmaneditz25),
    // NEVER Instagram or Funny Veggie AI (@funnyveggieai24)
    const activePreview = page.locator('[data-testid="preview-active-container"]');
    await expect(activePreview).toBeVisible();
    await expect(activePreview).toHaveAttribute('data-preview-platform', 'TIKTOK');
    await expect(activePreview.locator('[data-testid="preview-account-username"]')).toContainText('@salmaneditz25');
    await expect(activePreview.locator('text=@funnyveggieai24')).toHaveCount(0);
    await expect(activePreview.locator('text=Funny Veggie AI')).toHaveCount(0);

    // 8. Upload Video Media File to satisfy Direct Post requirements via deduplication route
    const testVideoPath = path.resolve(process.cwd(), 'public/uploads/1789386327708-1b1xlu.mp4');
    await page.locator('input[type="file"]').first().setInputFiles(testVideoPath);

    // Wait for media file card to appear in UI
    await expect(page.locator('text=compliance_test.mp4')).toBeVisible({ timeout: 15000 });

    // Scroll to TikTok Settings section
    const tiktokSettingsSection = page.locator('span:has-text("TikTok Settings")');
    await expect(tiktokSettingsSection).toBeVisible();

    // Select valid privacy level (Public to Everyone)
    const privacySelect = page.locator('select:has(option[value="PUBLIC_TO_EVERYONE"])');
    await expect(privacySelect).toBeVisible();
    await privacySelect.selectOption('PUBLIC_TO_EVERYONE');

    // Fill caption
    const captionArea = page.locator('textarea[placeholder*="Write your post caption here"]');
    await captionArea.fill('TikTok Direct Post compliance browser test #fyp');

    // =========================================================================
    // STATE 1: NORMAL CONTENT (Commercial Content Disclosure OFF by default)
    // =========================================================================
    const commercialToggle = page.locator('#tiktok-commercial-toggle');
    await expect(commercialToggle).toBeVisible();
    await expect(commercialToggle).not.toBeChecked();

    // Point 4 Declaration for Normal Content in main form
    const declaration = page.locator('[data-tiktok-compliance-declaration="true"]').first();
    await expect(declaration).toBeVisible();
    await expect(declaration).toHaveAttribute('data-declaration-type', 'NORMAL');

    // 1 & 6. Verify clickable Music Usage Confirmation link & URL
    const musicLink = declaration.locator('a:has-text("Music Usage Confirmation")');
    await expect(musicLink).toBeVisible();
    await expect(musicLink).toHaveAttribute('href', 'https://www.tiktok.com/legal/page/global/music-usage-confirmation/en');

    // Verify Terms of Service link & URL
    const tosLink = declaration.locator('a:has-text("Terms of Service")');
    await expect(tosLink).toBeVisible();
    await expect(tosLink).toHaveAttribute('href', 'https://www.tiktok.com/legal/page/global/terms-of-service/en');

    // Verify Community Guidelines link & URL
    const cgLink = declaration.locator('a:has-text("Community Guidelines")');
    await expect(cgLink).toBeVisible();
    await expect(cgLink).toHaveAttribute('href', 'https://www.tiktok.com/community-guidelines/en');

    // 1. Verify confirmation modal has Music Usage Confirmation before final publish action
    const postNowBtn = page.locator('button:has-text("Post Now")').first();
    await expect(postNowBtn).toBeEnabled();
    await postNowBtn.click();

    // Modal appears
    const modalHeading = page.locator('h4:has-text("Publish this content to")');
    await expect(modalHeading).toBeVisible();
    const modalDeclaration = page.locator('div[data-tiktok-compliance-declaration="true"]').last();
    await expect(modalDeclaration).toBeVisible();
    await expect(modalDeclaration.locator('a:has-text("Music Usage Confirmation")')).toBeVisible();
    await expect(modalDeclaration.locator('a:has-text("Terms of Service")')).toBeVisible();

    // Close modal
    await page.locator('button:has-text("Cancel")').last().click();
    await expect(modalHeading).toBeHidden();

    // =========================================================================
    // STATE 2: COMMERCIAL DISCLOSURE ON, NEITHER OPTION CHECKED
    // =========================================================================
    await commercialToggle.check({ force: true });
    await expect(commercialToggle).toBeChecked();

    // 2 & 4. Verify exact incomplete disclosure prompt and blocked buttons
    const incompletePrompt = page.locator('text=You need to indicate if your content promotes yourself, a third party, or both.').first();
    await expect(incompletePrompt).toBeVisible();
    await expect(postNowBtn).toBeDisabled();
    await expect(page.locator('button:has-text("Schedule Post")').first()).toBeDisabled();

    // =========================================================================
    // STATE 3: "YOUR BRAND" SELECTED ONLY
    // =========================================================================
    const yourBrandCheckbox = page.locator('label:has-text("Your brand") input[type="checkbox"]');
    await yourBrandCheckbox.check({ force: true });
    await expect(yourBrandCheckbox).toBeChecked();

    // 2. Exact official prompt for Your Brand
    const yourBrandPrompt = page.locator('text=Your photo/video will be labeled as \'Promotional content\'').first();
    await expect(yourBrandPrompt).toBeVisible();

    // Point 4 Declaration for Your Brand
    await expect(declaration).toHaveAttribute('data-declaration-type', 'YOUR_BRAND');
    await expect(declaration.locator('a:has-text("Music Usage Confirmation")')).toBeVisible();
    await expect(declaration.locator('a:has-text("Branded Content Policy")')).toHaveCount(0);
    await expect(postNowBtn).toBeEnabled();

    // =========================================================================
    // STATE 4: "BRANDED CONTENT" SELECTED ONLY
    // =========================================================================
    await yourBrandCheckbox.uncheck({ force: true });
    const brandedCheckbox = page.locator('label:has-text("Branded content") input[type="checkbox"]');
    await brandedCheckbox.check({ force: true });
    await expect(brandedCheckbox).toBeChecked();

    // 2. Exact official prompt for Branded Content
    const brandedPrompt = page.locator('text=Your photo/video will be labeled as \'Paid partnership\'').first();
    await expect(brandedPrompt).toBeVisible();

    // Point 4 Declaration for Branded Content
    await expect(declaration).toHaveAttribute('data-declaration-type', 'BRANDED_CONTENT');
    const bcPolicyLink = declaration.locator('a:has-text("Branded Content Policy")');
    await expect(bcPolicyLink).toBeVisible();
    await expect(bcPolicyLink).toHaveAttribute('href', 'https://www.tiktok.com/legal/page/global/bc-policy/en');
    await expect(declaration.locator('a:has-text("Music Usage Confirmation")')).toBeVisible();

    // 5. Verify Only Me is unavailable / disabled for Branded Content
    const onlyMeOption = privacySelect.locator('option[value="SELF_ONLY"]');
    await expect(onlyMeOption).toBeDisabled();
    await expect(page.locator('text=Branded content visibility cannot be set to private.')).toBeVisible();

    // =========================================================================
    // STATE 5: BOTH OPTIONS SELECTED ("Your Brand" + "Branded Content")
    // =========================================================================
    await yourBrandCheckbox.check({ force: true });
    await expect(yourBrandCheckbox).toBeChecked();
    await expect(brandedCheckbox).toBeChecked();

    // 2. Exact prompt when both selected
    await expect(page.locator('text=Your photo/video will be labeled as \'Paid partnership\'').first()).toBeVisible();

    // Point 4 Declaration for BOTH
    await expect(declaration).toHaveAttribute('data-declaration-type', 'BOTH');
    await expect(declaration.locator('a:has-text("Branded Content Policy")')).toBeVisible();
    await expect(declaration.locator('a:has-text("Music Usage Confirmation")')).toBeVisible();

    // 1. Verify confirmation modal in BOTH state
    await postNowBtn.click();
    await expect(modalHeading).toBeVisible();
    const modalBothDeclaration = page.locator('div[data-tiktok-compliance-declaration="true"]').last();
    await expect(modalBothDeclaration.locator('a:has-text("Branded Content Policy")')).toBeVisible();
    await expect(modalBothDeclaration.locator('a:has-text("Music Usage Confirmation")')).toBeVisible();
    await page.locator('button:has-text("Cancel")').last().click();
    await expect(modalHeading).toBeHidden();
  });
});
