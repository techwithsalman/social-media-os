import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { isOwnerUser } from '@/lib/owner';
import { SuperAdminShell } from '@/components/layout/SuperAdminShell';

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?session_invalid=1&redirect=/super-admin');
  }

  // Strict check: Only the verified owner has Super Admin access
  if (!isOwnerUser(user)) {
    redirect('/dashboard');
  }

  return (
    <SuperAdminShell
      user={{
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      }}
    >
      {children}
    </SuperAdminShell>
  );
}
