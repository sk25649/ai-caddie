import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

interface PricingPlan {
  id: 'free' | 'pro' | 'founding';
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
  ctaAction: () => void;
}

export default function PricingScreen() {
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'pro' | 'founding' | null>(null);

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
      cta: 'Current Plan',
      ctaAction: () => {
        Alert.alert('You are on the Free plan', 'Upgrade anytime to access Pro features.');
      },
    },
    {
      id: 'founding',
      name: 'Founding Member',
      price: '$49',
      period: '/year (one-time)',
      description: 'Locked forever for first 50 members',
      features: [
        'Unlimited playbooks',
        'AI-generated lessons',
        'Yardage book export (PDF)',
        'Course memory',
        'Custom courses',
        'Post-round review',
        'Founding member badge',
      ],
      highlighted: true,
      cta: 'Join Founding',
      ctaAction: () => {
        Alert.alert('Upgrade Flow', 'This would connect to Stripe in production.');
      },
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$79',
      period: '/year',
      description: 'Full access to all features',
      features: [
        'Unlimited playbooks',
        'AI-generated lessons',
        'Yardage book export (PDF)',
        'Course memory',
        'Custom courses',
        'Post-round review',
        'Priority support',
      ],
      cta: 'Upgrade to Pro',
      ctaAction: () => {
        Alert.alert('Upgrade Flow', 'This would connect to Stripe in production.');
      },
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
                ? 'border-gold bg-gold/10 transform scale-105'
                : 'border-gold/20 bg-green-card'
            }`}
          >
            <View className={`p-6 ${plan.highlighted ? 'bg-gold/20' : ''}`}>
              {plan.highlighted && (
                <Text className="text-xs tracking-[2px] uppercase text-gold font-bold mb-2">
                  ⭐ Best Value
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
                  Yes, start with Free. You can upgrade anytime and pay the difference.
                </Text>
              </View>

              <View>
                <Text className="text-cream font-semibold mb-1">Is Founding locked in forever?</Text>
                <Text className="text-cream-dim text-sm">
                  Yes. $49/year forever, for the first 50 members. After 50 or profitability, it closes.
                </Text>
              </View>

              <View>
                <Text className="text-cream font-semibold mb-1">Do I need a credit card?</Text>
                <Text className="text-cream-dim text-sm">
                  Only to upgrade from Free. We use Stripe for secure payments.
                </Text>
              </View>

              <View>
                <Text className="text-cream font-semibold mb-1">Can I cancel anytime?</Text>
                <Text className="text-cream-dim text-sm">
                  Pro: Yes, monthly or annual cancellation anytime. Founding: One-time purchase, no refunds.
                </Text>
              </View>
            </View>
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
