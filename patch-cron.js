const fs = require('fs');
const path = 'app/api/queue/process/route.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /const cronSecret = process\.env\.CRON_SECRET;\s*if \(cronSecret\) \{/g,
  `const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured on the server.' }, { status: 500 });
    }
    if (cronSecret) {`
);

fs.writeFileSync(path, content);
console.log('Patched CRON_SECRET requirement');
