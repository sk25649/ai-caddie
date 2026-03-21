import { View, Text, ScrollView, Pressable } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useRoundStore } from '../../stores/roundStore';
import { useGeneratePlaybook, useGeneratePlaybookFromDescription } from '../../hooks/usePlaybook';
import { Button } from '../../components/ui/Button';

const SCORING_GOALS = [
  'Break 80',
  'Break 85',
  'Break 90',
  'Break 95',
  'Break 100',
  'Just have fun',
];

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function dateLabel(dateStr: string): string {
  const today = formatDate(new Date());
  const tomorrow = formatDate(new Date(Date.now() + 86400000));
  if (dateStr === today) return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';
  // Format as "Mon Mar 21"
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

const TEE_TIMES: string[] = [];
for (let h = 6; h <= 17; h++) {
  TEE_TIMES.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 17) TEE_TIMES.push(`${String(h).padStart(2, '0')}:30`);
}

export default function DetailsScreen() {
  const router = useRouter();
  const course = useRoundStore((s) => s.selectedCourse);
  const tee = useRoundStore((s) => s.selectedTee);
  const setRoundDetails = useRoundStore((s) => s.setRoundDetails);
  const setPlaybook = useRoundStore((s) => s.setPlaybook);
  const holesCount = useRoundStore((s) => s.holesCount);
  const setHolesCount = useRoundStore((s) => s.setHolesCount);
  const isCompetitionMode = useRoundStore((s) => s.isCompetitionMode);
  const setCompetitionMode = useRoundStore((s) => s.setCompetitionMode);
  const isCustomCourse = useRoundStore((s) => s.isCustomCourse);
  const customCourseName = useRoundStore((s) => s.customCourseName);
  const customCourseTeeName = useRoundStore((s) => s.customCourseTeeName);
  const customCourseDescription = useRoundStore((s) => s.customCourseDescription);
  const customCourseCity = useRoundStore((s) => s.customCourseCity);
  const customCourseState = useRoundStore((s) => s.customCourseState);
  const generatePlaybook = useGeneratePlaybook();
  const generateFromDescription = useGeneratePlaybookFromDescription();

  const today = formatDate(new Date());
  const tomorrow = formatDate(new Date(Date.now() + 86400000));
  const [roundDate, setRoundDate] = useState(today);
  const [teeTime, setTeeTime] = useState('08:00');
  const [scoringGoal, setScoringGoal] = useState('');

  useEffect(() => {
    if (!isCustomCourse && (!course || !tee)) router.back();
  }, [isCustomCourse, course, tee, router]);

  if (!isCustomCourse && (!course || !tee)) return null;

  const handleGenerate = () => {
    if (!scoringGoal) return;
    setRoundDetails(roundDate, teeTime, scoringGoal);

    if (isCustomCourse && customCourseName && customCourseTeeName && customCourseDescription) {
      generateFromDescription.mutate(
        {
          courseName: customCourseName,
          teeName: customCourseTeeName,
          courseDescription: customCourseDescription,
          roundDate,
          teeTime,
          scoringGoal,
          city: customCourseCity ?? undefined,
          state: customCourseState ?? undefined,
        },
        {
          onSuccess: (playbook) => {
            setPlaybook(playbook);
            router.push('/round/playbook');
          },
        }
      );
    } else if (course && tee) {
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
    }
  };

  return (
    <ScrollView className="flex-1 bg-green-deep px-6" keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
      <View className="pt-6 pb-6">
        <Pressable onPress={() => router.back()} className="py-2 mb-2 self-start">
          <Text className="text-gold text-base">‹ Back</Text>
        </Pressable>
        <Text className="text-cream-dim text-sm mb-1">
          {isCustomCourse ? customCourseName : course?.name} · {isCustomCourse ? customCourseTeeName : tee} Tees
        </Text>
        <Text className="text-2xl text-white" style={{ fontFamily: 'serif' }}>
          Round Details
        </Text>
      </View>

      {/* Holes */}
      <Text className="text-xs tracking-[3px] uppercase text-gold font-bold mb-3">
        Holes
      </Text>
      <View className="flex-row gap-2 mb-6">
        {([9, 18] as const).map((n) => (
          <Pressable
            key={n}
            onPress={() => { Haptics.selectionAsync(); setHolesCount(n); }}
            className={`flex-1 py-3.5 rounded-xl border-2 items-center ${
              holesCount === n ? 'border-gold bg-gold/20' : 'border-gold/15 bg-black/30'
            }`}
          >
            <Text className={`text-base font-semibold ${holesCount === n ? 'text-gold' : 'text-cream-dim'}`}>
              {n} Holes
            </Text>
            <Text className={`text-xs mt-0.5 ${holesCount === n ? 'text-gold/70' : 'text-cream-dim/50'}`}>
              {n === 9 ? 'Front 9' : 'Full Round'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Date */}
      <Text className="text-xs tracking-[3px] uppercase text-gold font-bold mb-3">
        Round Date
      </Text>
      <View className="flex-row gap-2 mb-6">
        {[today, tomorrow].map((d) => (
          <Pressable
            key={d}
            onPress={() => {
              Haptics.selectionAsync();
              setRoundDate(d);
            }}
            className={`flex-1 py-3.5 rounded-xl border-2 items-center ${
              roundDate === d ? 'border-gold bg-gold/20' : 'border-gold/15 bg-black/30'
            }`}
          >
            <Text className={`text-base font-semibold ${roundDate === d ? 'text-gold' : 'text-cream-dim'}`}>
              {d === today ? 'Today' : 'Tomorrow'}
            </Text>
            <Text className={`text-xs mt-0.5 ${roundDate === d ? 'text-gold/70' : 'text-cream-dim/50'}`}>
              {dateLabel(d)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tee Time */}
      <Text className="text-xs tracking-[3px] uppercase text-gold font-bold mb-3">
        Tee Time
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6" contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
        {TEE_TIMES.map((t) => (
          <Pressable
            key={t}
            onPress={() => {
              Haptics.selectionAsync();
              setTeeTime(t);
            }}
            className={`px-4 py-3 rounded-xl border-2 items-center ${
              teeTime === t ? 'border-gold bg-gold/20' : 'border-gold/15 bg-black/30'
            }`}
          >
            <Text className={`text-base font-semibold ${teeTime === t ? 'text-gold' : 'text-cream-dim'}`}>
              {(() => {
                const [hh, mm] = t.split(':').map(Number);
                const period = hh < 12 ? 'AM' : 'PM';
                const h = hh % 12 || 12;
                return `${h}:${String(mm).padStart(2, '0')} ${period}`;
              })()}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

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

      {/* Competition Mode */}
      <View className="mb-6 bg-green-card border border-gold/20 rounded-xl p-4">
        <View className="flex-row justify-between items-center mb-2">
          <View className="flex-1 mr-4">
            <Text className="text-base font-semibold text-cream">Competition Round</Text>
            <Text className="text-xs text-cream-dim mt-1 leading-4">
              Hides strategy on-course (Rule 4.3). Study your playbook now — print it before you play.
            </Text>
          </View>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setCompetitionMode(!isCompetitionMode);
            }}
            className={`w-14 h-8 rounded-full justify-center px-1 ${
              isCompetitionMode ? 'bg-gold' : 'bg-black/40 border border-gold/20'
            }`}
          >
            <View className={`w-6 h-6 rounded-full bg-white ${
              isCompetitionMode ? 'self-end' : 'self-start'
            }`} />
          </Pressable>
        </View>
      </View>

      {(generatePlaybook.isPending || generateFromDescription.isPending) && (
        <View className="items-center py-10">
          <Text className="text-3xl mb-4">🏌️‍♂️</Text>
          <Text className="text-lg text-gold font-semibold mb-2">
            Your caddie is studying the course...
          </Text>
          <Text className="text-cream-dim text-center leading-5">
            Analyzing {isCustomCourse ? customCourseName : course?.name} with your game profile, weather conditions,
            and scoring goals.
          </Text>
        </View>
      )}

      {(generatePlaybook.isError || generateFromDescription.isError) && (
        <View className="bg-danger/12 border border-danger/20 rounded-xl p-4 mb-4">
          <Text className="text-danger font-semibold mb-1">
            Failed to generate playbook.
          </Text>
          <Text className="text-danger/80 text-sm">
            {(generatePlaybook.error || generateFromDescription.error)?.message || 'Please try again.'}
          </Text>
        </View>
      )}

      <Button
        title={(generatePlaybook.isPending || generateFromDescription.isPending) ? 'Generating...' : 'Generate Playbook'}
        onPress={handleGenerate}
        loading={generatePlaybook.isPending || generateFromDescription.isPending}
        disabled={!scoringGoal || generatePlaybook.isPending || generateFromDescription.isPending}
      />

      <View className="h-10" />
    </ScrollView>
  );
}
