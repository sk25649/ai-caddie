import { View, Text, Pressable, ScrollView } from 'react-native';
import { useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useRoundStore } from '../../stores/roundStore';
import { useProfile } from '../../hooks/useProfile';
import type { TeeInfo } from '../../lib/api';

function recommendTee(handicap: string | null | undefined, tees: TeeInfo[]): string {
  const hcp = parseFloat(handicap || '20');
  const sorted = [...tees].sort((a, b) => a.totalYardage - b.totalYardage);

  if (hcp <= 5) return sorted[sorted.length - 1]?.name || sorted[0].name;
  if (hcp <= 12) return sorted[Math.max(sorted.length - 2, 0)]?.name || sorted[0].name;
  if (hcp <= 20) return sorted[Math.floor(sorted.length / 2)]?.name || sorted[0].name;
  return sorted[Math.min(1, sorted.length - 1)]?.name || sorted[0].name;
}

export default function TeeSelectScreen() {
  const router = useRouter();
  const course = useRoundStore((s) => s.selectedCourse);
  const setTee = useRoundStore((s) => s.setTee);
  const { data: profile } = useProfile();

  useEffect(() => {
    if (!course) router.back();
  }, [course, router]);

  const handleSelect = useCallback((tee: string) => {
    Haptics.selectionAsync();
    setTee(tee);
    router.push('/round/details');
  }, [setTee, router]);

  if (!course) return null;

  const tees = course.tees as TeeInfo[];
  const recommended = recommendTee(profile?.handicap, tees);

  return (
    <ScrollView className="flex-1 bg-green-deep px-6" contentInsetAdjustmentBehavior="automatic">
      <View className="pt-6 pb-6">
        <Pressable onPress={() => router.back()} className="py-2 mb-2 self-start">
          <Text className="text-gold text-base">‹ Back</Text>
        </Pressable>
        <Text className="text-cream-dim text-[15px] mb-2">{course.name}</Text>
        <Text className="text-2xl text-white" style={{ fontFamily: 'serif' }}>
          Choose Your Tees
        </Text>
      </View>

      {tees
        .sort((a, b) => b.totalYardage - a.totalYardage)
        .map((tee) => {
          const isRecommended = tee.name === recommended;
          return (
            <Pressable
              key={tee.name}
              onPress={() => handleSelect(tee.name)}
              className={`bg-green-card border rounded-xl px-5 py-5 mb-3 ${
                isRecommended ? 'border-gold/50' : 'border-gold/20'
              }`}
            >
              <View className="flex-row justify-between items-center">
                <View className="flex-row items-center gap-3">
                  <View
                    className="w-5 h-5 rounded-full border border-white/20"
                    style={{ backgroundColor: tee.color }}
                  />
                  <View>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-lg font-bold text-white">{tee.name}</Text>
                      {isRecommended && (
                        <View className="bg-gold/20 px-2.5 py-0.5 rounded-md">
                          <Text className="text-[13px] text-gold font-bold">RECOMMENDED</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-[15px] text-cream-dim mt-1">
                      Rating {tee.rating} · Slope {tee.slope}
                    </Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="text-2xl text-gold" style={{ fontFamily: 'serif' }}>
                    {tee.totalYardage}
                  </Text>
                  <Text className="text-[13px] text-cream-dim">yds</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
    </ScrollView>
  );
}
