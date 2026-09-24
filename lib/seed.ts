import { bootstrapSaasDemoData } from './saas-seed';

async function main() {
  console.log('[Seed] Seeding SaaS database default plans and tenants...');
  const result = await bootstrapSaasDemoData();
  console.log('[Seed] Seeding complete:', result);
}

main().catch((err) => {
  console.error('[Seed Error]:', err);
  process.exit(1);
});
