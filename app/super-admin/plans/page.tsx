import { getPlans } from '@/lib/billing';
import { PlansClient } from './PlansClient';

export default async function SuperAdminPlansPage() {
  const plans = await getPlans();
  return (
    <PlansClient
      initialPlans={plans.map((plan) => ({
        ...plan,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      }))}
    />
  );
}
