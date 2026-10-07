const fs = require('fs');

let page = fs.readFileSync('app/(dashboard)/instagram-auto-dm/page.tsx', 'utf8');
page = page.replace('searchParams.get("reconnected")', 'searchParams.get("enabled")');
page = page.replace('searchParams.get("success") === "reconnected"', 'searchParams.get("success") === "enabled"');
page = page.replace('setSuccessMsg("Instagram Auto DM connected successfully.");', 'setSuccessMsg("Auto DM Enabled");');
fs.writeFileSync('app/(dashboard)/instagram-auto-dm/page.tsx', page);

let create = fs.readFileSync('app/(dashboard)/instagram-auto-dm/create/page.tsx', 'utf8');
create = create.replace(/Connect Auto DM/g, 'Enable Auto DM');
create = create.replace(/\/api\/oauth\/instagram-auto-dm\/connect/g, '/api/oauth/instagram-auto-dm/connect?accountId=${acc.id}');

// Replace the specific Reconnect Auto DM button entirely
const re = /<button[^>]+onClick=\{[^}]+\}[^>]+>[\s\S]*?<Instagram[^>]+>\s*Reconnect Auto DM\s*<\/button>/g;
create = create.replace(re, `<button disabled className="bg-zinc-800 border border-green-500/30 text-green-400 text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-2 cursor-default"><Instagram className="w-3 h-3" />Auto DM Enabled</button>`);

fs.writeFileSync('app/(dashboard)/instagram-auto-dm/create/page.tsx', create);
