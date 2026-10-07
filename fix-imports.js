const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/accounts/page.tsx', 'utf8');

code = code.replace(
  "Sparkles,\n} from 'lucide-react';",
  "Sparkles,\n  LogOut,\n  Plus,\n} from 'lucide-react';"
);

fs.writeFileSync('app/(dashboard)/accounts/page.tsx', code);
