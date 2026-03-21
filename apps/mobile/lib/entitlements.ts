/**
 * Entitlements system for AI Caddie
 * Manages Free vs Pro plan features
 *
 * Source of truth priority:
 *   1. RevenueCat active entitlements (when SDK is configured)
 *   2. Profile plan field from API (fallback)
 *   3. 'free' (default)
 */

import type { RevenueCatCustomerInfo } from './revenuecat';
import { hasProEntitlement } from './revenuecat';

export type PlanType = 'free' | 'pro_monthly' | 'pro_annual';

export interface Entitlements {
  plan: PlanType;
  playbooksPerMonth: number; // Free: 1, Pro: unlimited
  canExportYardageBook: boolean; // Free: false, Pro: true
  canAccessPostRoundReview: boolean; // Free: false, Pro: true
  canAccessCourseMemory: boolean; // Free: false, Pro: true
  canCreateCustomCourses: boolean; // Free: false, Pro: true
  canAccessTrustLoop: boolean; // Free: false, Pro: true
}

/**
 * Get entitlements for a given plan
 */
export function getEntitlements(plan: PlanType): Entitlements {
  switch (plan) {
    case 'free':
      return {
        plan: 'free',
        playbooksPerMonth: 1,
        canExportYardageBook: false,
        canAccessPostRoundReview: false,
        canAccessCourseMemory: false,
        canCreateCustomCourses: false,
        canAccessTrustLoop: false,
      };
    case 'pro_monthly':
    case 'pro_annual':
      return {
        plan,
        playbooksPerMonth: Infinity,
        canExportYardageBook: true,
        canAccessPostRoundReview: true,
        canAccessCourseMemory: true,
        canCreateCustomCourses: true,
        canAccessTrustLoop: true,
      };
  }
}

/**
 * Resolve PlanType from RevenueCat customer info.
 * Falls back to 'free' if RevenueCat is not configured or has no active entitlement.
 */
export function getPlanFromRevenueCat(
  customerInfo: RevenueCatCustomerInfo | null
): PlanType {
  if (!customerInfo) return 'free';
  if (!hasProEntitlement(customerInfo)) return 'free';

  // Determine monthly vs annual by active product ID
  const activeProducts = customerInfo.activeSubscriptions;
  if (activeProducts.some((id) => id.includes('annual'))) return 'pro_annual';
  return 'pro_monthly';
}

/**
 * Resolve PlanType from a legacy profile plan string.
 * Handles old 'pro' / 'founding' strings for backwards compat.
 */
export function normalizePlanType(raw: string | undefined): PlanType {
  if (!raw) return 'free';
  if (raw === 'pro' || raw === 'founding' || raw === 'pro_monthly') return 'pro_monthly';
  if (raw === 'pro_annual') return 'pro_annual';
  return 'free';
}

/**
 * Check if a feature is available for a plan
 */
export function canAccess(
  plan: PlanType,
  feature: keyof Omit<Entitlements, 'plan'>
): boolean {
  const entitlements = getEntitlements(plan);
  return entitlements[feature] as boolean;
}

/**
 * Feature gate identifiers for UI
 */
export const FEATURE_GATES = {
  UNLIMITED_PLAYBOOKS: 'unlimitedPlaybooks',
  YARDAGE_BOOK_EXPORT: 'yardageBookExport',
  POST_ROUND_REVIEW: 'postRoundReview',
  COURSE_MEMORY: 'courseMemory',
  CUSTOM_COURSES: 'customCourses',
  TRUST_LOOP: 'trustLoop',
} as const;

/**
 * Map feature gates to entitlements
 */
export function featureGateToEntitlement(
  gate: keyof typeof FEATURE_GATES
): keyof Omit<Entitlements, 'plan'> {
  const mapping: Record<keyof typeof FEATURE_GATES, keyof Omit<Entitlements, 'plan'>> = {
    UNLIMITED_PLAYBOOKS: 'playbooksPerMonth',
    YARDAGE_BOOK_EXPORT: 'canExportYardageBook',
    POST_ROUND_REVIEW: 'canAccessPostRoundReview',
    COURSE_MEMORY: 'canAccessCourseMemory',
    CUSTOM_COURSES: 'canCreateCustomCourses',
    TRUST_LOOP: 'canAccessTrustLoop',
  };
  return mapping[gate];
}
