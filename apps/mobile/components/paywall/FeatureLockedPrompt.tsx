import { View, Text, Pressable } from 'react-native';
import { Card } from '../ui/Card';

interface FeatureLockedPromptProps {
  featureName: string;
  featureDescription: string;
  onUpgrade: () => void;
  onDismiss: () => void;
}

/**
 * Prompt shown when user tries to access a Pro feature on Free plan
 */
export function FeatureLockedPrompt({
  featureName,
  featureDescription,
  onUpgrade,
  onDismiss,
}: FeatureLockedPromptProps) {
  const planPrice = '$14.99/mo';
  const planLabel = 'Pro';

  return (
    <Card className="mx-4 mb-4">
      <View className="p-6">
        <Text className="text-xs tracking-[2px] uppercase text-gold font-bold mb-2">
          🔒 {featureName.toUpperCase()}
        </Text>
        <Text className="text-lg text-white font-semibold mb-2">{featureName}</Text>
        <Text className="text-cream-dim text-sm leading-5 mb-6">{featureDescription}</Text>

        <View className="bg-gold/10 border border-gold/20 rounded-lg p-4 mb-6">
          <Text className="text-xs text-cream-dim mb-2">Upgrade to {planLabel} Plan</Text>
          <Text className="text-2xl text-gold font-bold">{planPrice}</Text>
        </View>

        <View className="gap-2">
          <Pressable
            onPress={onUpgrade}
            className="bg-gold/20 border border-gold/40 rounded-lg py-3 px-4"
          >
            <Text className="text-gold font-bold text-center">Upgrade Now</Text>
          </Pressable>
          <Pressable onPress={onDismiss} className="py-2">
            <Text className="text-cream-dim text-sm text-center">Maybe Later</Text>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

/**
 * Inline feature gate for buttons/actions
 * Shows when user tries to perform a gated action
 */
export function FeatureGateBanner({
  featureName,
  onUpgrade,
}: {
  featureName: string;
  onUpgrade: () => void;
}) {
  return (
    <View className="bg-gold/5 border border-gold/20 rounded-lg p-4 flex-row items-center gap-3 mb-4">
      <Text className="flex-1">
        <Text className="text-cream font-semibold">{featureName} </Text>
        <Text className="text-cream-dim text-sm">is a Pro feature</Text>
      </Text>
      <Pressable onPress={onUpgrade} className="px-3 py-2 bg-gold/20 rounded">
        <Text className="text-gold font-semibold text-xs">Upgrade</Text>
      </Pressable>
    </View>
  );
}
