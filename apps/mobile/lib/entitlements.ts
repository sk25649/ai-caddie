/**
 * Entitlements system for AI Caddie
 * Manages Free vs Pro plan features
 */

export type PlanType = 'free' | 'pro' | 'founding';

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
    case 'pro':
      return {
        plan: 'pro',
        playbooksPerMonth: Infinity,
        canExportYardageBook: true,
        canAccessPostRoundReview: true,
        canAccessCourseMemory: true,
        canCreateCustomCourses: true,
        canAccessTrustLoop: true,
      };
    case 'founding':
      return {
        plan: 'founding',
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
