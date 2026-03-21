import { View, Text, ScrollView, Pressable } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useRoundStore } from '../../stores/roundStore';
import { useGeneratePlaybook } from '../../hooks/usePlaybook';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const SCORING_GOALS = [
  'Break 80',
  'Break 85',
  'Break 90',
  'Break 95',
  'Break 100',
  'Just have fun',
];

export default function DetailsScreen() {
  const router = useRouter();
  const course = useRoundStore((s) => s.selectedCourse);
  const tee = useRoundStore((s) => s.selectedTee);
  const setRoundDetails = useRoundStore((s) => s.setRoundDetails);
  const setPlaybook = useRoundStore((s) => s.setPlaybook);
  const generatePlaybook = useGeneratePlaybook();

  const today = new Date().toISOString().split('T')[0];
  const [roundDate, setRoundDate] = useState(today);
  const [teeTime, setTeeTime] = useState('12:00');
  const [scoringGoal, setScoringGoal] = useState('');

  if (!course || !tee) {
    router.back();
    return null;
  }

  const handleGenerate = () => {
    if (!scoringGoal) return;

    setRoundDetails(roundDate, teeTime, scoringGoal);

    generatePlaybook.mutate(
      {
        courseId: course.id,
        teeName: tee,
        roundDate,
        teeTime,
        scoringGoal,
      },
      {
        onSuccess: (playbook) => {
          setPlaybook(playbook);
          router.push('/round/playbook');
        },
      }
    );
  };

  return (
    <ScrollView className="flex-1 bg-green-deep px-6" keyboardShouldPersistTaps="handled">
      <View className="pt-14 pb-6">
        <Text className="text-cream-dim text-sm mb-1">
          {course.name} · {tee} Tees
        </Text>
        <Text className="text-2xl text-white" style={{ fontFamily: 'serif' }}>
          Round Details
        </Text>
      </View>

      <Input
        label="Round Date"
        value={roundDate}
        onChangeText={setRoundDate}
        placeholder="YYYY-MM-DD"
        accessibilityLabel="Round date"
      />

      <Input
        label="Tee Time"
        value={teeTime}
        onChangeText={setTeeTime}
        placeholder="HH:MM (24h)"
        accessibilityLabel="Tee time"
      />

      <Text className="text-xs tracking-[3px] uppercase text-gold font-bold mb-3">
        Scoring Goal
      </Text>
      <View className="flex-row flex-wrap gap-2 mb-8">
        {SCORING_GOALS.map((goal) => (
          <Pressable
            key={goal}
            onPress={() => {
              Haptics.selectionAsync();
              setScoringGoal(goal);
            }}
            className={`px-4 py-3 rounded-xl border-2 ${
              scoringGoal === goal
                ? 'border-gold bg-gold/20'
                : 'border-gold/15 bg-black/30'
            }`}
          >
            <Text
              className={`text-base font-semibold ${
                scoringGoal === goal ? 'text-gold' : 'text-cream-dim'
              }`}
            >
              {goal}
            </Text>
          </Pressable>
        ))}
      </View>

      {generatePlaybook.isPending && (
        <View className="items-center py-10">
          <Text className="text-3xl mb-4">🏌️‍♂️</Text>
          <Text className="text-lg text-gold font-semibold mb-2">
            Your caddie is studying the course...
          </Text>
          <Text className="text-cream-dim text-center leading-5">
            Analyzing {course.name} with your game profile, weather conditions,
            and scoring goals.
          </Text>
        </View>
      )}

      {generatePlaybook.isError && (
        <View className="bg-danger/12 border border-danger/20 rounded-xl p-4 mb-4">
          <Text className="text-danger font-semibold">
            Failed to generate playbook. Please try again.
          </Text>
        </View>
      )}

      <Button
        title={generatePlaybook.isPending ? 'Generating...' : 'Generate Playbook'}
        onPress={handleGenerate}
        loading={generatePlaybook.isPending}
        disabled={!scoringGoal || generatePlaybook.isPending}
      />

      <View className="h-10" />
    </ScrollView>
  );
}
