const fs = require('fs');

const path = 'app/super-admin/users/[id]/UserDetailClient.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/const \[message, setMessage\] = useState<\{ type: 'success' \| 'error', text: string \} \| null>\(null\);/, 
  "const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);\n  const [selectedPlan, setSelectedPlan] = useState<string>(plans[0]?.code || 'STARTER');");

fs.writeFileSync(path, code, 'utf8');
console.log('patched');
