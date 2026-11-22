import { auditR2Storage, getR2CleanupHistory } from '@/lib/storage/r2-audit-service';
import { StorageManagementClient } from './StorageManagementClient';

export const dynamic = 'force-dynamic';

export default async function SuperAdminStoragePage() {
  const [initialAudit, initialHistory] = await Promise.all([
    auditR2Storage(),
    getR2CleanupHistory(),
  ]);

  return (
    <div className="p-6 md:p-10 space-y-8">
      <StorageManagementClient initialAudit={initialAudit} initialHistory={initialHistory} />
    </div>
  );
}
