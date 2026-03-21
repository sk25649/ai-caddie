# AI Caddie Paywall & Pricing System

**Last updated:** 2026-03-21

---

## Plans

### Free
- **Price**: Free forever
- **Playbooks**: 1 per month
- **Features**: 
  - Basic hole strategy (aim point, tee club)
  - Score tracking
  - Mobile app access
  - Pre-round talk
  - Basic playbook

### Pro
- **Price**: $79/year (or $12/month if monthly option added)
- **Playbooks**: Unlimited
- **Features**:
  - Everything in Free, plus:
  - Unlimited playbooks (any course, any tee)
  - AI-generated 3 key lessons (post-round review)
  - Yardage book PDF export
  - Course memory (next time guidance)
  - Custom courses (describe any course)
  - Trust loop feedback
  - Priority support (future)

### Founding Member
- **Price**: $49/year (one-time, locked forever)
- **Availability**: First 50 members only
- **Playbooks**: Unlimited
- **Features**: Identical to Pro
- **Lock-in**: Price never increases, even if list price changes
- **Closes**: When 50 members or profitability is reached

---

## Implementation

### Entitlements System

`lib/entitlements.ts` defines what each plan can do.

```ts
import { usePlan, useFeatureAccess } from './hooks/usePlan';

// Get current plan
const { plan, entitlements, isPro } = usePlan();

// Check specific feature
const canExportYardage = useFeatureAccess('canExportYardageBook');
```

### Feature Gates

Use the `FeatureGateBanner` or `FeatureLockedPrompt` components to gate premium features.

**Option 1: Show a banner when user tries to use a feature**
```tsx
import { FeatureGateBanner } from './components/paywall/FeatureLockedPrompt';
import { useFeatureAccess } from './hooks/usePlan';

const canExport = useFeatureAccess('canExportYardageBook');

if (!canExport) {
  return <FeatureGateBanner featureName="Yardage Book" onUpgrade={handleUpgrade} />;
}
```

**Option 2: Show a full modal**
```tsx
import { FeatureLockedPrompt } from './components/paywall/FeatureLockedPrompt';

<FeatureLockedPrompt
  featureName="Yardage Book Export"
  featureDescription="Print personalized yardage books for your round"
  onUpgrade={handleUpgrade}
  onDismiss={handleDismiss}
/>
```

### Pricing Screen

Navigate to `/settings/pricing` to view plans and upgrade.

```tsx
import { useRouter } from 'expo-router';

const router = useRouter();
router.push('/settings/pricing');
```

---

## Gated Features

| Feature | Free | Pro | Founding | Notes |
|---------|------|-----|----------|-------|
| Unlimited playbooks | ❌ (1/mo) | ✅ | ✅ | Free gets 1 playbook per month |
| Yardage book export | ❌ | ✅ | ✅ | PDF generation via expo-print |
| Post-round review | ❌ | ✅ | ✅ | 3 AI-generated lessons |
| Course memory | ❌ | ✅ | ✅ | Next-time guidance on repeat rounds |
| Custom courses | ❌ | ✅ | ✅ | Describe any course, no DB required |
| Trust loop | ❌ | ✅ | ✅ | Feedback on caddie advice quality |

---

## Integration Points

### Playbook Generation
When user generates their 2nd playbook on Free plan, show upgrade prompt.

```tsx
import { usePlan } from './hooks/usePlan';
import { FeatureLockedPrompt } from './components/paywall/FeatureLockedPrompt';

const { plan } = usePlan();

if (plan === 'free' && playbookCount >= 1) {
  return (
    <FeatureLockedPrompt
      featureName="Unlimited Playbooks"
      featureDescription="Generate as many playbooks as you need"
      onUpgrade={handleUpgrade}
      onDismiss={handleDismiss}
    />
  );
}
```

### Post-Round Review
When user completes a round, show review only if Pro/Founding.

```tsx
const canReview = useFeatureAccess('canAccessPostRoundReview');

if (canReview) {
  // Show full review with lessons
  return <PostRoundReview ... />;
} else {
  // Show summary, suggest upgrade
  return (
    <>
      <RoundSummary />
      <FeatureLockedPrompt
        featureName="AI-Generated Lessons"
        featureDescription="Get personalized takeaways from your round"
        onUpgrade={handleUpgrade}
      />
    </>
  );
}
```

### Yardage Book Export
When user presses "Print Yardage Book" button:

```tsx
const canExport = useFeatureAccess('canExportYardageBook');

if (!canExport) {
  return <FeatureGateBanner featureName="Yardage Book" onUpgrade={handleUpgrade} />;
}

// Generate and export PDF
const html = await getYardageBookHtml(playbook.id);
await exportPDF(html);
```

---

## Stripe Integration (Future)

Currently, the pricing screen and upgrade flow are **UI-only**. 

To enable actual payments:

1. **Backend API**: Add `/subscription/create-checkout-session` endpoint
   - Accepts `planId` ('pro' or 'founding')
   - Returns Stripe Checkout URL
   - Validates founding member availability (count < 50)

2. **Mobile Integration**: Use `react-native-stripe-sdk`
   - Redirect to Stripe Checkout
   - Listen for webhook on backend to update `player_profiles.plan`

3. **Webhook Handler**: `/webhooks/stripe`
   - Listens for `customer.subscription.created`
   - Updates user plan in DB
   - Triggers confirmation email

4. **Profile API**: Extend `GET /profile` response
   - Add `plan` field ('free' | 'pro' | 'founding')
   - Add `subscriptionStatus` ('active' | 'canceled' | 'past_due')
   - Add `subscriptionEndDate` for annual plans

---

## Analytics & Metrics

To track pricing effectiveness:

- **Upgrade click rate**: % of free users who view pricing screen
- **Conversion rate**: % of pricing viewers who upgrade
- **Founding member velocity**: Days to sell 50 slots
- **Churn rate**: % of pro users who cancel (future)
- **Feature usage by plan**: Which gated features drive upgrades?

---

## Launch Checklist

- [ ] Stripe products and prices created in production
- [ ] Webhook secret configured in Railway env
- [ ] Backend checkout endpoint tested
- [ ] Plan field added to PlayerProfile schema
- [ ] Cron job to sync Stripe subscription status daily
- [ ] Email notifications set up (welcome, renewal, cancellation)
- [ ] Support documentation written
- [ ] In-app help/FAQ updated with pricing info
- [ ] Analytics events wired (view pricing, click upgrade, etc.)

---

