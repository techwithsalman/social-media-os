const fs = require('fs');
const path = 'app/super-admin/users/[id]/UserDetailClient.tsx';
let content = fs.readFileSync(path, 'utf8');

const statusHelper = `
function computePaymentStatus(sub: any) {
  if (!sub || sub.source !== 'MANUAL' || !sub.currentPeriodEnd) return 'FREE';
  const now = new Date();
  
  // Strip time for day comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(sub.currentPeriodEnd);
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  const graceEnd = new Date(endDate);
  graceEnd.setDate(graceEnd.getDate() + 3);
  
  if (today.getTime() === endDate.getTime()) return 'DUE';
  if (today < endDate) return 'PAID';
  if (today <= graceEnd) return 'PAST_DUE';
  return 'EXPIRED';
}
`;

content = content.replace(/export function UserDetailClient/, statusHelper + '\nexport function UserDetailClient');

const manualSubBlock = `
          {/* Manual Subscription Management */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-black text-white mb-6 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-400" /> Manual Subscription
            </h2>
            
            {(() => {
              const sub = detail.entitlements?.subscription;
              const isManual = sub && sub.source === 'MANUAL';
              const status = computePaymentStatus(sub);
              
              return isManual ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase mb-1">Status</p>
                      <p className={\`text-sm font-bold \${status === 'PAID' ? 'text-emerald-400' : status === 'DUE' ? 'text-amber-400' : 'text-red-400'}\`}>{status}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase mb-1">Plan</p>
                      <p className="text-sm font-bold text-white">{detail.entitlements?.plan.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase mb-1">Amount</p>
                      <p className="text-sm font-bold text-white">${detail.entitlements?.plan.monthlyPrice || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase mb-1">Method</p>
                      <p className="text-sm font-bold text-white">MANUAL</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase mb-1">Activation</p>
                      <p className="text-sm font-bold text-white">{new Date(sub.startedAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase mb-1">Period Start</p>
                      <p className="text-sm font-bold text-white">{new Date(sub.currentPeriodStart).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase mb-1">Expiry / Renewal</p>
                      <p className="text-sm font-bold text-indigo-400">{new Date(sub.currentPeriodEnd).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase mb-1">Grace Period Ends</p>
                      <p className="text-sm font-bold text-slate-400">{(() => {
                        const d = new Date(sub.currentPeriodEnd);
                        d.setDate(d.getDate() + 3);
                        return d.toLocaleDateString();
                      })()}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-4 border-t border-slate-800">
                    <button 
                      onClick={() => handleAction('renew_manual')}
                      disabled={!!loadingAction}
                      className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-sm font-bold rounded-lg transition-colors"
                    >
                      Mark Paid & Renew 1 Month
                    </button>
                    <button 
                      onClick={() => handleAction('downgrade_free')}
                      disabled={!!loadingAction}
                      className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-sm font-bold rounded-lg transition-colors"
                    >
                      Downgrade to Free
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-400 font-medium">No manual subscription is currently active for this workspace.</p>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleAction('assign_manual', { planCode: 'STARTER' })}
                      disabled={!!loadingAction}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition-colors"
                    >
                      Assign Starter (Manual)
                    </button>
                    <button 
                      onClick={() => handleAction('assign_manual', { planCode: 'PRO' })}
                      disabled={!!loadingAction}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold rounded-lg transition-colors"
                    >
                      Assign Pro (Manual)
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
`;

content = content.replace(/<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">\s*<h2 className="text-lg font-black text-white mb-6 flex items-center gap-2">\s*<CreditCard className="w-5 h-5 text-emerald-400" \/> Administrative Actions\s*<\/h2>/, manualSubBlock + '\n          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">\n            <h2 className="text-lg font-black text-white mb-6 flex items-center gap-2">\n              <CreditCard className="w-5 h-5 text-emerald-400" /> Administrative Actions\n            </h2>');

fs.writeFileSync(path, content);
console.log('Patched UI for manual billing');
