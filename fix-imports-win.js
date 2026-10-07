const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/accounts/page.tsx', 'utf8');

code = code.replace(
  /Sparkles,[\r\n]+\} from 'lucide-react';/,
  "Sparkles,\r\n  LogOut,\r\n  Plus,\r\n} from 'lucide-react';"
);

fs.writeFileSync('app/(dashboard)/accounts/page.tsx', code);
