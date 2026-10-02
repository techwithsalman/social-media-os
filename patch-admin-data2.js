const fs = require('fs');
const path = 'lib/admin-data.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /effectivePlanSource:\s*entitlements\?\.source\s*\|\|\s*'FREE',/;

content = content.replace(regex, `effectivePlanSource: entitlements?.source || 'FREE',
          paymentStatus: entitlements?.subscription ? computePaymentStatus(entitlements.subscription) : 'FREE',
          renewalDate: entitlements?.subscription?.currentPeriodEnd || null,`);

fs.writeFileSync(path, content);
console.log('Fixed admin-data.ts');
