import { useProfile } from './useProfile';
import { getEntitlements, type Entitlements, type PlanType } from '../lib/entitlements';

/**
 * Hook to get current plan and entitlements
 * Reads from player profile
 */
export function usePlan() {
  const { data: profile } = useProfile();

  // For now, assume all users are on Free plan
  // In production, this would come from the profile API response
  const plan: PlanType = (profile?.plan as PlanType) || 'free';
  const entitlements: Entitlements = getEntitlements(plan);

  return {
    plan,
    entitlements,
    isPro: plan === 'pro' || plan === 'founding',
    isFree: plan === 'free',
    isFoundingMember: plan === 'founding',
  };
}

/**
 * Hook to check if a specific feature is available
 */
export function useFeatureAccess(feature: keyof Omit<Entitlements, 'plan'>) {
  const { entitlements } = usePlan();
  return entitlements[feature] as boolean;
}
