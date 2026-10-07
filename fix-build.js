const fs = require('fs');

let code = fs.readFileSync('app/(dashboard)/accounts/page.tsx', 'utf8');

code = code.replace(
  /const getAddButtonText = \(platId, platName\) => \{/g,
  'const getAddButtonText = (platId: string, platName: string) => {'
);

code = code.replace(
  /Sparkles,\n\} from 'lucide-react';/g,
  "Sparkles,\n  LogOut,\n  Plus,\n} from 'lucide-react';"
);

fs.writeFileSync('app/(dashboard)/accounts/page.tsx', code);
