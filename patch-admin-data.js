const fs = require('fs');
const path = 'lib/admin-data.ts';
let content = fs.readFileSync(path, 'utf8');

const s1 = `          subscriptionStatus: entitlements?.subscription?.status || entitlements?.source || 'FREE',
          effectivePlanSource: entitlements?.source || 'FREE',`;
const r1 = `          subscriptionStatus: entitlements?.subscription?.status || entitlements?.source || 'FREE',
          effectivePlanSource: entitlements?.source || 'FREE',
          paymentStatus: entitlements?.subscription ? computePaymentStatus(entitlements.subscription) : 'FREE',
          renewalDate: entitlements?.subscription?.currentPeriodEnd || null,`;

if (!content.includes('computePaymentStatus')) {
  content = "import { computePaymentStatus } from './billing';\\n" + content;
}
content = content.replace(s1, r1);

fs.writeFileSync(path, content);
console.log('Patched admin-data.ts');
