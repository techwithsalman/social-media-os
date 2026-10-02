const fs = require('fs');
const path = 'app/api/super-admin/users/[id]/route.ts';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(
  /} from '@\/lib\/billing';/,
  ", assignManualSubscription, renewManualSubscription, downgradeToFree } from '@/lib/billing';"
);
fs.writeFileSync(path, content);
console.log('Fixed imports in route.ts');
