import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { useProfile } from '../hooks/useProfile';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { useEffect } from 'react';
import { isOnboardingComplete } from '../lib/storage';

export default function HomeScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: profile, isLoading } = useProfile();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
      return;
    }
    isOnboardingComplete().then((complete) => {
      if (!complete) {
        router.replace('/onboarding/basics');
      }
    });
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <ScrollView className="flex-1 bg-green-deep" contentInsetAdjustmentBehavior="automatic">
      {/* Header */}
      <View className="pt-6 pb-6 px-6 border-b-2 border-gold">
        <Text className="text-xs tracking-[5px] uppercase text-gold font-semibold mb-2">
          AI Caddie
        </Text>
        {isLoading ? (
          <SkeletonLoader height={36} width={200} />
        ) : (
          <Text className="text-3xl text-white" style={{ fontFamily: 'serif' }}>
            {profile?.displayName
              ? `Hey, ${profile.displayName}`
              : 'Welcome'}
          </Text>
        )}
      </View>

      <View className="p-6">
        {/* Start Round CTA */}
        <Button
          title="Start a Round"
          onPress={() => router.push('/round/course-select')}
          className="mb-6"
        />

        {/* Quick Stats */}
        {profile && (
          <Card className="mb-6">
            <View className="p-5">
              <Text className="text-xs tracking-[3px] uppercase text-gold font-bold mb-3">
                Your Game
              </Text>
              <View className="flex-row justify-between">
                <View className="items-center flex-1">
                  <Text className="text-cream-dim text-sm mb-1">Handicap</Text>
                  <Text className="text-2xl text-gold" style={{ fontFamily: 'serif' }}>
                    {profile.handicap || '—'}
                  </Text>
                </View>
                <View className="items-center flex-1">
                  <Text className="text-cream-dim text-sm mb-1">Shot Shape</Text>
                  <Text className="text-2xl text-gold" style={{ fontFamily: 'serif' }}>
                    {profile.stockShape || '—'}
                  </Text>
                </View>
                <View className="items-center flex-1">
                  <Text className="text-cream-dim text-sm mb-1">Goal</Text>
                  <Text className="text-2xl text-gold" style={{ fontFamily: 'serif' }}>
                    {profile.goalScore || '—'}
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        )}

        {/* Quick Links */}
        <View className="gap-3">
          <Pressable
            onPress={() => router.push('/settings/profile')}
            className="bg-green-card border border-gold/20 rounded-xl px-5 py-4 flex-row justify-between items-center"
          >
            <Text className="text-cream text-base font-medium">Edit Profile & Bag</Text>
            <Text className="text-cream-dim text-lg">›</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
