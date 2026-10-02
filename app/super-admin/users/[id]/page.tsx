import { notFound } from 'next/navigation';
import { getAdminUserDetail } from '@/lib/admin-data';
import { getPlans } from '@/lib/billing';
import { UserDetailClient } from './UserDetailClient';

export default async function SuperAdminUserDetailPage({ params }: { params: { id: string } }) {
  const [detail, plans] = await Promise.all([
    getAdminUserDetail(params.id),
    getPlans()
  ]);

  if (!detail) {
    notFound();
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <UserDetailClient detail={detail} plans={plans} />
    </div>
  );
}
