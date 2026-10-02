const fs = require('fs');
const path = 'lib/auth.ts';
let content = fs.readFileSync(path, 'utf8');

const backfillLogic = `
    // One-time backfill for salmankhan03312545937@gmail.com
    if (user.email === 'salmankhan03312545937@gmail.com') {
      const workspace = user.workspaces[0]?.workspace;
      if (workspace) {
        const sub = await prisma.subscription.findFirst({
          where: { workspaceId: workspace.id, source: 'MANUAL', planTier: 'STARTER' }
        });
        if (sub && !sub.currentPeriodEnd) {
          const now = new Date();
          const newEnd = new Date(sub.startedAt || now);
          newEnd.setMonth(newEnd.getMonth() + 1);
          
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { currentPeriodEnd: newEnd, currentPeriodStart: sub.startedAt || now }
          });
          
          const existingTx = await prisma.paymentTransaction.findFirst({
            where: { workspaceId: workspace.id, provider: 'MANUAL' }
          });
          
          if (!existingTx) {
            await prisma.paymentTransaction.create({
              data: {
                workspaceId: workspace.id,
                planId: sub.planId,
                amount: 24, // $24
                currency: 'USD',
                provider: 'MANUAL',
                status: 'PAID',
                paidAt: sub.startedAt || now,
                notes: 'Backfilled from previous STARTER assignment'
              }
            });
          }
        }
      }
    }
`;

content = content.replace(/user\.systemRole = 'SUPER_ADMIN';\s*\}/, "user.systemRole = 'SUPER_ADMIN';\n    }\n" + backfillLogic);

fs.writeFileSync(path, content);
console.log('Patched auth.ts with backfill');
