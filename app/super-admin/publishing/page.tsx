import { auditScheduledPosts } from '@/lib/super-admin-scheduled-cancel';
import { PublishingManagementClient } from './PublishingManagementClient';

export const dynamic = 'force-dynamic';

export default async function SuperAdminPublishingPage() {
  const initialAudit = await auditScheduledPosts();

  return (
    <div className="p-6 md:p-10 space-y-8">
      <PublishingManagementClient initialAudit={initialAudit} />
    </div>
  );
}
