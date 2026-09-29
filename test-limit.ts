import { getWorkspaceEntitlements } from './lib/billing';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Grab any workspace
  const workspace = await prisma.workspace.findFirst();
  if (!workspace) {
    console.log('No workspace found');
    return;
  }

  // This will call ensureDefaultPlans internally!
  const entitlements = await getWorkspaceEntitlements(workspace.id);
  console.log(`Workspace: ${workspace.id}`);
  console.log(`Max Social Accounts: ${entitlements.limits.maxSocialAccounts}`);
  
  if (entitlements.limits.maxSocialAccounts === 8) {
    console.log('✅ Limit is successfully updated to 8 for the FREE plan!');
  } else {
    console.error(`❌ Limit is ${entitlements.limits.maxSocialAccounts}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
