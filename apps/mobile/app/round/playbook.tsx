import { ScrollView, View, Text, Pressable, Alert } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useRoundStore } from '../../stores/roundStore';
import { HoleSelector } from '../../components/playbook/HoleSelector';
import { HoleCard } from '../../components/playbook/HoleCard';
import { LiveScoreBar } from '../../components/playbook/LiveScoreBar';
import { PreRoundTalk } from '../../components/playbook/PreRoundTalk';
import { Button } from '../../components/ui/Button';
import { updatePlaybookNote, getYardageBookHtml } from '../../lib/api';
import type { TeeInfo } from '../../lib/api';

export default function PlaybookScreen() {
  const router = useRouter();
  const playbook = useRoundStore((s) => s.playbook);
  const course = useRoundStore((s) => s.selectedCourse);
  const scores = useRoundStore((s) => s.scores);
  const currentHole = useRoundStore((s) => s.currentHole);
  const setScore = useRoundStore((s) => s.setScore);
  const setCurrentHole = useRoundStore((s) => s.setCurrentHole);
  const isCompetitionMode = useRoundStore((s) => s.isCompetitionMode);
  const holeNotes = useRoundStore((s) => s.holeNotes);
  const setHoleNote = useRoundStore((s) => s.setHoleNote);

  const [preRoundOpen, setPreRoundOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNoteChange = (holeIndex: number, note: string) => {
    setHoleNote(holeIndex, note);
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    noteTimerRef.current = setTimeout(() => {
      if (playbook?.id) {
        updatePlaybookNote(playbook.id, holeIndex, note).catch(() => {});
      }
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    };
  }, []);

  // Stop any in-progress speech when the user switches holes
  useEffect(() => {
    Speech.stop();
  }, [currentHole]);

  useEffect(() => {
    if (!playbook || !course) router.back();
  }, [playbook, course, router]);

  if (!playbook || !course) return null;

  const holes = playbook.holeStrategies;
  const teeInfo = (course.tees as TeeInfo[]).find((t) => t.name === playbook.teeName);
  const totalYds = teeInfo?.totalYardage || 0;
  const totalPar = holes.reduce((s, h) => s + h.par, 0);
  const parChances = holes.filter((h) => h.is_par_chance).length;
  const holesPlayed = scores.filter((s) => s !== null).length;

  const handleFinishRound = () => {
    router.push('/post-round/summary');
  };

  const handlePrintYardageBook = async () => {
    if (!playbook?.id) return;
    setIsPrinting(true);
    try {
      const html = await getYardageBookHtml(playbook.id);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `${course.name} Yardage Book`,
        UTI: 'com.adobe.pdf',
      });
    } catch {
      Alert.alert('Error', 'Could not generate yardage book. Please try again.');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-green-deep" contentInsetAdjustmentBehavior="automatic">
      {/* Header */}
      <View className="pt-6 pb-6 px-5 border-b-2 border-gold items-center">
        <Pressable onPress={() => router.replace('/')} className="absolute left-5 top-6 py-2">
          <Text className="text-gold text-base">⌂ Home</Text>
        </Pressable>
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

      {/* Competition Mode Badge */}
      {isCompetitionMode && (
        <View className="mx-4 mt-3 py-2 px-4 bg-gold/10 border border-gold/30 rounded-xl flex-row items-center justify-center gap-2">
          <Text className="text-xs tracking-[3px] uppercase text-gold font-bold">Competition Mode</Text>
          <Text className="text-xs text-cream-dim">· Rule 4.3 Active</Text>
        </View>
      )}

      {/* Print Yardage Book */}
      <Pressable
        onPress={handlePrintYardageBook}
        disabled={isPrinting}
        className="mx-4 mt-3 py-3 px-4 bg-black/20 border border-gold/20 rounded-xl flex-row items-center justify-center gap-2"
      >
        <Text className={`text-sm font-semibold ${isPrinting ? 'text-cream-dim' : 'text-gold'}`}>
          {isPrinting ? 'Generating PDF...' : 'Print Yardage Book'}
        </Text>
      </Pressable>

      {/* Live Score */}
      <LiveScoreBar holes={holes} scores={scores} />

      {/* Pre-Round Talk */}
      {playbook.preRoundTalk ? (
        <View className="mx-4 mt-4 mb-2 bg-green-card border border-gold/20 rounded-2xl overflow-hidden">
          <Pressable
            onPress={() => setPreRoundOpen((o) => !o)}
            className="flex-row justify-between items-center px-5 py-4"
          >
            <Text className="text-xs tracking-[4px] uppercase text-gold font-bold">
              Pre-Round Talk
            </Text>
            <Text className="text-gold text-lg">{preRoundOpen ? '▲' : '▼'}</Text>
          </Pressable>
          {preRoundOpen && <PreRoundTalk content={playbook.preRoundTalk} />}
        </View>
      ) : null}

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
          onNext={() => setCurrentHole(Math.min(currentHole + 1, 17))}
          isCompetitionMode={isCompetitionMode}
          note={holeNotes[currentHole]}
          onNote={(n) => handleNoteChange(currentHole, n)}
        />
      )}

      {/* Finish Round */}
      {holesPlayed >= 1 && (
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
