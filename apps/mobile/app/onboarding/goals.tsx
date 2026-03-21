import { View, Text, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useUpdateProfile } from '../../hooks/useProfile';
import { setOnboardingComplete } from '../../lib/storage';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function GoalsScreen() {
  const router = useRouter();
  const updateProfile = useUpdateProfile();
  const [dreamScore, setDreamScore] = useState('');
  const [goalScore, setGoalScore] = useState('');
  const [floorScore, setFloorScore] = useState('');

  const handleFinish = () => {
    const dream = parseInt(dreamScore);
    const goal = parseInt(goalScore);
    const floor = parseInt(floorScore);

    if (!dream || !goal || !floor) {
      Alert.alert('Missing scores', 'Please enter all three scoring targets.');
      return;
    }

    if (dream >= goal || goal >= floor) {
      Alert.alert(
        'Check your numbers',
        'Dream should be lowest, then Goal, then Floor (highest).'
      );
      return;
    }

    updateProfile.mutate(
      { dreamScore: dream, goalScore: goal, floorScore: floor },
      {
        onSuccess: async () => {
          await setOnboardingComplete();
          router.replace('/');
        },
      }
    );
  };

  return (
    <ScrollView className="flex-1 bg-green-deep px-6" keyboardShouldPersistTaps="handled">
      <View className="pt-8 pb-6">
        <Text className="text-3xl text-white mb-2" style={{ fontFamily: 'serif' }}>
          Scoring Goals
        </Text>
        <Text className="text-base text-cream-dim leading-6">
          Three numbers that frame every playbook your caddie builds.
        </Text>
      </View>

      <View className="bg-green-card border border-gold/20 rounded-2xl p-6 mb-6">
        <View className="mb-6">
          <Text className="text-2xl mb-1">🌟</Text>
          <Input
            label="Dream Score"
            value={dreamScore}
            onChangeText={setDreamScore}
            placeholder="Your best-case day (e.g., 85)"
            keyboardType="number-pad"
            accessibilityLabel="Dream score"
          />
          <Text className="text-cream-dim text-sm -mt-2">
            Everything clicks. Career round territory.
          </Text>
        </View>

        <View className="mb-6">
          <Text className="text-2xl mb-1">🎯</Text>
          <Input
            label="Goal Score"
            value={goalScore}
            onChangeText={setGoalScore}
            placeholder="A realistic good day (e.g., 89)"
            keyboardType="number-pad"
            accessibilityLabel="Goal score"
          />
          <Text className="text-cream-dim text-sm -mt-2">
            Solid play, nothing spectacular. You'd be happy.
          </Text>
        </View>

        <View>
          <Text className="text-2xl mb-1">🛡️</Text>
          <Input
            label="Floor Score"
            value={floorScore}
            onChangeText={setFloorScore}
            placeholder="Worst acceptable round (e.g., 99)"
            keyboardType="number-pad"
            accessibilityLabel="Floor score"
          />
          <Text className="text-cream-dim text-sm -mt-2">
            Bad day, but you stayed in it. No blowup.
          </Text>
        </View>
      </View>

      <Button
        title="Let's Play Golf"
        onPress={handleFinish}
        loading={updateProfile.isPending}
      />

      <View className="mt-4 mb-10">
        <Text className="text-cream-dim text-sm text-center leading-5">
          You can always update these in settings.
        </Text>
      </View>
    </ScrollView>
  );
}
