import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { SuperAdminShell } from '@/components/layout/SuperAdminShell';

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?redirect=/super-admin');
  }

  if (user.systemRole !== 'SUPER_ADMIN') {
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
