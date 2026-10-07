const fs = require('fs');

let code = fs.readFileSync('app/api/accounts/route.ts', 'utf8');

if (!code.includes('getWorkspaceEntitlements')) {
  code = code.replace(
    "import { isRealTikTokConfigured, getTikTokEnvironmentInfo } from '@/lib/tiktok-oauth';",
    "import { isRealTikTokConfigured, getTikTokEnvironmentInfo } from '@/lib/tiktok-oauth';\nimport { getWorkspaceEntitlements, serializeEntitlements } from '@/lib/billing';"
  );
  code = code.replace(
    /const platformRequirements = platformRegistry\.getAllRequirements\(\);/,
    "const platformRequirements = platformRegistry.getAllRequirements();\n    const rawEntitlements = await getWorkspaceEntitlements(session.workspaceId);\n    const entitlements = serializeEntitlements(rawEntitlements);"
  );
  code = code.replace(
    /tiktokEnvironment: getTikTokEnvironmentInfo\(\),\n      \},/,
    "tiktokEnvironment: getTikTokEnvironmentInfo(),\n      },\n      entitlements,"
  );
  fs.writeFileSync('app/api/accounts/route.ts', code);
}
