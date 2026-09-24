import { getAdminOverview } from '@/lib/admin-data';
import prisma from '@/lib/prisma';

export default async function SuperAdminBillingPage() {
  const [overview, recentPayments] = await Promise.all([
    getAdminOverview(),
    prisma.paymentTransaction.findMany({
      include: { workspace: true, plan: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ]);

  const stats = [
    { label: 'Active Subscriptions', value: overview.stats.activeSubscriptions },
    { label: 'Manual Subscriptions', value: overview.stats.manualSubscriptions },
    { label: 'Complimentary Users', value: overview.stats.complimentaryUsers },
    { label: 'MRR', value: '$0' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-amber-300">Revenue</p>
        <h2 className="text-3xl font-black text-white tracking-tight mt-1">Billing Overview</h2>
        <p className="text-sm text-slate-400 mt-2">Revenue placeholders plus real subscription, manual, and complimentary access counts.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-[#0d1322] border border-slate-800 p-5">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">{stat.label}</p>
            <p className="text-3xl font-black text-white mt-6">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-[#0d1322] border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 text-sm font-black text-white">Recent Transactions</div>
        <div className="divide-y divide-slate-800">
          {recentPayments.length === 0 ? (
            <p className="px-5 py-10 text-sm text-slate-500 text-center">No payment transactions recorded yet.</p>
          ) : (
            recentPayments.map((payment) => (
              <div key={payment.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-black text-white">{payment.workspace.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{payment.provider} · {payment.reference || 'No reference'}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-white">{payment.currency} {payment.amount}</p>
                  <p className="text-xs text-slate-500 mt-1">{payment.plan?.name || 'No plan'} · {payment.status}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
