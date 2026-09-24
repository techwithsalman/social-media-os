'use client';

import React, { useState } from 'react';
import { CheckCircle2, WalletCards } from 'lucide-react';

export function PaymentsClient({
  users,
  plans,
  initialPayments,
}: {
  users: any[];
  plans: any[];
  initialPayments: any[];
}) {
  const [payments, setPayments] = useState(initialPayments);
  const [userId, setUserId] = useState(users[0]?.id || '');
  const [planCode, setPlanCode] = useState('PRO');
  const [amount, setAmount] = useState(5999);
  const [currency, setCurrency] = useState('PKR');
  const [provider, setProvider] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [months, setMonths] = useState(1);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const submitPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSuccess('');

    const res = await fetch('/api/super-admin/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, planCode, amount, currency, provider, reference, months, notes }),
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Failed to record payment.');
    } else {
      setSuccess('Payment recorded and subscription activated.');
      const refreshed = await fetch('/api/super-admin/payments').then((r) => r.json());
      setPayments(refreshed.payments || []);
      setReference('');
      setNotes('');
    }

    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-amber-300">Payments</p>
        <h2 className="text-3xl font-black text-white tracking-tight mt-1">Manual Payment Records</h2>
        <p className="text-sm text-slate-400 mt-2">Record offline payments and activate plans before online payment gateways are connected.</p>
      </div>

      <form onSubmit={submitPayment} className="rounded-2xl bg-[#0d1322] border border-slate-800 p-6 space-y-5">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-800">
          <WalletCards className="w-5 h-5 text-amber-300" />
          <h3 className="text-lg font-black text-white">Record Manual Payment</h3>
        </div>

        {success && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 px-4 py-3 text-sm font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{success}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label>
            <span className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">User</span>
            <select value={userId} onChange={(event) => setUserId(event.target.value)} className="w-full px-3 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white">
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name} · {user.email}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Plan</span>
            <select value={planCode} onChange={(event) => setPlanCode(event.target.value)} className="w-full px-3 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white">
              {plans.filter((plan) => plan.code !== 'FREE').map((plan) => (
                <option key={plan.id} value={plan.code}>{plan.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Duration Months</span>
            <input type="number" min={1} value={months} onChange={(event) => setMonths(Number(event.target.value))} className="w-full px-3 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white" />
          </label>
          <label>
            <span className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Amount</span>
            <input type="number" min={0} value={amount} onChange={(event) => setAmount(Number(event.target.value))} className="w-full px-3 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white" />
          </label>
          <label>
            <span className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Currency</span>
            <input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className="w-full px-3 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white" />
          </label>
          <label>
            <span className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Method</span>
            <select value={provider} onChange={(event) => setProvider(event.target.value)} className="w-full px-3 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white">
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="RAAST">Raast</option>
              <option value="CASH">Cash</option>
              <option value="SAFE_PAY">Safepay</option>
              <option value="STRIPE">Stripe</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label>
            <span className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Reference</span>
            <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="ABC123" className="w-full px-3 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white" />
          </label>
          <label className="md:col-span-2">
            <span className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Notes</span>
            <input value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full px-3 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white" />
          </label>
        </div>

        <div className="flex justify-end">
          <button disabled={saving || !userId} className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black disabled:opacity-50">
            {saving ? 'Recording...' : 'Record Payment & Activate Plan'}
          </button>
        </div>
      </form>

      <div className="rounded-2xl bg-[#0d1322] border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 text-sm font-black text-white">{payments.length} payment record(s)</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-950/70 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-5 py-3">Workspace</th>
                <th className="text-left px-5 py-3">Owner</th>
                <th className="text-left px-5 py-3">Plan</th>
                <th className="text-left px-5 py-3">Amount</th>
                <th className="text-left px-5 py-3">Method</th>
                <th className="text-left px-5 py-3">Reference</th>
                <th className="text-left px-5 py-3">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {payments.map((payment) => {
                const owner = payment.workspace?.members?.[0]?.user;
                return (
                  <tr key={payment.id} className="hover:bg-slate-900/50">
                    <td className="px-5 py-4 text-white font-black">{payment.workspace?.name}</td>
                    <td className="px-5 py-4 text-slate-300">{owner ? `${owner.firstName} ${owner.lastName}` : 'No owner'}<p className="text-xs text-slate-500">{owner?.email}</p></td>
                    <td className="px-5 py-4 text-slate-300">{payment.plan?.name || 'No plan'}</td>
                    <td className="px-5 py-4 text-slate-300">{payment.currency} {payment.amount}</td>
                    <td className="px-5 py-4 text-slate-300">{payment.provider}</td>
                    <td className="px-5 py-4 text-slate-400">{payment.reference || 'None'}</td>
                    <td className="px-5 py-4 text-slate-400">{payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : 'Not paid'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
