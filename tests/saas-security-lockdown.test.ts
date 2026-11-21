import assert from 'node:assert';
import {
  verifyPaidAccess,
  assertPaidSubscription,
  createPaymentRequiredResponse,
  AccessControlError,
  SUBSCRIPTION_REQUIRED_PAYLOAD,
} from '../lib/access-control';
import { isOwnerEmail, isOwnerUser, OWNER_EMAIL } from '../lib/owner';
import { requireSuperAdmin, AdminAccessError } from '../lib/super-admin';
import { getEffectivePlan, getWorkspaceEntitlements, assertWorkspaceActive } from '../lib/billing';

console.log('========================================================================');
console.log(' SAAS SECURITY LOCKDOWN & ACCESS CONTROL VERIFICATION TEST SUITE        ');
console.log('========================================================================\n');

let totalTests = 0;
let passedTests = 0;

async function testCase(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) await res;
    passedTests++;
    console.log(`✔ [PASS] Test ${totalTests}: ${name}`);
  } catch (err: any) {
    console.error(`✗ [FAIL] Test ${totalTests}: ${name}`);
    console.error(`   Error:`, err.message);
    throw err;
  }
}

async function runSuite() {
  const prismaModule = await import('../lib/prisma');
  const prisma = prismaModule.default;

  const origUserFindUnique = prisma.user.findUnique;
  const origUserUpdate = prisma.user.update;
  const origWorkspaceFindUnique = prisma.workspace.findUnique;
  const origOverrideFindFirst = prisma.planOverride.findFirst;
  const origSubFindMany = prisma.subscription.findMany;
  const origTxFindFirst = prisma.paymentTransaction.findFirst;
  const origPlanFindUnique = prisma.plan.findUnique;
  const origPlanUpsert = prisma.plan.upsert;
  const origUsagePeriodUpsert = prisma.usagePeriod.upsert;
  const origUsagePeriodFindUnique = prisma.usagePeriod.findUnique;

  prisma.plan.upsert = (async ({ create, where }: any) => ({
    id: `plan_${(where?.code || create?.code || 'plan').toLowerCase()}`,
    code: where?.code || create?.code || 'AGENCY',
    name: create?.name || 'Plan',
    monthlyPostLimit: null,
    maxSocialAccounts: null,
    storageLimitMB: null,
    maxTeamMembers: null,
    bulkUploadEnabled: true,
    analyticsEnabled: true,
    advancedAnalyticsEnabled: true,
    schedulingEnabled: true,
    customCaptionsEnabled: true,
    prioritySupportEnabled: true,
  })) as any;

  const authModule = await import('../lib/auth');
  const origGetSession = authModule.getSession;

  try {
    // -------------------------------------------------------------------------
    console.log('--- Group 1: Canonical Owner Access & Super Admin Authority ---');
    // -------------------------------------------------------------------------

    await testCase('Canonical owner email is identified accurately with case-insensitivity', () => {
      assert.strictEqual(isOwnerEmail('salmandesigner24@gmail.com'), true);
      assert.strictEqual(isOwnerEmail('SALMANDESIGNER24@GMAIL.COM '), true);
      assert.strictEqual(isOwnerEmail('SalManDesigner24@gmail.com'), true);
      assert.strictEqual(isOwnerEmail('other-user@example.com'), false);
      assert.strictEqual(isOwnerEmail('salmankhan03312545937@gmail.com'), false);
    });

    await testCase('Owner receives full access without paid subscription or active override', async () => {
      prisma.user.findUnique = (async ({ where }: any) => ({
        id: 'owner_user_id',
        email: OWNER_EMAIL,
        status: 'ACTIVE',
        systemRole: 'SUPER_ADMIN',
        workspaces: [{ role: 'OWNER' }],
      })) as any;

      const result = await verifyPaidAccess('owner_user_id', 'ws_owner_1');
      assert.strictEqual(result.authorized, true);
      assert.strictEqual(result.isOwner, true);
      assert.strictEqual(result.planTier, 'AGENCY');
    });

    await testCase('Owner is permanently recognized as Super Admin even if DB role is out of sync', async () => {
      let dbUpdatedRole = '';
      prisma.user.findUnique = (async () => ({
        id: 'owner_user_id',
        email: OWNER_EMAIL,
        firstName: 'Salman',
        lastName: 'Designer',
        systemRole: 'USER', // Out of sync DB role
        status: 'ACTIVE',
      })) as any;

      prisma.user.update = (async ({ data }: any) => {
        dbUpdatedRole = data.systemRole;
        return {};
      }) as any;

      const mockSession = {
        userId: 'owner_user_id',
        email: OWNER_EMAIL,
        workspaceId: 'ws_owner_1',
      };

      const { user } = await requireSuperAdmin(mockSession);
      assert.strictEqual(user.email, OWNER_EMAIL);
      assert.strictEqual(user.systemRole, 'SUPER_ADMIN');
      assert.strictEqual(dbUpdatedRole, 'SUPER_ADMIN');
    });

    await testCase('Owner workspace receives unlimited entitlements and is never suspended', async () => {
      prisma.workspace.findUnique = (async () => ({
        id: 'ws_owner_1',
        name: "Salman's Workspace",
        plan: 'FREE', // Free label in DB
        status: 'SUSPENDED', // Even if marked suspended
        suspendedReason: 'Testing',
        members: [{ user: { email: OWNER_EMAIL } }],
      })) as any;

      prisma.planOverride.findFirst = (async () => null) as any;
      prisma.subscription.findMany = (async () => []) as any;
      prisma.plan.findUnique = (async ({ where }: any) => ({
        id: 'plan_agency',
        code: where.code || 'AGENCY',
        name: 'Agency',
        monthlyPostLimit: null,
        maxSocialAccounts: null,
        storageLimitMB: null,
        maxTeamMembers: null,
        bulkUploadEnabled: true,
        analyticsEnabled: true,
        advancedAnalyticsEnabled: true,
        schedulingEnabled: true,
        customCaptionsEnabled: true,
        prioritySupportEnabled: true,
      })) as any;

      // assertWorkspaceActive should not throw for owner
      await assertWorkspaceActive('ws_owner_1');

      const plan = await getEffectivePlan('ws_owner_1');
      assert.strictEqual(plan.source, 'OWNER_PERMANENT');
      assert.strictEqual(plan.plan.code, 'AGENCY');
    });

    // -------------------------------------------------------------------------
    console.log('\n--- Group 2: Strict Non-Owner Paid Access Enforcement ---');
    // -------------------------------------------------------------------------

    await testCase('FREE plan user without paid subscription is blocked with 402', async () => {
      prisma.user.findUnique = (async () => ({
        id: 'free_user_id',
        email: 'free-user@example.com',
        status: 'ACTIVE',
        systemRole: 'USER',
        workspaces: [{ role: 'MEMBER' }],
      })) as any;

      prisma.workspace.findUnique = (async () => ({
        id: 'ws_free',
        status: 'ACTIVE',
      })) as any;

      prisma.planOverride.findFirst = (async () => null) as any;
      prisma.subscription.findMany = (async () => [
        {
          id: 'sub_free',
          status: 'ACTIVE',
          planTier: 'FREE',
          currentPeriodEnd: null,
        },
      ]) as any;

      const result = await verifyPaidAccess('free_user_id', 'ws_free');
      assert.strictEqual(result.authorized, false);
      assert.strictEqual(result.statusCode, 402);
      assert.strictEqual(result.reason, 'VALID_PAID_SUBSCRIPTION_REQUIRED');
    });

    await testCase('User with fake PRO label in DB but no active subscription is blocked with 402', async () => {
      prisma.user.findUnique = (async () => ({
        id: 'fake_pro_user',
        email: 'fake-pro@example.com',
        status: 'ACTIVE',
        systemRole: 'USER',
        workspaces: [{ role: 'OWNER' }],
      })) as any;

      prisma.workspace.findUnique = (async () => ({
        id: 'ws_fake_pro',
        plan: 'PRO', // Fake label in DB
        status: 'ACTIVE',
      })) as any;

      prisma.planOverride.findFirst = (async () => null) as any;
      prisma.subscription.findMany = (async () => []) as any; // No actual subscription record

      const result = await verifyPaidAccess('fake_pro_user', 'ws_fake_pro');
      assert.strictEqual(result.authorized, false);
      assert.strictEqual(result.statusCode, 402);
    });

    await testCase('Expired paid subscription is blocked with 402', async () => {
      const now = new Date();
      const expiredDate = new Date(now.getTime() - 2 * 24 * 3600 * 1000); // Expired 2 days ago

      prisma.user.findUnique = (async () => ({
        id: 'expired_user',
        email: 'expired@example.com',
        status: 'ACTIVE',
        systemRole: 'USER',
        workspaces: [{ role: 'MEMBER' }],
      })) as any;

      prisma.workspace.findUnique = (async () => ({
        id: 'ws_expired',
        status: 'ACTIVE',
      })) as any;

      prisma.planOverride.findFirst = (async () => null) as any;
      prisma.subscription.findMany = (async () => [
        {
          id: 'sub_expired',
          status: 'ACTIVE',
          planTier: 'PRO',
          source: 'STRIPE',
          currentPeriodEnd: expiredDate,
        },
      ]) as any;

      const result = await verifyPaidAccess('expired_user', 'ws_expired');
      assert.strictEqual(result.authorized, false);
      assert.strictEqual(result.statusCode, 402);
    });

    await testCase('Suspended user account is blocked with 403', async () => {
      prisma.user.findUnique = (async () => ({
        id: 'suspended_user',
        email: 'suspended@example.com',
        status: 'SUSPENDED',
        systemRole: 'USER',
        workspaces: [{ role: 'MEMBER' }],
      })) as any;

      const result = await verifyPaidAccess('suspended_user', 'ws_any');
      assert.strictEqual(result.authorized, false);
      assert.strictEqual(result.statusCode, 403);
      assert.strictEqual(result.reason, 'USER_SUSPENDED');
    });

    await testCase('Demo account (pro-user@socialos.dev) is blocked from real production access', async () => {
      prisma.user.findUnique = (async () => ({
        id: 'demo_user_id',
        email: 'pro-user@socialos.dev',
        status: 'ACTIVE',
        systemRole: 'USER',
        workspaces: [{ role: 'OWNER' }],
      })) as any;

      const result = await verifyPaidAccess('demo_user_id', 'ws_demo');
      assert.strictEqual(result.authorized, false);
      assert.strictEqual(result.statusCode, 402);
      assert.strictEqual(result.reason, 'DEMO_USER_BLOCKED_FROM_PRODUCTION');
    });

    await testCase('Legitimate active paid subscriber (PRO) receives access', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 25 * 24 * 3600 * 1000); // 25 days remaining

      prisma.user.findUnique = (async () => ({
        id: 'paid_user_id',
        email: 'customer@legitcorp.com',
        status: 'ACTIVE',
        systemRole: 'USER',
        workspaces: [{ role: 'OWNER' }],
      })) as any;

      prisma.workspace.findUnique = (async () => ({
        id: 'ws_paid',
        status: 'ACTIVE',
      })) as any;

      prisma.planOverride.findFirst = (async () => null) as any;
      prisma.subscription.findMany = (async () => [
        {
          id: 'sub_paid',
          status: 'ACTIVE',
          planTier: 'PRO',
          source: 'STRIPE',
          currentPeriodEnd: futureDate,
        },
      ]) as any;

      const result = await verifyPaidAccess('paid_user_id', 'ws_paid');
      assert.strictEqual(result.authorized, true);
      assert.strictEqual(result.isOwner, false);
      assert.strictEqual(result.planTier, 'PRO');
    });

    // -------------------------------------------------------------------------
    console.log('\n--- Group 3: Super Admin Security & Backdoor Removal ---');
    // -------------------------------------------------------------------------

    await testCase('Non-owner user is rejected from requireSuperAdmin() even if DB systemRole=SUPER_ADMIN', async () => {
      prisma.user.findUnique = (async () => ({
        id: 'hacker_user_id',
        email: 'attacker@evil.com',
        systemRole: 'SUPER_ADMIN', // Attempted role spoofing
        status: 'ACTIVE',
      })) as any;

      const mockSession = {
        userId: 'hacker_user_id',
        email: 'attacker@evil.com',
        workspaceId: 'ws_hacker',
      };

      await assert.rejects(
        async () => {
          await requireSuperAdmin(mockSession);
        },
        (err: any) => {
          assert.strictEqual(err instanceof AdminAccessError, true);
          assert.strictEqual(err.status, 403);
          assert.match(err.message, /Only the verified owner has Super Admin access/i);
          return true;
        }
      );
    });

    await testCase('assertPaidSubscription returns consistent HTTP 402 payload on failure', async () => {
      const mockUnpaidSession = {
        userId: 'unpaid_user_id',
        email: 'unpaid@example.com',
        workspaceId: 'ws_unpaid',
      };

      prisma.user.findUnique = (async () => ({
        id: 'unpaid_user_id',
        email: 'unpaid@example.com',
        status: 'ACTIVE',
        systemRole: 'USER',
        workspaces: [{ role: 'MEMBER' }],
      })) as any;

      prisma.workspace.findUnique = (async () => ({
        id: 'ws_unpaid',
        status: 'ACTIVE',
      })) as any;

      prisma.planOverride.findFirst = (async () => null) as any;
      prisma.subscription.findMany = (async () => []) as any;

      await assert.rejects(
        async () => {
          await assertPaidSubscription(mockUnpaidSession);
        },
        (err: any) => {
          assert.strictEqual(err instanceof AccessControlError, true);
          assert.strictEqual(err.status, 402);
          assert.strictEqual(err.code, 'SUBSCRIPTION_REQUIRED');
          assert.strictEqual(err.redirectUrl, '/billing');
          return true;
        }
      );

      const res = createPaymentRequiredResponse();
      assert.strictEqual(res.status, 402);
      const data = await res.json();
      assert.strictEqual(data.error, SUBSCRIPTION_REQUIRED_PAYLOAD.error);
      assert.strictEqual(data.code, SUBSCRIPTION_REQUIRED_PAYLOAD.code);
      assert.strictEqual(data.redirect, '/billing');
    });

  } finally {
    // Restore mocks
    prisma.user.findUnique = origUserFindUnique;
    prisma.user.update = origUserUpdate;
    prisma.workspace.findUnique = origWorkspaceFindUnique;
    prisma.planOverride.findFirst = origOverrideFindFirst;
    prisma.subscription.findMany = origSubFindMany;
    prisma.paymentTransaction.findFirst = origTxFindFirst;
    prisma.plan.findUnique = origPlanFindUnique;
    prisma.plan.upsert = origPlanUpsert;
    prisma.usagePeriod.upsert = origUsagePeriodUpsert;
    prisma.usagePeriod.findUnique = origUsagePeriodFindUnique;
    (authModule as any).getSession = origGetSession;
  }

  console.log('\n========================================================================');
  console.log(` ALL SECURITY TESTS PASSED: ${passedTests}/${totalTests}`);
  console.log('========================================================================\n');
}

runSuite().catch((err) => {
  console.error('\nTest Suite Failed:', err);
  process.exit(1);
});
