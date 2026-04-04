# RevenueCat Integration Setup

**Last updated:** 2026-03-21  
**Status:** SDK scaffolding complete, ready for Stripe/RevenueCat backend configuration

---

## Overview

RevenueCat manages subscriptions across iOS, Android, and web. It handles:
- Offering fetching and pricing
- Purchase processing
- Subscription status and entitlements
- Restore purchases (user switching devices)
- Analytics and attribution

---

## Implementation Status

### ✅ Complete (App-Side)
- `hooks/useRevenueCat.ts`: Hook for managing packages, purchases, entitlements
- `app/settings/upgrade.tsx`: Purchase flow screen
- `hooks/usePlan.ts`: Updated to integrate with RevenueCat
- Pricing screen gates for Free vs Pro

### ⏳ Pending (Backend/Business Setup)
1. RevenueCat account creation + project setup
2. App Store + Google Play app creation
3. Configure RevenueCat Stripe integration
4. API key configuration in Railway
5. Test purchases on iOS TestFlight

---

## Installation

### 1. Add RevenueCat SDK to Mobile App

```bash
cd apps/mobile
npx expo install react-native-purchases
```

### 2. Configure API Key

Add to `.env`:
```
REACT_NATIVE_REVENUCAT_API_KEY=pk_live_xxxxx
```

### 3. Initialize in App Startup

Update `app.tsx` or root layout:

```tsx
import Purchases from 'react-native-purchases';

// On app startup
Purchases.configure({
  apiKey: process.env.REACT_NATIVE_REVENUCAT_API_KEY,
  appUserID: userId, // or use automatic anonymous IDs
});
```

### 4. Log In User

When user authenticates:

```tsx
import Purchases from 'react-native-purchases';

const result = await Purchases.logIn(userId);
// User's entitlements are now fetched automatically
```

---

## Usage Examples

### Fetch & Display Packages

```tsx
import { useRevenueCat } from './hooks/useRevenueCat';

function PricingScreen() {
  const { packages } = useRevenueCat();

  return (
    <ScrollView>
      {packages.map((pkg) => (
        <PackageCard key={pkg.id} package={pkg} />
      ))}
    </ScrollView>
  );
}
```

### Handle Purchase

```tsx
const { purchase, error } = useRevenueCat();

const handleBuyPro = async () => {
  const success = await purchase('ai_caddie_pro_annual');
  if (success) {
    // User now has 'pro' entitlement
    // Refresh app state or navigate to dashboard
  } else {
    Alert.alert('Purchase failed', error);
  }
};
```

### Check Entitlements

```tsx
const { hasEntitlement, isPro } = useRevenueCat();

if (!isPro) {
  return <UpgradePrompt />;
}

return <PremiumFeature />;
```

### Restore Purchases

```tsx
const { restorePurchases } = useRevenueCat();

const handleRestore = async () => {
  await restorePurchases();
  // Entitlements are now synced from RevenueCat servers
};
```

---

## RevenueCat Project Setup

### Step 1: Create RevenueCat Account
- Sign up at https://www.revenuecat.com
- Create project for AI Caddie
- Get API key (starts with `pk_`)

### Step 2: Create App Store App
- Log in to App Store Connect
- Create new iOS App for AI Caddie
- Create subscriptions:
  - **Pro Annual**: $79.99/year (US pricing, localize others)
  - **Pro Monthly**: $9.99/month (optional for Phase 2)
  - **Founding**: $49.99/year (listed as "Limited Offer")
- Set subscription group (e.g., "pro")

### Step 3: Create Google Play App
- Create app in Google Play Console
- Create same subscriptions in In-App Products
- Set subscription IDs to match App Store (e.g., `ai_caddie_pro_annual`)

### Step 4: Connect RevenueCat to Stripe
- In RevenueCat dashboard → Integrations → Stripe
- Provide Stripe API key (restricted key OK)
- RevenueCat will create Stripe products + prices for each subscription
- This syncs subscription status back to your Stripe account

### Step 5: Configure in RevenueCat
- Create "Entitlements":
  - `pro` (all subscriptions grant this)
  - `pro_annual` (optional, for annual-specific features)
- Create "Offerings":
  - `default` offering with all 3 packages
- Map packages to subscription products

### Step 6: Add to Railway (Backend)
```bash
# In Railway environment variables
REVENUCAT_API_KEY=pk_live_xxxxx  # RevenueCat API key for backend (optional, for webhooks)
```

---

## Entitlement Webhooks (Backend Integration)

RevenueCat sends webhooks when subscriptions change. Add endpoint to backend:

```tsx
// Backend: POST /webhooks/revenucat
app.post('/webhooks/revenucat', async (req, res) => {
  const event = req.body;

  if (event.type === 'INITIAL_PURCHASE' || event.type === 'RENEWAL') {
    // Update user plan in DB
    await updateUserPlan(event.app_user_id, 'pro');
  }

  if (event.type === 'CANCELLATION') {
    // Downgrade user to free
    await updateUserPlan(event.app_user_id, 'free');
  }

  if (event.type === 'EXPIRATION') {
    // Trial or subscription expired
    await updateUserPlan(event.app_user_id, 'free');
  }

  res.json({ success: true });
});
```

---

## Testing

### Development: Use RevenueCat Sandbox
- Create sandbox test user in RevenueCat dashboard
- Use sandbox API keys in development
- Purchases don't charge real money

### Testing Purchase Flow

1. **Xcode (iOS)**:
   ```
   Product → Scheme → Edit Scheme → Run → Pre-actions
   Add script: `defaults write com.apple.dt.Xcode IDESourceTreeDisplayNames -dict-add SOURCE_ROOT SOURCE_ROOT`
   ```
   This lets you use StoreKit 2 sandbox.

2. **TestFlight (Staging)**:
   - Build with sandbox credentials
   - Add test user to TestFlight
   - User can test purchases without charging real card

3. **Production**:
   - Use `pk_live_` API keys
   - Test with real App Store account (cost: $0.99 for real subscription, refund after)

---

## Common Issues

### "Entitlements not found"
- Check that user is logged in: `Purchases.logIn(userId)`
- Verify subscription is active in RevenueCat dashboard
- Check that entitlement name matches configuration

### "Package ID not found"
- Verify package ID matches RevenueCat offering configuration
- Check that offering is marked as "active"
- Ensure subscription exists on App Store / Google Play

### "Purchase fails with 'SKErrorPaymentCancelled'"
- User cancelled the purchase — expected behavior
- Check console for other errors

### "Can't restore purchases"
- Ensure user is logged in with original Apple ID
- Restore only works for purchases made with that ID
- App Store may take time to sync purchases

---

## Launch Checklist

- [ ] RevenueCat account created + project configured
- [ ] App Store subscriptions created (3 SKUs)
- [ ] Google Play subscriptions created (3 SKUs)
- [ ] RevenueCat offerings configured with all packages
- [ ] Entitlements created and mapped to packages
- [ ] Stripe connected to RevenueCat (for analytics)
- [ ] API key added to Railway production
- [ ] Webhook endpoint added to backend
- [ ] TestFlight build tested with sandbox credentials
- [ ] Real purchase test (with refund)
- [ ] iOS app submitted to App Store review
- [ ] Android app submitted to Google Play review
- [ ] Monitoring/alerts set up for failed purchases

---

## Resources

- **RevenueCat Docs**: https://docs.revenuecat.com/docs
- **React Native SDK**: https://docs.revenuecat.com/docs/reactnative
- **StoreKit 2 (iOS)**: https://developer.apple.com/documentation/storekit
- **Google Play Billing**: https://developer.android.com/google/play/billing/quickstart
- **Stripe Subscriptions**: https://stripe.com/docs/billing

---

