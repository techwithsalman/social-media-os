'use client';

import React, { useState } from 'react';
import { CheckCircle2, Save } from 'lucide-react';

const featureFields = [
  ['bulkUploadEnabled', 'Bulk Upload'],
  ['analyticsEnabled', 'Analytics'],
  ['advancedAnalyticsEnabled', 'Advanced Analytics'],
  ['schedulingEnabled', 'Scheduling'],
  ['customCaptionsEnabled', 'Custom Captions'],
  ['prioritySupportEnabled', 'Priority Support'],
] as const;

export function PlansClient({ initialPlans }: { initialPlans: any[] }) {
  const [plans, setPlans] = useState(initialPlans);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);

  const updatePlanField = (planId: string, field: string, value: string | number | boolean) => {
    setPlans((current) =>
      current.map((plan) => (plan.id === planId ? { ...plan, [field]: value } : plan))
    );
  };

  const savePlan = async (plan: any) => {
    setSavingPlanId(plan.id);
    setSavedPlanId(null);

    const res = await fetch('/api/super-admin/plans', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    });
    const data = await res.json();

    if (res.ok) {
      setPlans((current) => current.map((item) => (item.id === plan.id ? data.plan : item)));
      setSavedPlanId(plan.id);
      setTimeout(() => setSavedPlanId(null), 2500);
    } else {
      alert(data.error || 'Failed to save plan.');
    }

    setSavingPlanId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-amber-300">Plan Management</p>
        <h2 className="text-3xl font-black text-white tracking-tight mt-1">Plans & Limits</h2>
        <p className="text-sm text-slate-400 mt-2">Edit pricing, usage limits, feature access, and active status without deleting assigned plans.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {plans.map((plan) => (
          <div key={plan.id} className="rounded-2xl bg-[#0d1322] border border-slate-800 p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black text-amber-300 uppercase tracking-wider">{plan.code}</p>
                <input
                  value={plan.name}
                  onChange={(event) => updatePlanField(plan.id, 'name', event.target.value)}
                  className="mt-1 w-full bg-transparent text-2xl font-black text-white focus:outline-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={plan.active}
                  onChange={(event) => updatePlanField(plan.id, 'active', event.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-400"
                />
                <span>Active</span>
              </label>
            </div>

            <textarea
              value={plan.description}
              onChange={(event) => updatePlanField(plan.id, 'description', event.target.value)}
              className="w-full min-h-20 px-3 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
            />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['monthlyPrice', 'Monthly'],
                ['yearlyPrice', 'Yearly'],
                ['maxSocialAccounts', 'Accounts'],
                ['monthlyPostLimit', 'Posts'],
                ['maxTeamMembers', 'Team'],
                ['storageLimitMB', 'Storage MB'],
                ['sortOrder', 'Sort'],
              ].map(([field, label]) => (
                <label key={field} className="block">
                  <span className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">{label}</span>
                  <input
                    type="number"
                    value={plan[field]}
                    onChange={(event) => updatePlanField(plan.id, field, Number(event.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                  />
                </label>
              ))}
              <label className="block">
                <span className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Currency</span>
                <input
                  value={plan.currency}
                  onChange={(event) => updatePlanField(plan.id, 'currency', event.target.value.toUpperCase())}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {featureFields.map(([field, label]) => (
                <label key={field} className="flex items-center justify-between gap-4 rounded-xl bg-slate-950/70 border border-slate-800 px-4 py-3 text-sm font-bold text-slate-300">
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(plan[field])}
                    onChange={(event) => updatePlanField(plan.id, field, event.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-400"
                  />
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
              {savedPlanId === plan.id ? (
                <span className="inline-flex items-center gap-2 text-sm font-black text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" />
                  Saved
                </span>
              ) : (
                <span className="text-xs text-slate-500">Changes are audited.</span>
              )}
              <button
                onClick={() => savePlan(plan)}
                disabled={savingPlanId === plan.id}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-black disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingPlanId === plan.id ? 'Saving...' : 'Save Plan'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
