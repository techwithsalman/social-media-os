const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/accounts/page.tsx', 'utf8');

code = code.replace(
  /const handleConnect = async \(platform: string, mode: 'add' \| 'reconnect' = 'add'\) => \{/,
  "const handleConnect = async (platform: string, intentMode: 'add' | 'reconnect' = 'add') => {"
);

code = code.replace(
  /window\.location\.href = `\/api\/oauth\/instagram\/connect\?mode=\$\{mode\}`;/,
  "window.location.href = `/api/oauth/instagram/connect?mode=${intentMode}`;"
);

fs.writeFileSync('app/(dashboard)/accounts/page.tsx', code);
