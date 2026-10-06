const fs = require('fs');

const page = 'app/(dashboard)/instagram-auto-dm/page.tsx';
let code = fs.readFileSync(page, 'utf8');

code = code.replace(/data\.automations/g, "data.rules");
code = code.replace(/setAutomations\(data\.rules \|\| \[\]\);/g, "setAutomations(data.rules || []);");
code = code.replace(/stats\.active/g, "stats.activeRules");
code = code.replace(/active:/g, "activeRules:");
code = code.replace(/stats\.triggers/g, "stats.totalRules");
code = code.replace(/triggers:/g, "totalRules:");
code = code.replace(/stats\.sent/g, "stats.totalSent");
code = code.replace(/sent:/g, "totalSent:");
code = code.replace(/stats\.failed/g, "stats.totalFailed");
code = code.replace(/failed:/g, "totalFailed:");

// Fix toggleStatus
code = code.replace(
  /const newStatus = currentStatus === "ACTIVE" \? "PAUSED" : "ACTIVE";\s*try {\s*const res = await fetch\(`\/api\/instagram-auto-dm\/\$\{id\}`,\s*\{\s*method: "PATCH",\s*headers: \{ "Content-Type": "application\/json" \},\s*body: JSON\.stringify\(\{ status: newStatus \}\),\s*\}\);/,
  `const newStatus = !currentStatus;
    try {
      const res = await fetch(\`/api/instagram-auto-dm/\${id}\`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newStatus }),
      });`
);
code = code.replace(/toggleStatus\(auto\.id, auto\.status\)/g, "toggleStatus(auto.id, auto.enabled)");
code = code.replace(/auto\.status === "ACTIVE"/g, "auto.enabled");
code = code.replace(/auto\.status/g, "auto.enabled ? 'ACTIVE' : 'PAUSED'");

fs.writeFileSync(page, code, 'utf8');
console.log('page.tsx patched');
