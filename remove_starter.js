const fs = require('fs');

let code = fs.readFileSync('app/super-admin/users/[id]/UserDetailClient.tsx', 'utf8');

// Remove the hardcoded Starter Plan block completely
const starterBlockRegex = /<div className="p-4 rounded-xl bg-\[#050202\] border border-\[#2a1010\]\">\s*<h3 className="text-sm font-bold text-white mb-2">Starter Plan<\/h3>\s*<button[^>]+onClick=\{\(\) => handleAction\('change_plan', \{ planCode: 'STARTER' \}\)\}[^>]+>[\s\S]*?Force Assign Starter\s*<\/button>\s*<\/div>/m;
code = code.replace(starterBlockRegex, '');

// Make extend trial use selectedPlan
code = code.replace(/handleAction\('extend_trial', \{ planCode: 'STARTER', days: 14 \}\)/g, "handleAction('extend_trial', { planCode: selectedPlan, days: 14 })");

// In default state
code = code.replace(/useState<string>\(plans\[0\]\?\.code \|\| 'STARTER'\);/g, "useState<string>(plans[0]?.code || 'FREE');");

fs.writeFileSync('app/super-admin/users/[id]/UserDetailClient.tsx', code);

// Now update route.ts
let routeCode = fs.readFileSync('app/api/super-admin/users/[id]/route.ts', 'utf8');
routeCode = routeCode.replace(/const planCode = body\.planCode \|\| 'STARTER';/g, "const planCode = body.planCode || 'FREE';");
fs.writeFileSync('app/api/super-admin/users/[id]/route.ts', routeCode);
