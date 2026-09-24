import prisma from '@/lib/prisma';
import { History } from 'lucide-react';

export default async function SuperAdminActivityPage() {
  const activity = await prisma.activityLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-amber-300">Audit Logs</p>
        <h2 className="text-3xl font-black text-white tracking-tight mt-1">Activity Log</h2>
        <p className="text-sm text-slate-400 mt-2">Plan, payment, access, suspension, usage, publishing, and system events.</p>
      </div>

      <div className="rounded-2xl bg-[#0d1322] border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2 text-sm font-black text-white">
          <History className="w-4 h-4 text-amber-300" />
          <span>{activity.length} latest event(s)</span>
        </div>
        <div className="divide-y divide-slate-800">
          {activity.map((item) => (
            <div key={item.id} className="px-5 py-4 hover:bg-slate-900/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-wider text-amber-300">{item.action.replaceAll('_', ' ')}</p>
                <p className="text-xs text-slate-500">{item.createdAt.toLocaleString()}</p>
              </div>
              <p className="text-sm text-slate-300 mt-1.5">{item.details || 'No details recorded.'}</p>
              {(item.actorUserId || item.targetUserId || item.workspaceId) && (
                <p className="text-xs text-slate-500 mt-2">
                  Actor: {item.actorUserId || 'system'} · Target: {item.targetUserId || 'none'} · Workspace: {item.workspaceId || 'global'}
                </p>
              )}
              {item.metadata && (
                <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-slate-400">
                  {item.metadata}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
