const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/accounts/page.tsx', 'utf8');

code = code.replace(
  /const handleConnect = async \(platform: string\) => \{/,
  "const handleConnect = async (platform: string, mode: 'add' | 'reconnect' = 'add') => {"
);

code = code.replace(
  /window\.location\.href = `\/api\/oauth\/instagram\/connect`;/,
  "window.location.href = `/api/oauth/instagram/connect?mode=${mode}`;"
);

// We need to update the Reconnect button to pass 'reconnect'
// The reconnect button has: onClick={() => handleConnect(plat.id)}
// Wait, the regular button ALSO has: onClick={() => handleConnect(plat.id)}
// We need to specifically target the Reconnect button.
// The Reconnect button is right before Refresh Profile:
code = code.replace(
  /onClick=\{\(\) => handleConnect\(plat\.id\)\}([\s\S]*?)<span>Reconnect<\/span>/g,
  "onClick={() => handleConnect(plat.id, 'reconnect')}$1<span>Reconnect</span>"
);

fs.writeFileSync('app/(dashboard)/accounts/page.tsx', code);
