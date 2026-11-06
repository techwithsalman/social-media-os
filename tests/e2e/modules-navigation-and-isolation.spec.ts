import { test, expect, getSessionForUser, injectAuthSession } from './auth-fixture';

test.describe('Phase 3 Audit: Navigation, Layout, and Workspace Isolation Across All Modules', () => {
  test('Module Audit: Core navigation across all dashboard routes loads without errors', async ({ page }) => {
    const routes = [
      { path: '/dashboard', text: 'Dashboard' },
      { path: '/create-post', text: 'SELECT TARGET CHANNELS' },
      { path: '/bulk-upload', text: 'Batch Media Uploader & Schedule Matrix' },
      { path: '/calendar', text: 'Content Calendar' },
      { path: '/scheduled', text: 'Scheduled Posts' },
      { path: '/published', text: 'Published Posts' },
      { path: '/accounts', text: 'Connected Social Channels' },
      { path: '/analytics', text: 'Analytics' },
      { path: '/instagram-auto-dm', text: 'Instagram Auto DM' },
      { path: '/facebook-auto-dm', text: 'Facebook Auto DM' },
      { path: '/team', text: 'Team' },
      { path: '/billing', text: 'Billing' },
      { path: '/settings', text: 'Settings' },
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await page.waitForLoadState('domcontentloaded');

      if (route.text) {
        await expect(page.locator(`text=${route.text}`).first()).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('Workspace Isolation: Different user sessions load strictly isolated workspaces', async ({ browser }) => {
    // Session 1: Salman (PRO / Super Admin)
    const context1 = await browser.newContext();
    const session1 = await getSessionForUser('salmandesigner24@gmail.com');
    await injectAuthSession(context1, session1);
    const page1 = await context1.newPage();
    await page1.goto('/settings');
    await page1.waitForLoadState('networkidle');
    await expect(page1.locator('text=Salman').first()).toBeVisible();

    // Session 2: Free Demo User (FREE plan)
    const context2 = await browser.newContext();
    const session2 = await getSessionForUser('free-user@socialos.dev');
    await injectAuthSession(context2, session2);
    const page2 = await context2.newPage();
    await page2.goto('/settings');
    await page2.waitForLoadState('networkidle');
    await expect(page2.locator('text=Free Demo Workspace').first()).toBeVisible();

    // Verify workspace IDs in tokens are completely distinct
    expect(session1.workspaceId).not.toEqual(session2.workspaceId);

    await context1.close();
    await context2.close();
  });
});
