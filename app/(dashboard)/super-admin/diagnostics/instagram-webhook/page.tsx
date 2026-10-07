import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Activity } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function InstagramWebhookDiagnosticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const userData = await prisma.user.findUnique({ where: { id: user.id } });
  if (!userData || userData.systemRole !== 'SUPER_ADMIN') {
    redirect('/accounts');
  }

  const logs = await prisma.activityLog.findMany({
    where: { action: 'IG_WEBHOOK_DIAGNOSTIC' },
    orderBy: { createdAt: 'desc' },
    take: 100
  });

  return (
    <AppLayout title="Instagram Webhook Diagnostics">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center space-x-3 mb-6">
          <Activity className="h-6 w-6 text-emerald-400" />
          <h2 className="text-xl font-medium text-white">Live Webhook Diagnostic Logs</h2>
        </div>
        
        {logs.length === 0 ? (
          <div className="bg-[#18181f] border border-[#272730] rounded-xl p-8 text-center text-neutral-400">
            No diagnostic logs found yet. Webhook POSTs will appear here.
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => {
              let metadata: any = {};
              try {
                metadata = JSON.parse(log.metadata || '{}');
              } catch (e) {}

              return (
                <div key={log.id} className="bg-[#18181f] border border-[#272730] rounded-xl p-6">
                  <div className="text-sm text-neutral-400 mb-4">{log.createdAt.toLocaleString()}</div>
                  <pre className="whitespace-pre-wrap font-mono text-xs text-emerald-400 bg-black/50 p-4 rounded-lg overflow-x-auto">
                    {metadata.logs ? metadata.logs.join('\n') : 'No logs array found'}
                  </pre>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
