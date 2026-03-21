/**
 * RevenueCat configuration and types for AI Caddie
 *
 * This module provides a safe abstraction over RevenueCat.
 * Before the SDK key is configured, all calls fall back gracefully.
 *
 * Setup steps (manual, for Siwan):
 * 1. Create RevenueCat account at revenuecat.com
 * 2. Add iOS app, get the public SDK key
 * 3. Set EXPO_PUBLIC_REVENUECAT_IOS_KEY in .env
 * 4. Create products in App Store Connect:
 *    - com.aicaddie.pro.monthly
 *    - com.aicaddie.pro.annual
 * 5. Create entitlement "pro" in RevenueCat dashboard
 * 6. Install react-native-purchases: npx expo install react-native-purchases
 * 7. Uncomment the SDK initialization below
 */

// Product IDs for App Store Connect
export const REVENUECAT_PRODUCT_IDS = {
  PRO_MONTHLY: 'com.aicaddie.pro.monthly',
  PRO_ANNUAL: 'com.aicaddie.pro.annual',
} as const;

// RevenueCat entitlement identifier
export const REVENUECAT_ENTITLEMENT_ID = 'pro';

// Public SDK key from environment (set EXPO_PUBLIC_REVENUECAT_IOS_KEY in .env)
export const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';

/**
 * Whether RevenueCat is configured (SDK key present)
 */
export function isRevenueCatConfigured(): boolean {
  return REVENUECAT_IOS_KEY.length > 0;
}

/**
 * RevenueCat customer info shape (mirrors react-native-purchases CustomerInfo)
 * Defined here so we can type-check without the SDK installed yet.
 */
export interface RevenueCatCustomerInfo {
  entitlements: {
    active: Record<string, { isActive: boolean; productIdentifier: string }>;
    all: Record<string, { isActive: boolean; productIdentifier: string }>;
  };
  activeSubscriptions: string[];
}

/**
 * Check if a RevenueCat customer has the pro entitlement active
 */
export function hasProEntitlement(customerInfo: RevenueCatCustomerInfo | null): boolean {
  if (!customerInfo) return false;
  return !!customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID]?.isActive;
}

/**
 * Determine active product ID from customer info (monthly or annual)
 */
export function getActiveProductId(
  customerInfo: RevenueCatCustomerInfo | null
): string | null {
  if (!customerInfo) return null;
  const entitlement = customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
  return entitlement?.productIdentifier ?? null;
}

/**
 * Whether active subscription is annual (vs monthly)
 */
export function isAnnualSubscription(
  customerInfo: RevenueCatCustomerInfo | null
): boolean {
  const productId = getActiveProductId(customerInfo);
  return productId === REVENUECAT_PRODUCT_IDS.PRO_ANNUAL;
}

/*
 * ─── SDK Initialization (uncomment once react-native-purchases is installed) ────
 *
 * import Purchases from 'react-native-purchases';
 * import { Platform } from 'react-native';
 *
 * export async function initializeRevenueCat(): Promise<void> {
 *   if (!isRevenueCatConfigured()) {
 *     console.warn('[RevenueCat] SDK key not set. Skipping initialization.');
 *     return;
 *   }
 *   if (Platform.OS === 'ios') {
 *     await Purchases.configure({ apiKey: REVENUECAT_IOS_KEY });
 *   }
 * }
 *
 * export async function getCustomerInfo(): Promise<RevenueCatCustomerInfo | null> {
 *   if (!isRevenueCatConfigured()) return null;
 *   try {
 *     return await Purchases.getCustomerInfo() as unknown as RevenueCatCustomerInfo;
 *   } catch (e) {
 *     console.error('[RevenueCat] getCustomerInfo failed:', e);
 *     return null;
 *   }
 * }
 *
 * export async function purchaseProduct(productId: string): Promise<RevenueCatCustomerInfo | null> {
 *   if (!isRevenueCatConfigured()) return null;
 *   try {
 *     const { customerInfo } = await Purchases.purchaseStoreProduct(
 *       await getPackageForProduct(productId)
 *     );
 *     return customerInfo as unknown as RevenueCatCustomerInfo;
 *   } catch (e) {
 *     console.error('[RevenueCat] purchase failed:', e);
 *     return null;
 *   }
 * }
 *
 * export async function restorePurchases(): Promise<RevenueCatCustomerInfo | null> {
 *   if (!isRevenueCatConfigured()) return null;
 *   try {
 *     return await Purchases.restorePurchases() as unknown as RevenueCatCustomerInfo;
 *   } catch (e) {
 *     console.error('[RevenueCat] restorePurchases failed:', e);
 *     return null;
 *   }
 * }
 */
