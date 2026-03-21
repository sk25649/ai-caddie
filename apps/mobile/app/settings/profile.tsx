import { View, Text, ScrollView, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useProfile, useUpdateProfile } from '../../hooks/useProfile';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SkeletonLoader } from '../../components/ui/SkeletonLoader';

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const logout = useAuthStore((s) => s.logout);

  const [name, setName] = useState('');
  const [handicap, setHandicap] = useState('');
  const [stockShape, setStockShape] = useState('');
  const [dreamScore, setDreamScore] = useState('');
  const [goalScore, setGoalScore] = useState('');
  const [floorScore, setFloorScore] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.displayName || '');
      setHandicap(profile.handicap || '');
      setStockShape(profile.stockShape || '');
      setDreamScore(profile.dreamScore?.toString() || '');
      setGoalScore(profile.goalScore?.toString() || '');
      setFloorScore(profile.floorScore?.toString() || '');
    }
  }, [profile]);

  const handleSave = () => {
    updateProfile.mutate(
      {
        displayName: name || undefined,
        handicap: handicap || undefined,
        stockShape: stockShape || undefined,
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
    <ScrollView className="flex-1 bg-green-deep px-6" keyboardShouldPersistTaps="handled">
      <View className="pt-14 pb-6">
        <Text className="text-2xl text-white" style={{ fontFamily: 'serif' }}>
          Edit Profile
        </Text>
      </View>

      <Input label="Name" value={name} onChangeText={setName} accessibilityLabel="Name" />
      <Input label="Handicap" value={handicap} onChangeText={setHandicap} keyboardType="decimal-pad" accessibilityLabel="Handicap" />
      <Input label="Shot Shape" value={stockShape} onChangeText={setStockShape} placeholder="draw, fade, or straight" accessibilityLabel="Shot shape" />
      <Input label="Dream Score" value={dreamScore} onChangeText={setDreamScore} keyboardType="number-pad" accessibilityLabel="Dream score" />
      <Input label="Goal Score" value={goalScore} onChangeText={setGoalScore} keyboardType="number-pad" accessibilityLabel="Goal score" />
      <Input label="Floor Score" value={floorScore} onChangeText={setFloorScore} keyboardType="number-pad" accessibilityLabel="Floor score" />

      <Button title="Save Changes" onPress={handleSave} loading={updateProfile.isPending} className="mt-2" />

      <View className="mt-6 mb-10">
        <Button title="Edit Bag" onPress={() => router.push('/onboarding/bag')} variant="secondary" className="mb-3" />
        <Button title="Log Out" onPress={handleLogout} variant="danger" />
      </View>
    </ScrollView>
  );
}
