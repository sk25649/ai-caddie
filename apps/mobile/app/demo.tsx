import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../components/ui/Button';
import { useState } from 'react';
import { HoleCard } from '../components/playbook/HoleCard';

// Sample playbook for demo — no DB lookup needed
const SAMPLE_PLAYBOOK = {
  id: 'demo-playbook',
  profileId: 'demo-user',
  courseId: 'demo-course',
  teeName: 'Blue',
  scoringGoal: 'Break 90',
  weatherConditions: { temperature: 72, wind: 'calm', conditions: 'clear' },
  roundDate: new Date().toISOString().split('T')[0],
  teeTime: '10:00 AM',
  preRoundTalk: 'Trust your swing. Play your game. One shot at a time.',
  holeStrategies: [
    {
      hole_number: 1,
      handicap_index: 5,
      yardage: 385,
      par: 4,
      tee_club: 'Driver',
      aim_point: 'Left center fairway, avoid right bunker at 220',
      carry_target: 230,
      play_bullets: ['Driver to 230, left side', 'Approach from 155 yards', 'Par is a win'],
      terrain_note: 'Fairway slopes left to right—ball will feed toward right bunker',
      miss_left: 'Left rough—still playable approach',
      miss_right: 'Bunker at 220—adds 1 stroke to reach green',
      miss_short: 'Still 200+ yards in—take 3-wood next time',
      danger: 'Right bunker at 220 yards. Back bunker behind green.',
      target: 'Left-center landing at 230 yards',
      is_par_chance: false,
      strategy: 'Lay up left to avoid right bunker. Green is elevated. Approach from below is easier.',
      approach_club: '7-Iron',
      approach_distance: 155,
    },
    {
      hole_number: 2,
      handicap_index: 13,
      yardage: 145,
      par: 3,
      tee_club: '6-Iron',
      aim_point: 'Center green, front left is safest',
      carry_target: 145,
      play_bullets: ['6-iron to center', 'Green is firm—land short', 'One-putt pace'],
      terrain_note: 'Back of green drops away sharply—miss long = chip down',
      miss_left: 'Light rough, 20 feet short—easy pitch',
      miss_right: 'Deep bunker—tricky exit angle',
      miss_short: 'Front apron—bump and run for easy par',
      danger: 'Back bunker. Back edge drops off quickly.',
      target: 'Front-center green (15-20 feet from hole)',
      is_par_chance: true,
      strategy: 'This is a par chance. Hit 6-iron solid. Land short of back bunker.',
      approach_distance: 0,
    },
    {
      hole_number: 3,
      handicap_index: 1,
      yardage: 520,
      par: 5,
      tee_club: '3-Wood',
      aim_point: 'Right center fairway, aim for the oak tree at 250',
      carry_target: 210,
      play_bullets: [
        '3-wood right of oak tree at 250',
        'Lay up to 150 from green',
        'Inside 150 = birdie chance',
      ],
      terrain_note: 'Valley at 190 yards makes hole play 20 yards longer. Aim beyond it.',
      miss_left: 'Left rough—narrows approach window',
      miss_right: 'Right bunker at 275—adds a stroke',
      miss_short: 'Still 300+ in. Lay up again, don't go for it.',
      danger: 'Valley hidden in fairway at 190 (plays longer). Right bunker at 275.',
      target: 'Right-center landing at 250 yards, past the valley',
      is_par_chance: false,
      strategy: 'Don't be fooled by distance. Valley makes it play longer. Lay up in two, birdie in three.',
      approach_club: '8-Iron',
      approach_distance: 150,
    },
  ],
};

export default function DemoScreen() {
  const router = useRouter();
  const [currentHole, setCurrentHole] = useState(0);
  const hole = SAMPLE_PLAYBOOK.holeStrategies[currentHole];

  const handleNext = () => {
    if (currentHole < SAMPLE_PLAYBOOK.holeStrategies.length - 1) {
      setCurrentHole(currentHole + 1);
    }
  };

  const handlePrev = () => {
    if (currentHole > 0) {
      setCurrentHole(currentHole - 1);
    }
  };

  const handleStart = () => {
    router.replace('/onboarding/basics');
  };

  return (
    <ScrollView className="flex-1 bg-green-deep" contentInsetAdjustmentBehavior="automatic">
      {/* Header */}
      <View className="pt-6 pb-4 px-6 border-b-2 border-gold">
        <Text className="text-[13px] tracking-[4px] uppercase text-gold font-semibold mb-2">
          Demo Mode
        </Text>
        <Text className="text-2xl text-white mb-2" style={{ fontFamily: 'serif' }}>
          See the Magic
        </Text>
        <Text className="text-cream-dim text-sm leading-5">
          This is a sample playbook. Swipe through a few holes to see how AI Caddie guides your decisions.
        </Text>
      </View>

      {/* Sample Hole Card */}
      <View className="p-6">
        <HoleCard
          hole={hole}
          currentHole={currentHole}
          totalHoles={SAMPLE_PLAYBOOK.holeStrategies.length}
          onSaveScore={() => {}}
          onNote={() => {}}
          note=""
        />

        {/* Navigation */}
        <View className="flex-row gap-3 mt-6">
          <Pressable
            onPress={handlePrev}
            disabled={currentHole === 0}
            className="flex-1"
          >
            <View className="bg-gold/10 border border-gold/20 rounded-lg py-3 items-center disabled:opacity-50">
              <Text className="text-gold text-base font-medium">← Prev</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={handleNext}
            disabled={currentHole === SAMPLE_PLAYBOOK.holeStrategies.length - 1}
            className="flex-1"
          >
            <View className="bg-gold/10 border border-gold/20 rounded-lg py-3 items-center disabled:opacity-50">
              <Text className="text-gold text-base font-medium">Next →</Text>
            </View>
          </Pressable>
        </View>

        {/* Dots indicator */}
        <View className="flex-row justify-center gap-1.5 mt-4">
          {SAMPLE_PLAYBOOK.holeStrategies.map((_, idx) => (
            <View
              key={idx}
              className={`h-2 w-2 rounded-full ${
                idx === currentHole ? 'bg-gold' : 'bg-gold/30'
              }`}
            />
          ))}
        </View>

        {/* CTA Section */}
        <View className="mt-8 p-5 bg-green-card border border-gold/30 rounded-xl">
          <Text className="text-cream text-lg font-semibold mb-2">
            This is personalized to YOU.
          </Text>
          <Text className="text-cream-dim text-sm leading-5 mb-4">
            This sample uses a default player profile. Your playbooks are custom to:
          </Text>
          <View className="gap-2 mb-6">
            <Text className="text-gold text-sm">
              • Your clubs and how far you hit each one
            </Text>
            <Text className="text-gold text-sm">
              • Your shot shape (slice, hook, draw, fade)
            </Text>
            <Text className="text-gold text-sm">
              • Your goals (break 90, break 80, etc.)
            </Text>
          </View>

          <Button
            title="Create My Custom Playbook"
            onPress={handleStart}
            className="mb-3"
          />

          <Pressable onPress={() => router.replace('/(auth)/login')}>
            <Text className="text-gold text-center text-sm font-medium">
              Already have an account? Sign in
            </Text>
          </Pressable>
        </View>

        <View className="h-6" />
      </View>
    </ScrollView>
  );
}
