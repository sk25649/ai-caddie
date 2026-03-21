import { View, Text } from 'react-native';
import { Stack, usePathname } from 'expo-router';

const STEPS = [
  { path: '/onboarding/basics', label: 'Basics' },
  { path: '/onboarding/bag', label: 'Bag' },
  { path: '/onboarding/shot-shape', label: 'Shot Shape' },
  { path: '/onboarding/goals', label: 'Goals' },
];

export default function OnboardingLayout() {
  const pathname = usePathname();
  const currentStep = STEPS.findIndex((s) => s.path === pathname);
  const progress = currentStep >= 0 ? (currentStep + 1) / STEPS.length : 0;

  return (
    <View className="flex-1 bg-green-deep">
      {/* Progress Bar */}
      <View className="pt-14 px-6 pb-4">
        <View className="flex-row justify-between mb-2">
          <Text className="text-xs tracking-[3px] uppercase text-gold font-bold">
            Setup
          </Text>
          <Text className="text-xs text-cream-dim">
            Step {currentStep + 1} of {STEPS.length}
          </Text>
        </View>
        <View className="h-1.5 bg-black/30 rounded-full overflow-hidden">
          <View
            className="h-full bg-gold rounded-full"
            style={{ width: `${progress * 100}%` }}
          />
        </View>
      </View>

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0a1a0a' },
          animation: 'slide_from_right',
        }}
      />
    </View>
  );
}
