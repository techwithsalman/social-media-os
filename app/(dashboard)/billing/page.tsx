'use client';

import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Check, Minus, Sparkles } from 'lucide-react';

type BillingCycle = 'MONTHLY' | 'YEARLY';
type LimitValue = number | null;

interface BillingPlan {
  id: string;
  code: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  maxSocialAccounts: LimitValue;
  monthlyPostLimit: LimitValue;
  maxTeamMembers: LimitValue;
  storageLimitMB: LimitValue;
  bulkUploadEnabled: boolean;
  analyticsEnabled: boolean;
  advancedAnalyticsEnabled: boolean;
  schedulingEnabled: boolean;
  customCaptionsEnabled: boolean;
  prioritySupportEnabled: boolean;
  active: boolean;
}

interface BillingSummary {
  plans: BillingPlan[];
  entitlements: {
    plan: {
      code: string;
    };
    source: string;
    override: {
      lifetime: boolean;
      expiresAt: string | null;
    } | null;
  };
}

type FeatureFlagField =
  | 'bulkUploadEnabled'
  | 'analyticsEnabled'
  | 'advancedAnalyticsEnabled'
  | 'schedulingEnabled'
  | 'customCaptionsEnabled'
  | 'prioritySupportEnabled';

const FEATURE_FIELDS: Array<{ field: FeatureFlagField; label: string }> = [
  { field: 'bulkUploadEnabled', label: 'Bulk upload' },
  { field: 'analyticsEnabled', label: 'Analytics' },
  { field: 'advancedAnalyticsEnabled', label: 'Advanced analytics' },
  { field: 'schedulingEnabled', label: 'Scheduling' },
  { field: 'customCaptionsEnabled', label: 'Custom captions' },
  { field: 'prioritySupportEnabled', label: 'Priority support' },
];

const PLAN_BADGES: Record<string, string> = {
  FREE: 'Free Tier',
  STARTER: 'Popular',
  PRO: 'Best Value',
  AGENCY: 'Enterprise',
};

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const numberFormatter = new Intl.NumberFormat('en-US');

function formatDate(value?: string | null) {
  return value ? dateFormatter.format(new Date(value)) : 'Not set';
}

function formatMoney(amount: number, currency: string) {
  const majorAmount = amount / 100;

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: Number.isInteger(majorAmount) ? 0 : 2,
    }).format(majorAmount);
  } catch {
    return `${currency} ${majorAmount.toFixed(Number.isInteger(majorAmount) ? 0 : 2)}`;
  }
}

function formatQuantityLimit(limit: LimitValue, singular: string, plural: string) {
  if (limit === null) return `Unlimited ${plural}`;
  return `Up to ${numberFormatter.format(limit)} ${limit === 1 ? singular : plural}`;
}

function formatPostLimit(limit: LimitValue) {
  if (limit === null) return 'Unlimited scheduled/published posts per month';
  return `${numberFormatter.format(limit)} scheduled/published ${limit === 1 ? 'post' : 'posts'} per month`;
}

function formatStorageLimit(limit: LimitValue) {
  if (limit === null) return 'Unlimited storage';
  if (limit >= 1024) {
    const gb = limit / 1024;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB storage`;
  }

  return `${numberFormatter.format(limit)} MB storage`;
}

function getPlanPrice(plan: BillingPlan, billingCycle: BillingCycle) {
  const amount = billingCycle === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;
  const freeForever = plan.monthlyPrice === 0 && plan.yearlyPrice === 0;

  return {
    price: formatMoney(amount, plan.currency),
    period: freeForever ? 'forever' : billingCycle === 'YEARLY' ? 'per year' : 'per month',
  };
}

function getAnnualSavings(plans: BillingPlan[]) {
  const savings = plans
    .map((plan) => {
      const monthlyAnnualized = plan.monthlyPrice * 12;
      if (monthlyAnnualized <= 0 || plan.yearlyPrice <= 0 || plan.yearlyPrice >= monthlyAnnualized) {
        return null;
      }

      return Math.round(((monthlyAnnualized - plan.yearlyPrice) / monthlyAnnualized) * 100);
    })
    .filter((value): value is number => value !== null && value > 0);

  return savings.length > 0 ? Math.max(...savings) : null;
}

function getPlanFeatures(plan: BillingPlan) {
  return [
    {
      text: formatQuantityLimit(
        plan.maxSocialAccounts,
        'connected social account',
        'connected social accounts'
      ),
      enabled: true,
    },
    {
      text: formatPostLimit(plan.monthlyPostLimit),
      enabled: true,
    },
    {
      text: formatQuantityLimit(plan.maxTeamMembers, 'team member', 'team members'),
      enabled: true,
    },
    {
      text: formatStorageLimit(plan.storageLimitMB),
      enabled: true,
    },
    ...FEATURE_FIELDS.map(({ field, label }) => {
      const enabled = Boolean(plan[field]);
      return {
        text: `${label}: ${enabled ? 'Enabled' : 'Disabled'}`,
        enabled,
      };
    }),
  ];
}

function getPlanBadge(plan: BillingPlan, isCurrent: boolean) {
  return isCurrent ? 'Current Plan' : PLAN_BADGES[plan.code] || 'Plan';
}

function getPlanButtonText(plan: BillingPlan, isCurrent: boolean) {
  if (isCurrent) return 'Current Active Tier';
  if (plan.code === 'FREE') return `Switch to ${plan.name}`;
  if (plan.code === 'AGENCY') return 'Contact Sales';
  return `Upgrade to ${plan.name}`;
}

export default function BillingPage() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('YEARLY');
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBillingSummary() {
      try {
        const res = await fetch('/api/billing/summary', { cache: 'no-store' });
        if (!res.ok) return;

        const data = await res.json();
        if (!cancelled) {
          setBillingSummary(data);
        }
      } catch (error) {
        console.error('Failed to load billing summary:', error);
      }
    }

    loadBillingSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  const activePlans = (billingSummary?.plans || []).filter((plan) => plan.active);
  const annualSavings = getAnnualSavings(activePlans);
  const effectivePlanCode = billingSummary?.entitlements.plan.code;
  const activeOverride = billingSummary?.entitlements.source === 'OVERRIDE'
    ? billingSummary.entitlements.override
    : null;
  const complimentaryAccessLabel = activeOverride
    ? activeOverride.lifetime
      ? 'Lifetime Complimentary Access'
      : activeOverride.expiresAt
      ? `Complimentary Access until ${formatDate(activeOverride.expiresAt)}`
      : 'Complimentary Access'
    : null;

  return (
    <AppLayout title="Subscription & Billing">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-sm font-bold mb-4">
          <Sparkles className="w-4 h-4" />
          <span>Flexible SaaS Plans</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
          Scale your social media operations
        </h1>
        <p className="text-base md:text-lg text-slate-300 mt-3 leading-relaxed">
          Transparent pricing designed for individual creators, high-growth startups, and global marketing agencies.
        </p>

        {/* Billing cycle switch */}
        <div className="inline-flex items-center bg-[#0d1322] border border-slate-800 rounded-2xl p-1.5 mt-8 text-sm font-bold shadow-md">
          <button
            onClick={() => setBillingCycle('MONTHLY')}
            className={`px-5 py-2 rounded-xl transition-all ${
              billingCycle === 'MONTHLY'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('YEARLY')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl transition-all ${
              billingCycle === 'YEARLY'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Annual</span>
            {annualSavings !== null && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-black">
                Save up to {annualSavings}%
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {activePlans.map((plan) => {
          const isCurrent = effectivePlanCode === plan.code;
          const badge = getPlanBadge(plan, isCurrent);
          const { price, period } = getPlanPrice(plan, billingCycle);
          const features = getPlanFeatures(plan);

          return (
            <div
              key={plan.id}
              data-plan-code={plan.code}
              data-current-plan={isCurrent || undefined}
              className={`rounded-3xl p-7 md:p-8 flex flex-col justify-between transition-all relative ${
                plan.code === 'PRO'
                  ? 'bg-[#0f172a] border-2 border-indigo-500 shadow-2xl shadow-indigo-500/20 scale-[1.02]'
                  : 'bg-[#0d1322] border border-slate-800 shadow-md'
              }`}
            >
              {plan.code === 'PRO' && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-black uppercase tracking-wider shadow-lg">
                  {badge}
                </span>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  {plan.code !== 'PRO' && (
                    <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
                      {badge}
                    </span>
                  )}
                </div>

                <p className="text-xs md:text-sm text-slate-400 min-h-[44px] leading-relaxed">{plan.description}</p>

                <div className="my-6">
                  <span className="text-4xl md:text-5xl font-black text-white">{price}</span>
                  <span className="text-sm text-slate-400 ml-2 font-medium">{period}</span>
                </div>

                {isCurrent && complimentaryAccessLabel && (
                  <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-200">
                    {complimentaryAccessLabel}
                  </div>
                )}

                <div className="space-y-3 pt-5 border-t border-slate-800">
                  {features.map((feature) => {
                    const Icon = feature.enabled ? Check : Minus;

                    return (
                      <div
                        key={feature.text}
                        className={`flex items-start gap-3 text-xs md:text-sm ${
                          feature.enabled ? 'text-slate-200' : 'text-slate-500'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            feature.enabled ? 'text-emerald-400' : 'text-slate-600'
                          }`}
                        />
                        <span>{feature.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                disabled={isCurrent}
                onClick={() => alert(`${getPlanButtonText(plan, false)} is ready for stripe/payment checkout integration.`)}
                className={`w-full mt-8 py-3.5 px-5 rounded-2xl text-sm font-black transition-all ${
                  isCurrent
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-default'
                    : plan.code === 'PRO'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-600/40 hover:scale-[1.02]'
                    : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                }`}
              >
                {getPlanButtonText(plan, isCurrent)}
              </button>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
