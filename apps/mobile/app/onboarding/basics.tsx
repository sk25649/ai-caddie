import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useUpdateProfile } from '../../hooks/useProfile';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function BasicsScreen() {
  const router = useRouter();
  const updateProfile = useUpdateProfile();
  const [name, setName] = useState('');
  const [handicap, setHandicap] = useState('');

  const handleNext = () => {
    updateProfile.mutate(
      {
        displayName: name || undefined,
        handicap: handicap || undefined,
      },
      {
        onSuccess: () => router.push('/onboarding/bag'),
      }
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-green-deep"
    >
      <ScrollView className="flex-1 px-6" keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
        <View className="pt-4 pb-6">
          <Text className="text-3xl text-white mb-2" style={{ fontFamily: 'serif' }}>
            Let's Get to Know Your Game
          </Text>
          <Text className="text-base text-cream-dim leading-6">
            Your caddie needs to know who they're working with.
          </Text>
        </View>

        <Input
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="What should your caddie call you?"
          accessibilityLabel="Your name"
        />

        <Input
          label="Handicap"
          value={handicap}
          onChangeText={setHandicap}
          placeholder="e.g., 18 (or leave blank)"
          keyboardType="decimal-pad"
          accessibilityLabel="Handicap index"
        />

        <View className="mt-4 mb-8">
          <Text className="text-cream-dim text-sm leading-5">
            Don't know your handicap? No problem. We'll work with your scoring
            goals instead.
          </Text>
        </View>

        <Button
          title="Next: Your Bag"
          onPress={handleNext}
          loading={updateProfile.isPending}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
