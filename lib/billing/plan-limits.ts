import prisma from '../prisma';
import { getEffectivePlan } from '../billing';

export const PLAN_LIMITS = {
  FREE: {
    accounts: 4,
    instagramAutoDm: 3,
    bulkUploadVideos: 20,
    postsPerMonth: 100,
    teamMembers: 1,
    features: {
      anyCommentAutoDm: false,
    },
  },
  STARTER: {
    accounts: 15,
    instagramAutoDm: 20,
    bulkUploadVideos: 100,
    postsPerMonth: 500,
    teamMembers: 2,
    features: {
      anyCommentAutoDm: true,
    },
  },
  PRO: {
    accounts: 30,
    instagramAutoDm: 75,
    bulkUploadVideos: 500,
    postsPerMonth: 1500,
    teamMembers: 5,
    features: {
      anyCommentAutoDm: true,
    },
  },
  AGENCY: {
    accounts: 100,
    instagramAutoDm: 250,
    bulkUploadVideos: 2000,
    postsPerMonth: 5000,
    teamMembers: 20,
    features: {
      anyCommentAutoDm: true,
    },
  },
};

export type PlanType = keyof typeof PLAN_LIMITS;

export const getPlanLimits = (planCode: string) => {
  const normalizedPlan = (planCode || 'FREE').toUpperCase();
  return PLAN_LIMITS[normalizedPlan as PlanType] || PLAN_LIMITS.FREE;
};

export class PlanLimitError extends Error {
  public feature: string;
  public limit: number | boolean;
  public used: number;
  public plan: string;

  constructor(feature: string, limit: number | boolean, used: number, plan: string, message: string) {
    super(message);
    this.name = 'PlanLimitError';
    this.feature = feature;
    this.limit = limit;
    this.used = used;
    this.plan = plan;
  }
}

export function createPlanLimitResponse(error: PlanLimitError) {
  return Response.json(
    {
      error: 'PLAN_LIMIT_REACHED',
      feature: error.feature,
      limit: error.limit,
      used: error.used,
      plan: error.plan,
      message: error.message,
    },
    { status: 403 }
  );
}

export async function checkPlanLimit(
  workspaceId: string,
  feature: keyof typeof PLAN_LIMITS.FREE,
  currentUsage: number
) {
  const { plan } = await getEffectivePlan(workspaceId);
  const normalizedPlan = (plan.code || 'FREE').toUpperCase();
  const limits = PLAN_LIMITS[normalizedPlan as PlanType] || PLAN_LIMITS.FREE;

  const limit = limits[feature];
  if (typeof limit === 'number' && currentUsage >= limit) {
    throw new PlanLimitError(
      feature,
      limit,
      currentUsage,
      normalizedPlan,
      `You have reached your limit of ${limit} for ${feature} on the ${normalizedPlan} plan.`
    );
  }
}

