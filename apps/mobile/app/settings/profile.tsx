import { View, Text, ScrollView, Alert, Pressable } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useProfile, useUpdateProfile } from '../../hooks/useProfile';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SkeletonLoader } from '../../components/ui/SkeletonLoader';

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

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const logout = useAuthStore((s) => s.logout);

  const [_name, setName] = useState<string | undefined>(undefined);
  const [_handicap, setHandicap] = useState<string | undefined>(undefined);
  const [_stockShape, setStockShape] = useState<string | undefined>(undefined);
  const [_missPrimary, setMissPrimary] = useState<string | undefined>(undefined);
  const [_missSecondary, setMissSecondary] = useState<string | undefined>(undefined);
  const [_dreamScore, setDreamScore] = useState<string | undefined>(undefined);
  const [_goalScore, setGoalScore] = useState<string | undefined>(undefined);
  const [_floorScore, setFloorScore] = useState<string | undefined>(undefined);

  const name = _name ?? profile?.displayName ?? '';
  const handicap = _handicap ?? profile?.handicap ?? '';
  const stockShape = _stockShape ?? profile?.stockShape ?? '';
  const missPrimary = _missPrimary ?? profile?.missPrimary ?? '';
  const missSecondary = _missSecondary ?? profile?.missSecondary ?? '';
  const dreamScore = _dreamScore ?? (profile?.dreamScore?.toString() ?? '');
  const goalScore = _goalScore ?? (profile?.goalScore?.toString() ?? '');
  const floorScore = _floorScore ?? (profile?.floorScore?.toString() ?? '');

  const handleSave = () => {
    updateProfile.mutate(
      {
        displayName: name || undefined,
        handicap: handicap || undefined,
        stockShape: stockShape || undefined,
        missPrimary: missPrimary || undefined,
        missSecondary: missSecondary || undefined,
        dreamScore: parseInt(dreamScore) || undefined,
        goalScore: parseInt(goalScore) || undefined,
        floorScore: parseInt(floorScore) || undefined,
      },
      {
        onSuccess: () => Alert.alert('Saved', 'Profile updated.'),
      }
    );
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-green-deep p-6 pt-16">
        <SkeletonLoader height={30} width={200} className="mb-6" />
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonLoader key={i} height={50} className="mb-4" />
        ))}
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-green-deep px-6" keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
      <View className="pt-6 pb-6">
        <Pressable onPress={() => router.back()} className="py-2 mb-2 self-start">
          <Text className="text-gold text-base">‹ Back</Text>
        </Pressable>
        <Text className="text-2xl text-white" style={{ fontFamily: 'serif' }}>
          Edit Profile
        </Text>
      </View>

      <Input label="Name" value={name} onChangeText={setName} accessibilityLabel="Name" />
      <Input label="Handicap" value={handicap} onChangeText={setHandicap} keyboardType="decimal-pad" accessibilityLabel="Handicap" />

      {/* Shot Shape */}
      <Text className="text-[13px] tracking-[2px] uppercase text-gold font-bold mb-3">
        Stock Shot Shape
      </Text>
      <View className="flex-row gap-3 mb-6">
        {SHOT_SHAPES.map((shape) => (
          <Pressable
            key={shape}
            onPress={() => { Haptics.selectionAsync(); setStockShape(shape); }}
            className={`flex-1 py-3.5 rounded-xl border-2 items-center ${
              stockShape === shape ? 'border-gold bg-gold/20' : 'border-gold/15 bg-black/30'
            }`}
          >
            <Text className="text-xl mb-0.5">
              {shape === 'draw' ? '↪️' : shape === 'fade' ? '↩️' : '⬆️'}
            </Text>
            <Text className={`text-sm font-semibold capitalize ${stockShape === shape ? 'text-gold' : 'text-cream-dim'}`}>
              {shape}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Primary Miss */}
      <Text className="text-[13px] tracking-[2px] uppercase text-gold font-bold mb-3">
        Primary Miss
      </Text>
      <View className="flex-row flex-wrap gap-2 mb-6">
        {MISS_OPTIONS.map((miss) => (
          <Pressable
            key={miss}
            onPress={() => { Haptics.selectionAsync(); setMissPrimary(missPrimary === miss ? '' : miss); }}
            className={`px-4 py-2.5 rounded-xl border-2 ${
              missPrimary === miss ? 'border-danger bg-danger/20' : 'border-gold/15 bg-black/30'
            }`}
          >
            <Text className={`text-sm font-semibold ${missPrimary === miss ? 'text-white' : 'text-cream-dim'}`}>
              {miss}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Secondary Miss */}
      <Text className="text-[13px] tracking-[2px] uppercase text-gold font-bold mb-3">
        Secondary Miss
      </Text>
      <View className="flex-row flex-wrap gap-2 mb-6">
        {MISS_OPTIONS.map((miss) => (
          <Pressable
            key={miss}
            onPress={() => { Haptics.selectionAsync(); setMissSecondary(missSecondary === miss ? '' : miss); }}
            className={`px-4 py-2.5 rounded-xl border-2 ${
              missSecondary === miss ? 'border-gold bg-gold/20' : 'border-gold/15 bg-black/30'
            }`}
          >
            <Text className={`text-sm font-semibold ${missSecondary === miss ? 'text-white' : 'text-cream-dim'}`}>
              {miss}
            </Text>
          </Pressable>
        ))}
      </View>

      <Input label="Dream Score" value={dreamScore} onChangeText={setDreamScore} keyboardType="number-pad" placeholder="Best score you're chasing" accessibilityLabel="Dream score" />
      <Input label="Goal Score" value={goalScore} onChangeText={setGoalScore} keyboardType="number-pad" placeholder="Realistic target for today" accessibilityLabel="Goal score" />
      <Input label="Floor Score" value={floorScore} onChangeText={setFloorScore} keyboardType="number-pad" placeholder="Score you'd still be happy with" accessibilityLabel="Floor score" />

      <Button title="Save Changes" onPress={handleSave} loading={updateProfile.isPending} className="mt-2" />

      <View className="mt-6 mb-10">
        <Button title="View Pricing" onPress={() => router.push('/settings/pricing')} variant="secondary" className="mb-3" />
        <Button title="Edit Bag" onPress={() => router.push('/onboarding/bag')} variant="secondary" className="mb-3" />
        <Button title="Log Out" onPress={handleLogout} variant="danger" />
      </View>
    </ScrollView>
  );
}
