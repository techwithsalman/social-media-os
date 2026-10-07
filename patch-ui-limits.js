const fs = require('fs');

let code = fs.readFileSync('app/(dashboard)/accounts/page.tsx', 'utf8');

const validationLogic = `  const handleConnect = async (platform: string) => {
    if (entitlements && entitlements.limits.maxSocialAccounts !== null && accounts.length >= entitlements.limits.maxSocialAccounts) {
      alert(\`You've reached your \${entitlements.plan.name} plan limit of \${entitlements.limits.maxSocialAccounts} connected social accounts.\`);
      return;
    }`;

code = code.replace(/  const handleConnect = async \(platform: string\) => \{/, validationLogic);

fs.writeFileSync('app/(dashboard)/accounts/page.tsx', code);
