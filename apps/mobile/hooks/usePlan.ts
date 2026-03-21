import { useProfile } from './useProfile';
import {
  getEntitlements,
  getPlanFromRevenueCat,
  normalizePlanType,
  type Entitlements,
  type PlanType,
} from '../lib/entitlements';
import type { RevenueCatCustomerInfo } from '../lib/revenuecat';

/**
 * Hook to get current plan and entitlements.
 *
 * Pass RevenueCat customerInfo when the SDK is active.
 * Falls back to profile plan field, then 'free'.
 *
 * Usage (today, without SDK):
 *   const { plan, entitlements } = usePlan();
 *
 * Usage (once RevenueCat is wired up):
 *   const { plan, entitlements } = usePlan({ customerInfo });
 */
export function usePlan(options?: { customerInfo?: RevenueCatCustomerInfo | null }) {
  const { data: profile } = useProfile();

  let plan: PlanType;

  if (options?.customerInfo !== undefined) {
    // RevenueCat is the source of truth
    plan = getPlanFromRevenueCat(options.customerInfo);
  } else {
    // Fallback: use profile plan from API (handles legacy 'pro'/'founding' values)
    plan = normalizePlanType(profile?.plan as string | undefined);
  }

  const entitlements: Entitlements = getEntitlements(plan);

  return {
    plan,
    entitlements,
    isPro: plan === 'pro_monthly' || plan === 'pro_annual',
    isFree: plan === 'free',
    isProAnnual: plan === 'pro_annual',
    isProMonthly: plan === 'pro_monthly',
  };
}

/**
 * Hook to check if a specific feature is available
 */
export function useFeatureAccess(feature: keyof Omit<Entitlements, 'plan'>) {
  const { entitlements } = usePlan();
  return entitlements[feature] as boolean;
}
