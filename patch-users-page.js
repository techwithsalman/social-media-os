const fs = require('fs');
const path = 'app/super-admin/users/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const s1 = '<th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Plan</th>';
const r1 = s1 + '\\n' +
  '<th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Payment Status</th>\\n' +
  '<th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Renewal Date</th>';
content = content.replace(s1, r1);

const s2 = /<td className="px-6 py-4 whitespace-nowrap">\\s*<div className="text-sm font-black text-indigo-400">\{user\.currentPlan\}<\/div>\\s*<div className="text-xs text-slate-500 font-bold uppercase">\{user\.subscriptionStatus\}<\/div>\\s*<\/td>/;
const r2 = `<td className="px-6 py-4 whitespace-nowrap">
    <div className="text-sm font-black text-indigo-400">{user.currentPlan}</div>
    <div className="text-xs text-slate-500 font-bold uppercase">{user.effectivePlanSource}</div>
  </td>
  <td className="px-6 py-4 whitespace-nowrap">
    {user.effectivePlanSource === 'MANUAL' ? (
      <span className={\`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black \${
        user.paymentStatus === 'PAID' ? 'bg-emerald-500/10 text-emerald-400' :
        user.paymentStatus === 'DUE' ? 'bg-amber-500/10 text-amber-400' :
        user.paymentStatus === 'PAST_DUE' ? 'bg-orange-500/10 text-orange-400' :
        'bg-red-500/10 text-red-400'
      }\`}>
        {user.paymentStatus}
      </span>
    ) : (
      <span className="text-xs text-slate-500 font-bold">-</span>
    )}
  </td>
  <td className="px-6 py-4 whitespace-nowrap">
    {user.effectivePlanSource === 'MANUAL' && user.renewalDate ? (
      <span className="text-xs font-bold text-slate-300">{new Date(user.renewalDate).toLocaleDateString()}</span>
    ) : (
      <span className="text-xs text-slate-500 font-bold">-</span>
    )}
  </td>`;
content = content.replace(s2, r2);

fs.writeFileSync(path, content);
console.log('Patched Users page UI');
