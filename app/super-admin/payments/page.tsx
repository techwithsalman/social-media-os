import prisma from '@/lib/prisma';
import { getAdminUserRows } from '@/lib/admin-data';
import { getPlans } from '@/lib/billing';
import { PaymentsClient } from './PaymentsClient';

export default async function SuperAdminPaymentsPage() {
  const [users, plans, payments] = await Promise.all([
    getAdminUserRows(),
    getPlans(),
    prisma.paymentTransaction.findMany({
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            members: {
              take: 1,
              include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
            },
          },
        },
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  return (
    <PaymentsClient
      users={users}
      plans={plans.map((plan) => ({
        ...plan,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      }))}
      initialPayments={payments.map((payment) => ({
        ...payment,
        paidAt: payment.paidAt?.toISOString() || null,
        createdAt: payment.createdAt.toISOString(),
      }))}
    />
  );
}
