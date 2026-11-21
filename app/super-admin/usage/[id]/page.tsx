import { notFound } from 'next/navigation';
import { getSuperAdminUserUsageDetail } from '@/lib/usage-analytics';
import { UserUsageDetailClient } from './UserUsageDetailClient';

export const dynamic = 'force-dynamic';

export default async function SuperAdminUserUsageDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const detail = await getSuperAdminUserUsageDetail(params.id, 'all');

  if (!detail) {
    notFound();
  }

  return (
    <div className="p-6 md:p-10 space-y-8">
      <UserUsageDetailClient initialDetail={detail} />
    </div>
  );
}
