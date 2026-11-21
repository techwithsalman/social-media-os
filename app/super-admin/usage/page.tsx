import {
  getSuperAdminUsageSummary,
  getSuperAdminUserUsageList,
  getSuperAdminGlobalStorageOverview,
} from '@/lib/usage-analytics';
import { UsageDashboardClient } from './UsageDashboardClient';

export const dynamic = 'force-dynamic';

export default async function SuperAdminUsagePage() {
  const [summary, users, storageOverview] = await Promise.all([
    getSuperAdminUsageSummary(),
    getSuperAdminUserUsageList({ sortBy: 'storage', order: 'desc' }),
    getSuperAdminGlobalStorageOverview(),
  ]);

  return (
    <div className="p-6 md:p-10 space-y-8">
      <UsageDashboardClient
        initialSummary={summary}
        initialUsers={users}
        initialStorage={storageOverview}
      />
    </div>
  );
}
