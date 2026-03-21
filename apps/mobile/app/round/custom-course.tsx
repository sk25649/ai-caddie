import { View, Text, ScrollView, TextInput, Pressable } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useRoundStore } from '../../stores/roundStore';
import { Button } from '../../components/ui/Button';

export default function CustomCourseScreen() {
  const router = useRouter();
  const setCustomCourse = useRoundStore((s) => s.setCustomCourse);

  const [courseName, setCourseName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [teeName, setTeeName] = useState('');
  const [description, setDescription] = useState('');

  const canContinue = courseName.trim().length > 0 && teeName.trim().length > 0 && description.trim().length > 10;

  const handleContinue = () => {
    if (!canContinue) return;
    Haptics.selectionAsync();
    setCustomCourse(courseName.trim(), teeName.trim(), description.trim(), city.trim() || undefined, state.trim() || undefined);
    router.push('/round/details');
  };

  return (
    <ScrollView
      className="flex-1 bg-green-deep px-6"
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <View className="pt-6 pb-2">
        <Text className="text-2xl text-white mb-1" style={{ fontFamily: 'serif' }}>
          Describe the Course
        </Text>
        <Text className="text-sm text-cream-dim leading-5">
          Walk each hole or paste the scorecard. The more you write, the sharper your playbook.
        </Text>
      </View>

      <View className="mt-6">
        <Text className="text-xs tracking-[3px] uppercase text-gold font-bold mb-2">
          Course Name
        </Text>
        <TextInput
          className="bg-black/30 border border-gold/15 rounded-xl px-4 py-3 text-cream text-base mb-5"
          placeholder="e.g. Pebble Beach Golf Links"
          placeholderTextColor="#b8a88855"
          value={courseName}
          onChangeText={setCourseName}
          accessibilityLabel="Course name"
        />

        <Text className="text-xs tracking-[3px] uppercase text-gold font-bold mb-2">
          Location (optional)
        </Text>
        <View className="flex-row gap-3 mb-5">
          <TextInput
            className="bg-black/30 border border-gold/15 rounded-xl px-4 py-3 text-cream text-base flex-1"
            placeholder="City"
            placeholderTextColor="#b8a88855"
            value={city}
            onChangeText={setCity}
            accessibilityLabel="City"
          />
          <TextInput
            className="bg-black/30 border border-gold/15 rounded-xl px-4 py-3 text-cream text-base w-20"
            placeholder="State"
            placeholderTextColor="#b8a88855"
            value={state}
            onChangeText={setState}
            autoCapitalize="characters"
            maxLength={2}
            accessibilityLabel="State"
          />
        </View>

        <Text className="text-xs tracking-[3px] uppercase text-gold font-bold mb-2">
          Tee Color / Name
        </Text>
        <TextInput
          className="bg-black/30 border border-gold/15 rounded-xl px-4 py-3 text-cream text-base mb-5"
          placeholder="White, Blue, Red..."
          placeholderTextColor="#b8a88855"
          value={teeName}
          onChangeText={setTeeName}
          accessibilityLabel="Tee name"
        />

        <Text className="text-xs tracking-[3px] uppercase text-gold font-bold mb-2">
          Course Description
        </Text>
        <TextInput
          className="bg-black/30 border border-gold/15 rounded-xl px-4 py-3 text-cream text-sm"
          placeholder={
            'Hole 1: Par 4, 385 yards. Dogleg right at 210 yards. OB left the entire hole. Fairway bunker right at 220. Small elevated green, slopes front to back...\n\nHole 2: Par 3, 165 yards...'
          }
          placeholderTextColor="#b8a88844"
          multiline
          numberOfLines={10}
          value={description}
          onChangeText={setDescription}
          style={{ minHeight: 200, textAlignVertical: 'top' }}
          accessibilityLabel="Course description"
        />
        <Text className="text-xs text-cream-dim/50 mt-2 mb-6">
          Describe hazards, doglegs, green slopes, and distances you know. Claude fills gaps.
        </Text>
      </View>

      <Button
        title="Continue to Details"
        onPress={handleContinue}
        disabled={!canContinue}
        className="mb-10"
      />
    </ScrollView>
  );
}
