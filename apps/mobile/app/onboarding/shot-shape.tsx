import { View, Text, ScrollView, Pressable } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useUpdateProfile } from '../../hooks/useProfile';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const SHOT_SHAPES = ['draw', 'fade', 'straight'] as const;

const MISS_OPTIONS = [
  'High hook left',
  'Low hook left',
  'Slice right',
  'Push right',
  'Pull left',
  'Fat/chunk',
  'Thin/skull',
  'Top',
];

export default function ShotShapeScreen() {
  const router = useRouter();
  const updateProfile = useUpdateProfile();
  const [stockShape, setStockShape] = useState<string>('');
  const [missPrimary, setMissPrimary] = useState('');
  const [missSecondary, setMissSecondary] = useState('');
  const [missDescription, setMissDescription] = useState('');

  const selectShape = (shape: string) => {
    Haptics.selectionAsync();
    setStockShape(shape);
  };

  const selectMiss = (miss: string, isPrimary: boolean) => {
    Haptics.selectionAsync();
    if (isPrimary) {
      setMissPrimary(missPrimary === miss ? '' : miss);
    } else {
      setMissSecondary(missSecondary === miss ? '' : miss);
    }
  };

  const handleNext = () => {
    updateProfile.mutate(
      {
        stockShape: stockShape || undefined,
        missPrimary: missPrimary || undefined,
        missSecondary: missSecondary || undefined,
        missDescription: missDescription || undefined,
      },
      {
        onSuccess: () => router.push('/onboarding/goals'),
      }
    );
  };

  return (
    <ScrollView className="flex-1 bg-green-deep px-6" keyboardShouldPersistTaps="handled">
      <View className="pt-8 pb-6">
        <Text className="text-3xl text-white mb-2" style={{ fontFamily: 'serif' }}>
          Your Shot Shape
        </Text>
        <Text className="text-base text-cream-dim leading-6">
          This is how your caddie knows which side of the fairway is dangerous for you.
        </Text>
      </View>

      {/* Stock Shape */}
      <Text className="text-xs tracking-[3px] uppercase text-gold font-bold mb-3">
        Stock Shot Shape
      </Text>
      <View className="flex-row gap-3 mb-8">
        {SHOT_SHAPES.map((shape) => (
          <Pressable
            key={shape}
            onPress={() => selectShape(shape)}
            className={`flex-1 py-4 rounded-xl border-2 items-center ${
              stockShape === shape
                ? 'border-gold bg-gold/20'
                : 'border-gold/15 bg-black/30'
            }`}
          >
            <Text className="text-2xl mb-1">
              {shape === 'draw' ? '↪️' : shape === 'fade' ? '↩️' : '⬆️'}
            </Text>
            <Text
              className={`text-base font-semibold capitalize ${
                stockShape === shape ? 'text-gold' : 'text-cream-dim'
              }`}
            >
              {shape}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Primary Miss */}
      <Text className="text-xs tracking-[3px] uppercase text-gold font-bold mb-3">
        Primary Miss
      </Text>
      <View className="flex-row flex-wrap gap-2 mb-6">
        {MISS_OPTIONS.map((miss) => (
          <Pressable
            key={miss}
            onPress={() => selectMiss(miss, true)}
            className={`px-4 py-2.5 rounded-xl border-2 ${
              missPrimary === miss
                ? 'border-danger bg-danger/20'
                : 'border-gold/15 bg-black/30'
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                missPrimary === miss ? 'text-white' : 'text-cream-dim'
              }`}
            >
              {miss}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Secondary Miss */}
      <Text className="text-xs tracking-[3px] uppercase text-gold font-bold mb-3">
        Secondary Miss
      </Text>
      <View className="flex-row flex-wrap gap-2 mb-6">
        {MISS_OPTIONS.map((miss) => (
          <Pressable
            key={miss}
            onPress={() => selectMiss(miss, false)}
            className={`px-4 py-2.5 rounded-xl border-2 ${
              missSecondary === miss
                ? 'border-gold bg-gold/20'
                : 'border-gold/15 bg-black/30'
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                missSecondary === miss ? 'text-white' : 'text-cream-dim'
              }`}
            >
              {miss}
            </Text>
          </Pressable>
        ))}
      </View>

      <Input
        label="Anything else about your misses?"
        value={missDescription}
        onChangeText={setMissDescription}
        placeholder="e.g., Hook gets worse under pressure"
        multiline
        numberOfLines={3}
        accessibilityLabel="Miss description"
      />

      <View className="mt-4 mb-10">
        <Button
          title="Next: Scoring Goals"
          onPress={handleNext}
          loading={updateProfile.isPending}
        />
      </View>
    </ScrollView>
  );
}
