const { execSync } = require('child_process');
const fs = require('fs');

const content = execSync('git show 1991757:"app/(dashboard)/dashboard/page.tsx"', { encoding: 'utf8' });

let patched = content.replace(
  'title="Dashboard Overview"\n    >',
  'title="Dashboard Overview"\n    >\n      <div className="max-w-[1440px] w-full mx-auto">'
);

patched = patched.replace(
  '      </div>\n    </AppLayout>',
  '      </div>\n      </div>\n    </AppLayout>'
);

fs.writeFileSync('app/(dashboard)/dashboard/page.tsx', patched, 'utf8');
console.log('Restored dashboard natively in Node without encoding issues.');
