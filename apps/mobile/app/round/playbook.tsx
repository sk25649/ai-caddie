import { ScrollView, View, Text } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useRoundStore } from '../../stores/roundStore';
import { HoleSelector } from '../../components/playbook/HoleSelector';
import { HoleCard } from '../../components/playbook/HoleCard';
import { LiveScoreBar } from '../../components/playbook/LiveScoreBar';
import { PreRoundTalk } from '../../components/playbook/PreRoundTalk';
import { Button } from '../../components/ui/Button';
import type { TeeInfo } from '../../lib/api';

export default function PlaybookScreen() {
  const router = useRouter();
  const playbook = useRoundStore((s) => s.playbook);
  const course = useRoundStore((s) => s.selectedCourse);
  const scores = useRoundStore((s) => s.scores);
  const currentHole = useRoundStore((s) => s.currentHole);
  const setScore = useRoundStore((s) => s.setScore);
  const setCurrentHole = useRoundStore((s) => s.setCurrentHole);

  // Stop any in-progress speech when the user switches holes
  useEffect(() => {
    Speech.stop();
  }, [currentHole]);

  if (!playbook || !course) {
    router.back();
    return null;
  }

  const holes = playbook.holeStrategies;
  const teeInfo = (course.tees as TeeInfo[]).find((t) => t.name === playbook.teeName);
  const totalYds = teeInfo?.totalYardage || 0;
  const totalPar = holes.reduce((s, h) => s + h.par, 0);
  const parChances = holes.filter((h) => h.is_par_chance).length;
  const holesPlayed = scores.filter((s) => s !== null).length;

  const handleFinishRound = () => {
    router.push('/post-round/summary');
  };

  return (
    <ScrollView className="flex-1 bg-green-deep">
      {/* Header */}
      <View className="pt-14 pb-6 px-5 border-b-2 border-gold items-center">
        <Text className="text-xs tracking-[5px] uppercase text-gold font-semibold mb-2">
          Caddie Playbook
        </Text>
        <Text className="text-[28px] text-white text-center" style={{ fontFamily: 'serif' }}>
          {course.name}
        </Text>
        <Text className="text-[15px] text-cream-dim mt-1.5">
          {playbook.teeName} Tees · {totalYds} yds · Par {totalPar}
        </Text>
      </View>

      {/* Targets */}
      <View className="flex-row justify-center gap-3.5 py-4 px-5 bg-black/25 border-b border-gold/15">
        <View className="items-center min-w-[80px]">
          <Text className="text-cream-dim text-xs mb-1">Projected</Text>
          <Text className="text-2xl text-gold" style={{ fontFamily: 'serif' }}>
            {playbook.projectedScore || '—'}
          </Text>
        </View>
        <View className="items-center min-w-[80px]">
          <Text className="text-cream-dim text-xs mb-1">Par Chances</Text>
          <Text className="text-2xl text-par-green" style={{ fontFamily: 'serif' }}>
            {parChances}
          </Text>
        </View>
        <View className="items-center min-w-[80px]">
          <Text className="text-cream-dim text-xs mb-1">Driver Holes</Text>
          <Text className="text-2xl text-danger" style={{ fontFamily: 'serif' }}>
            {playbook.driverHoles?.length || 0}
          </Text>
        </View>
      </View>

      {/* Live Score */}
      <LiveScoreBar holes={holes} scores={scores} />

      {/* Hole Selector */}
      <HoleSelector
        holes={holes}
        currentHole={currentHole}
        scores={scores}
        onSelect={setCurrentHole}
      />

      {/* Current Hole Card */}
      {holes[currentHole] && (
        <HoleCard
          hole={holes[currentHole]}
          score={scores[currentHole]}
          onScore={(score) => setScore(currentHole, score)}
        />
      )}

      {/* Pre-Round Talk */}
      {playbook.preRoundTalk && <PreRoundTalk content={playbook.preRoundTalk} />}

      {/* Finish Round */}
      {holesPlayed >= 18 && (
        <View className="px-4 pb-6">
          <Button title="Finish Round" onPress={handleFinishRound} />
        </View>
      )}

      {/* Footer */}
      <View className="items-center py-5 border-t border-gold/8">
        <Text className="text-[15px] text-gold-dim">
          Bogey is your par. Pars are your birdies. 🏌️‍♂️
        </Text>
      </View>
    </ScrollView>
  );
}
