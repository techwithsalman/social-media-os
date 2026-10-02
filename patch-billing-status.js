const fs = require('fs');
const path = 'lib/billing.ts';
let content = fs.readFileSync(path, 'utf8');

const newFunctions = `
export function computePaymentStatus(sub: any) {
  if (!sub || sub.source !== 'MANUAL' || !sub.currentPeriodEnd) return 'FREE';
  const now = new Date();
  
  // Strip time for day comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(sub.currentPeriodEnd);
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  const graceEnd = new Date(endDate);
  graceEnd.setDate(graceEnd.getDate() + 3);
  
  if (today.getTime() === endDate.getTime()) {
    return 'DUE';
  } else if (today < endDate) {
    return 'PAID';
  } else if (today <= graceEnd) {
    return 'PAST_DUE';
  } else {
    return 'EXPIRED';
  }
}

export async function downgradeToFree(workspaceId: string, adminUserId: string) {
  // Cancel manual subscription
  await prisma.subscription.updateMany({
    where: { workspaceId, source: 'MANUAL', status: 'ACTIVE' },
    data: { status: 'CANCELED', currentPeriodEnd: new Date() }
  });
  await syncWorkspacePlanCache(workspaceId, 'FREE');
  return { plan: 'FREE' };
}
`;

if (!content.includes('computePaymentStatus')) {
  fs.writeFileSync(path, content + newFunctions);
  console.log('Appended computePaymentStatus and downgradeToFree');
}
