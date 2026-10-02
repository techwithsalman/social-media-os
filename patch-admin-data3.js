const fs = require('fs');
const path = 'lib/admin-data.ts';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('Auto-heal legacy STARTER sub')) {
  const replacement = `      users.map(async (user) => {
        const workspace = user.workspaces[0]?.workspace || null;
        let entitlements = workspace ? await getWorkspaceEntitlements(workspace.id) : null;

        // Auto-heal legacy STARTER sub without currentPeriodEnd (trigger one-time backfill safely)
        if (workspace && entitlements?.subscription?.source === 'MANUAL' && entitlements?.subscription?.planTier === 'STARTER' && !entitlements?.subscription?.currentPeriodEnd) {
           const sub = entitlements.subscription;
           const now = new Date();
           const newEnd = new Date(sub.startedAt || now);
           newEnd.setMonth(newEnd.getMonth() + 1);
           
           await prisma.subscription.update({
             where: { id: sub.id },
             data: { currentPeriodEnd: newEnd, currentPeriodStart: sub.startedAt || now }
           });
           
           const existingTx = await prisma.paymentTransaction.findFirst({
             where: { workspaceId: workspace.id, provider: 'MANUAL', planId: sub.planId }
           });
           
           if (!existingTx && sub.planId) {
             const planObj = await prisma.plan.findUnique({ where: { id: sub.planId } });
             await prisma.paymentTransaction.create({
               data: {
                 workspaceId: workspace.id,
                 planId: sub.planId,
                 amount: planObj?.monthlyPrice || 24,
                 currency: planObj?.currency || 'USD',
                 provider: 'MANUAL',
                 status: 'PAID',
                 paidAt: sub.startedAt || now,
                 notes: 'Auto-healed legacy STARTER assignment'
               }
             });
           }
           
           entitlements = await getWorkspaceEntitlements(workspace.id);
        }`;

  content = content.replace(
    /users\.map\(async\s*\(\s*user\s*\)\s*=>\s*\{\s*const workspace = user\.workspaces\[0\]\?\.workspace \|\| null;\s*const entitlements = workspace \? await getWorkspaceEntitlements\(workspace\.id\) : null;/,
    replacement
  );

  fs.writeFileSync(path, content);
  console.log('Added auto-heal to getAdminUserRows in lib/admin-data.ts');
}
