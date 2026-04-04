import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';

/**
 * RevenueCat subscription management
 * Handles purchases, entitlements, and plan status
 */

export interface Package {
  id: string;
  title: string;
  description: string;
  price: number;
  priceString: string;
  periodString: string;
}

export interface Entitlement {
  isActive: boolean;
  expiresAtDate: Date | null;
}

/**
 * Hook to manage RevenueCat subscriptions
 * Note: Actual RevenueCat SDK integration requires:
 * - npm install react-native-purchases
 * - Configure with api key in environment
 * - Handle Platform-specific setup (iOS/Android)
 */
export function useRevenueCat() {
  const userId = useAuthStore((s) => s.userId);
  const [packages, setPackages] = useState<Package[]>([]);
  const [entitlements, setEntitlements] = useState<Record<string, Entitlement>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize RevenueCat
  useEffect(() => {
    const initRevenueCat = async () => {
      try {
        setIsLoading(true);
        // In production, this would call:
        // const Purchases = require('react-native-purchases').default;
        // await Purchases.configure({ apiKey: REVENUCAT_API_KEY });
        // if (userId) await Purchases.logIn(userId);

        // For now, mock the initialization
        console.log('RevenueCat initialized for user:', userId);
        
        // Mock packages
        setPackages([
          {
            id: 'ai_caddie_pro_annual',
            title: 'Pro Annual',
            description: 'Full access for 1 year',
            price: 79,
            priceString: '$79.99',
            periodString: '/year',
          },
          {
            id: 'ai_caddie_pro_monthly',
            title: 'Pro Monthly',
            description: 'Full access for 1 month',
            price: 9.99,
            priceString: '$9.99',
            periodString: '/month',
          },
        ]);

        // Mock entitlements
        setEntitlements({
          pro: {
            isActive: false,
            expiresAtDate: null,
          },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize RevenueCat');
      } finally {
        setIsLoading(false);
      }
    };

    initRevenueCat();
  }, [userId]);

  // Purchase a package
  const purchase = async (packageId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      // In production:
      // const Purchases = require('react-native-purchases').default;
      // const result = await Purchases.purchasePackage(package);
      // Returns { customerInfo } which contains entitlements

      console.log('Purchasing package:', packageId);
      // Simulate purchase success
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Restore purchases (for users switching devices)
  const restorePurchases = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      // In production:
      // const Purchases = require('react-native-purchases').default;
      // const result = await Purchases.restorePurchases();
      
      console.log('Restoring purchases for user:', userId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user has an entitlement
  const hasEntitlement = (entitlementId: string): boolean => {
    return entitlements[entitlementId]?.isActive ?? false;
  };

  return {
    packages,
    entitlements,
    isLoading,
    error,
    purchase,
    restorePurchases,
    hasEntitlement,
    isPro: hasEntitlement('pro'),
  };
}
