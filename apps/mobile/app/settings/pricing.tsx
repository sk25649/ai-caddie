import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { usePlan } from '../../hooks/usePlan';
import { REVENUECAT_PRODUCT_IDS, isRevenueCatConfigured } from '../../lib/revenuecat';

interface PricingPlan {
  id: 'free' | 'pro_monthly' | 'pro_annual';
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
  cta: string;
  ctaAction: () => void;
}

export default function PricingScreen() {
  const { plan: currentPlan } = usePlan();
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan['id'] | null>(null);

  function handleUpgrade(productId: string) {
    if (!isRevenueCatConfigured()) {
      Alert.alert(
        'Coming Soon',
        'In-app purchases are being set up. Check back soon!'
      );
      return;
    }
    // TODO: call RevenueCat purchase flow once SDK is installed
    // purchaseProduct(productId);
    Alert.alert('Upgrade', `Would purchase: ${productId}`);
  }

  const plans: PricingPlan[] = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Get started with AI Caddie',
      features: [
        '1 playbook per month',
        'Basic hole strategy',
        'Score tracking',
        'Mobile app access',
      ],
      cta: currentPlan === 'free' ? 'Current Plan' : 'Downgrade',
      ctaAction: () => {
        Alert.alert('Free Plan', 'You are on the Free plan. Upgrade anytime to unlock Pro.');
      },
    },
    {
      id: 'pro_annual',
      name: 'Pro Annual',
      price: '$89.99',
      period: '/yr',
      description: 'Best value — save vs monthly',
      features: [
        'Unlimited playbooks',
        'AI-generated lessons',
        'Yardage book export (PDF)',
        'Course memory',
        'Custom courses',
        'Post-round review',
      ],
      highlighted: true,
      badge: 'Best Value',
      cta: currentPlan === 'pro_annual' ? 'Current Plan' : 'Go Annual',
      ctaAction: () => handleUpgrade(REVENUECAT_PRODUCT_IDS.PRO_ANNUAL),
    },
    {
      id: 'pro_monthly',
      name: 'Pro Monthly',
      price: '$14.99',
      period: '/mo',
      description: 'Full Pro access, cancel anytime',
      features: [
        'Unlimited playbooks',
        'AI-generated lessons',
        'Yardage book export (PDF)',
        'Course memory',
        'Custom courses',
        'Post-round review',
      ],
      cta: currentPlan === 'pro_monthly' ? 'Current Plan' : 'Go Monthly',
      ctaAction: () => handleUpgrade(REVENUECAT_PRODUCT_IDS.PRO_MONTHLY),
    },
  ];

  return (
    <ScrollView className="flex-1 bg-green-deep" contentInsetAdjustmentBehavior="automatic">
      {/* Header */}
      <View className="pt-6 pb-4 px-6 border-b-2 border-gold">
        <Text className="text-[13px] tracking-[4px] uppercase text-gold font-semibold mb-2">
          Pricing
        </Text>
        <Text className="text-2xl text-white mb-2" style={{ fontFamily: 'serif' }}>
          Choose Your Plan
        </Text>
        <Text className="text-cream-dim text-sm">
          All plans include core caddie features. Pro unlocks advanced tools.
        </Text>
      </View>

      {/* Plans */}
      <View className="p-6 gap-4">
        {plans.map((plan) => (
          <Pressable
            key={plan.id}
            onPress={() => setSelectedPlan(plan.id)}
            className={`rounded-xl border-2 overflow-hidden ${
              plan.highlighted
                ? 'border-gold bg-gold/10'
                : 'border-gold/20 bg-green-card'
            }`}
          >
            <View className={`p-6 ${plan.highlighted ? 'bg-gold/20' : ''}`}>
              {plan.badge && (
                <Text className="text-xs tracking-[2px] uppercase text-gold font-bold mb-2">
                  ⭐ {plan.badge}
                </Text>
              )}

              <View className="flex-row justify-between items-baseline mb-2">
                <Text className="text-2xl text-white font-bold" style={{ fontFamily: 'serif' }}>
                  {plan.name}
                </Text>
                <View className="items-end">
                  <Text className="text-3xl text-gold font-bold">{plan.price}</Text>
                  <Text className="text-xs text-cream-dim">{plan.period}</Text>
                </View>
              </View>

              <Text className="text-cream-dim text-sm mb-5">{plan.description}</Text>

              {/* Features */}
              <View className="gap-2 mb-6">
                {plan.features.map((feature, idx) => (
                  <View key={idx} className="flex-row gap-2 items-center">
                    <Text className="text-gold text-lg">✓</Text>
                    <Text className="text-cream text-sm">{feature}</Text>
                  </View>
                ))}
              </View>

              <Button
                title={plan.cta}
                onPress={plan.ctaAction}
                variant={plan.highlighted ? 'primary' : 'secondary'}
                disabled={plan.id === currentPlan}
              />
            </View>
          </Pressable>
        ))}
      </View>

      {/* FAQ Section */}
      <View className="px-6 pb-6">
        <Card className="mb-4">
          <View className="p-5">
            <Text className="text-xs tracking-[2px] uppercase text-gold font-bold mb-4">
              Questions?
            </Text>

            <View className="gap-4">
              <View>
                <Text className="text-cream font-semibold mb-1">Can I try Pro for free?</Text>
                <Text className="text-cream-dim text-sm">
                  Start with Free. Upgrade anytime to unlock all Pro features.
                </Text>
              </View>

              <View>
                <Text className="text-cream font-semibold mb-1">Annual vs monthly?</Text>
                <Text className="text-cream-dim text-sm">
                  Annual saves you over 50% compared to monthly. Both include the same Pro features.
                </Text>
              </View>

              <View>
                <Text className="text-cream font-semibold mb-1">How do I pay?</Text>
                <Text className="text-cream-dim text-sm">
                  Through the App Store. Payment is handled securely by Apple.
                </Text>
              </View>

              <View>
                <Text className="text-cream font-semibold mb-1">Can I cancel anytime?</Text>
                <Text className="text-cream-dim text-sm">
                  Yes. Manage your subscription in iOS Settings &gt; App Store &gt; Subscriptions.
                </Text>
              </View>

              <View>
                <Text className="text-cream font-semibold mb-1">Restore purchases?</Text>
                <Text className="text-cream-dim text-sm">
                  If you reinstall or switch devices, your subscription restores automatically when you sign in with the same Apple ID.
                </Text>
              </View>
            </View>
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
