import { View, Text, ScrollView, Alert } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useRoundStore } from '../../stores/roundStore';
import { saveRound } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useState } from 'react';
import { Input } from '../../components/ui/Input';

export default function SummaryScreen() {
  const router = useRouter();
  const playbook = useRoundStore((s) => s.playbook);
  const course = useRoundStore((s) => s.selectedCourse);
  const scores = useRoundStore((s) => s.scores);
  const reset = useRoundStore((s) => s.reset);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!playbook || !course) router.replace('/');
  }, [playbook, course, router]);

  if (!playbook || !course) return null;

  const holes = playbook.holeStrategies;
  const holeScores = scores.map((s, i) => s ?? holes[i].par + 1);
  const totalScore = holeScores.reduce((sum, s) => sum + s, 0);
  const frontScore = holeScores.slice(0, 9).reduce((sum, s) => sum + s, 0);
  const backScore = holeScores.slice(9).reduce((sum, s) => sum + s, 0);
  const frontPar = holes.slice(0, 9).reduce((sum, h) => sum + h.par, 0);
  const backPar = holes.slice(9).reduce((sum, h) => sum + h.par, 0);
  const totalPar = holes.reduce((sum, h) => sum + h.par, 0);
  const overPar = totalScore - totalPar;

  const pars = holeScores.filter((s, i) => s === holes[i].par).length;
  const bogeys = holeScores.filter((s, i) => s === holes[i].par + 1).length;
  const doubles = holeScores.filter((s, i) => s >= holes[i].par + 2).length;
  const birdies = holeScores.filter((s, i) => s < holes[i].par).length;

  const parConversion = Math.round((pars / 18) * 100);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveRound({
        playbookId: playbook.id,
        courseId: course.id,
        roundDate: playbook.roundDate || new Date().toISOString().split('T')[0],
        teeName: playbook.teeName,
        holeScores,
        totalScore,
        notes: notes || undefined,
      });
      Alert.alert('Round Saved', `${totalScore} at ${course.name}`, [
        {
          text: 'Done',
          onPress: () => {
            reset();
            router.replace('/');
          },
        },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to save round. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-green-deep" contentInsetAdjustmentBehavior="automatic">
      <View className="pt-6 pb-6 px-6 items-center border-b-2 border-gold">
        <Text className="text-xs tracking-[5px] uppercase text-gold font-semibold mb-2">
          Round Complete
        </Text>
        <Text className="text-[48px] text-gold" style={{ fontFamily: 'serif' }}>
          {totalScore}
        </Text>
        <Text className="text-lg text-cream-dim">
          {overPar > 0 ? '+' : ''}{overPar} · {course.name}
        </Text>
      </View>

      <View className="p-6">
        {/* Front/Back Split */}
        <Card className="mb-4">
          <View className="flex-row">
            <View className="flex-1 items-center py-4 border-r border-gold/10">
              <Text className="text-cream-dim text-sm mb-1">Front 9</Text>
              <Text className="text-2xl text-gold" style={{ fontFamily: 'serif' }}>
                {frontScore}
              </Text>
              <Text className="text-xs text-cream-dim">
                ({frontScore > frontPar ? '+' : ''}{frontScore - frontPar})
              </Text>
            </View>
            <View className="flex-1 items-center py-4">
              <Text className="text-cream-dim text-sm mb-1">Back 9</Text>
              <Text className="text-2xl text-gold" style={{ fontFamily: 'serif' }}>
                {backScore}
              </Text>
              <Text className="text-xs text-cream-dim">
                ({backScore > backPar ? '+' : ''}{backScore - backPar})
              </Text>
            </View>
          </View>
        </Card>

        {/* Scoring Breakdown */}
        <Card className="mb-4">
          <View className="p-5">
            <Text className="text-xs tracking-[3px] uppercase text-gold font-bold mb-4">
              Scoring Breakdown
            </Text>
            <View className="gap-3">
              {birdies > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-cream">Birdies or better</Text>
                  <Text className="text-par-green font-bold">{birdies}</Text>
                </View>
              )}
              <View className="flex-row justify-between">
                <Text className="text-cream">Pars</Text>
                <Text className="text-gold font-bold">{pars}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-cream">Bogeys</Text>
                <Text className="text-cream-dim font-bold">{bogeys}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-cream">Doubles+</Text>
                <Text className="text-danger font-bold">{doubles}</Text>
              </View>
              <View className="flex-row justify-between pt-3 border-t border-gold/10">
                <Text className="text-cream">Par Conversion</Text>
                <Text className="text-gold font-bold">{parConversion}%</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Notes */}
        <Input
          label="Round Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="How did it feel out there?"
          multiline
          numberOfLines={3}
          accessibilityLabel="Round notes"
        />

        <Button title="Save Round" onPress={handleSave} loading={saving} className="mt-2" />
      </View>
    </ScrollView>
  );
}
