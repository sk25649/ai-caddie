import { View, Text, FlatList, Pressable, TextInput } from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCourses } from '../../hooks/useCourses';
import { useRoundStore } from '../../stores/roundStore';
import { SkeletonLoader } from '../../components/ui/SkeletonLoader';
import type { Course } from '../../lib/api';

export default function CourseSelectScreen() {
  const router = useRouter();
  const setCourse = useRoundStore((s) => s.setCourse);
  const { data: courses, isLoading } = useCourses();
  const [search, setSearch] = useState('');

  const filtered = courses?.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = useCallback(
    (course: Course) => {
      Haptics.selectionAsync();
      setCourse(course);
      router.push('/round/tee-select');
    },
    [setCourse, router]
  );

  const renderCourse = useCallback(({ item }: { item: Course }) => (
    <Pressable
      onPress={() => handleSelect(item)}
      className="bg-green-card border border-gold/20 rounded-xl px-5 py-4 mb-3"
    >
      <Text className="text-lg font-semibold text-white">{item.name}</Text>
      <Text className="text-sm text-cream-dim mt-1">
        {item.city}, {item.state} · Par {item.par}
      </Text>
    </Pressable>
  ), [handleSelect]);

  return (
    <SafeAreaView className="flex-1 bg-green-deep">
      <View className="px-6 pb-4 border-b border-gold/20">
        <Pressable onPress={() => router.back()} className="py-2 mb-1 self-start">
          <Text className="text-gold text-base">‹ Back</Text>
        </Pressable>
        <Text className="text-2xl text-white mb-4" style={{ fontFamily: 'serif' }}>
          Pick Your Course
        </Text>
        <TextInput
          className="bg-black/30 border border-gold/15 rounded-xl px-4 py-3 text-cream text-base"
          placeholder="Search courses..."
          placeholderTextColor="#b8a88866"
          value={search}
          onChangeText={setSearch}
          accessibilityLabel="Search courses"
        />
      </View>

      {isLoading ? (
        <View className="p-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonLoader key={i} height={70} borderRadius={12} />
          ))}
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderCourse}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 24 }}
          ListEmptyComponent={
            <Text className="text-cream-dim text-center mt-10">
              No courses found
            </Text>
          }
          ListFooterComponent={
            <Pressable
              onPress={() => { Haptics.selectionAsync(); router.push('/round/custom-course'); }}
              className="mt-2 mb-4 py-4 items-center border border-gold/15 rounded-xl bg-black/20"
            >
              <Text className="text-sm text-gold font-semibold">
                Playing a course not listed? Enter it manually →
              </Text>
            </Pressable>
          }
        />
      )}
    </SafeAreaView>
  );
}
