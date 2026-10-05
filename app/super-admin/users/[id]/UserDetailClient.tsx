'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Shield, CreditCard, Activity, Box 
} from 'lucide-react';


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

export function UserDetailClient({ detail, plans }: { detail: any, plans: any[] }) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleAction = async (action: string, payload: any = {}) => {
    setLoadingAction(action);
    setMessage(null);
    try {
      const res = await fetch(`/api/super-admin/users/${detail.user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
      });
      let data: any = {};
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error('Failed to parse JSON:', text);
        }
      }
      
      if (!res.ok) {
        throw new Error(data.error || `Action failed (${res.status})`);
      }
      
      setMessage({ 
        type: 'success', 
        text: data.message || 'Action successful' 
      });
      router.refresh();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const isSuspended = detail.user.status === 'SUSPENDED';

  return (
    <div className="space-y-8">
      <div>
        <Link href="/super-admin/users" className="inline-flex items-center text-sm font-semibold text-neutral-400 hover:text-red-400 mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Users
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-2xl font-black">
              {detail.user.firstName[0]}{detail.user.lastName[0]}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
                {detail.user.firstName} {detail.user.lastName}
                {detail.user.systemRole === 'SUPER_ADMIN' && (
                  <Shield className="w-6 h-6 text-amber-400" />
                )}
              </h1>
              <p className="text-neutral-400 font-medium">{detail.user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isSuspended ? (
              <button
                onClick={() => handleAction('unsuspend')}
                disabled={!!loadingAction}
                className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-sm hover:bg-emerald-500/20 transition-all"
              >
                {loadingAction === 'unsuspend' ? 'Working...' : 'Unsuspend Account'}
              </button>
            ) : (
              <button
                onClick={() => handleAction('suspend', { reason: 'Admin action' })}
                disabled={!!loadingAction}
                className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-bold text-sm hover:bg-red-500/20 transition-all"
              >
                {loadingAction === 'suspend' ? 'Working...' : 'Suspend Account'}
              </button>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-sm font-bold border ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workspace & Plan Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#0f0505] border border-[#2a1010] rounded-2xl p-6">
            <h2 className="text-lg font-black text-white mb-6 flex items-center gap-2">
              <Box className="w-5 h-5 text-red-400" /> Workspace Details
            </h2>
            {detail.workspace ? (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-neutral-500 font-bold uppercase mb-1">Name</p>
                  <p className="text-base font-bold text-neutral-200">{detail.workspace.name}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 font-bold uppercase mb-1">Status</p>
                  <p className="text-base font-bold text-neutral-200">{detail.workspace.status}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 font-bold uppercase mb-1">Effective Plan</p>
                  <p className="text-base font-bold text-red-400">{detail.entitlements?.plan.name || 'Free'}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 font-bold uppercase mb-1">Entitlement Source</p>
                  <p className="text-base font-bold text-amber-400">{detail.entitlements?.source || 'FREE'}</p>
                </div>
              </div>
            ) : (
              <p className="text-neutral-500 text-sm font-medium">No workspace associated.</p>
            )}
          </div>

          <div className="bg-[#0f0505] border border-[#2a1010] rounded-2xl p-6">
            <h2 className="text-lg font-black text-white mb-6 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" /> Administrative Actions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#050202] border border-[#2a1010]">
                <h3 className="text-sm font-bold text-white mb-2">Change Plan</h3>
                <div className="flex gap-2">
                  <select 
                    id="planSelect"
                    className="flex-1 bg-[#0f0505] border border-[#3a1515] rounded-lg text-sm px-3 py-2 text-white"
                  >
                    {plans.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                  </select>
                  <button 
                    onClick={() => {
                      const sel = document.getElementById('planSelect') as HTMLSelectElement;
                      handleAction('change_plan', { planCode: sel.value });
                    }}
                    disabled={!!loadingAction}
                    className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg"
                  >
                    Assign
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#050202] border border-[#2a1010]">
                <h3 className="text-sm font-bold text-white mb-2">Complimentary Access</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleAction('grant_complimentary_access', { planCode: 'PRO', lifetime: false, expiresAt: new Date(Date.now() + 30*24*3600*1000).toISOString() })}
                    disabled={!!loadingAction}
                    className="flex-1 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-sm font-bold rounded-lg transition-colors"
                  >
                    Grant 30 Days Pro
                  </button>
                  <button 
                    onClick={() => handleAction('revoke_override')}
                    disabled={!!loadingAction}
                    className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-sm font-bold rounded-lg transition-colors"
                    title="Revoke Overrides"
                  >
                    Revoke
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#050202] border border-[#2a1010]">
                <h3 className="text-sm font-bold text-white mb-2">Starter Plan</h3>
                <button 
                  onClick={() => handleAction('change_plan', { planCode: 'STARTER' })}
                  disabled={!!loadingAction}
                  className="w-full px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-sm font-bold rounded-lg transition-colors"
                >
                  Force Assign Starter
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[#050202] border border-[#2a1010]">
                <h3 className="text-sm font-bold text-white mb-2">Trial Extension</h3>
                <button 
                  onClick={() => handleAction('extend_trial', { planCode: 'STARTER', days: 14 })}
                  disabled={!!loadingAction}
                  className="w-full px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-sm font-bold rounded-lg transition-colors"
                >
                  Extend Trial (14 Days)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Activity */}
        <div className="space-y-6">
          <div className="bg-[#0f0505] border border-[#2a1010] rounded-2xl p-6">
            <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-red-400" /> Recent Activity
            </h2>
            {detail.recentActivity?.length > 0 ? (
              <div className="space-y-4">
                {detail.recentActivity.slice(0, 5).map((act: any) => (
                  <div key={act.id} className="pb-4 border-b border-[#2a1010]/50 last:border-0 last:pb-0">
                    <p className="text-sm font-bold text-neutral-200">{act.action}</p>
                    <p className="text-xs text-neutral-400 mt-1">{act.details}</p>
                    <p className="text-[10px] text-neutral-500 font-semibold mt-1">
                      {new Date(act.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500 font-medium">No recent activity.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
