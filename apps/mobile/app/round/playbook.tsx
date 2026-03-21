import { ScrollView, View, Text, Pressable, Alert } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
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
import type { TrustLoopData } from '../../components/playbook/TrustLoop';

export default function PlaybookScreen() {
  const router = useRouter();
  const playbook = useRoundStore((s) => s.playbook);
  const course = useRoundStore((s) => s.selectedCourse);
  const scores = useRoundStore((s) => s.scores);
  const currentHole = useRoundStore((s) => s.currentHole);
  const setScore = useRoundStore((s) => s.setScore);
  const setCurrentHole = useRoundStore((s) => s.setCurrentHole);
  const holesCount = useRoundStore((s) => s.holesCount);
  const holesStart = useRoundStore((s) => s.holesStart);
  const isCompetitionMode = useRoundStore((s) => s.isCompetitionMode);
  const holeNotes = useRoundStore((s) => s.holeNotes);
  const setHoleNote = useRoundStore((s) => s.setHoleNote);
  const streamingStatus = useRoundStore((s) => s.streamingStatus);
  const streamingHoles = useRoundStore((s) => s.streamingHoles);
  const streamingMeta = useRoundStore((s) => s.streamingMeta);
  const selectedTee = useRoundStore((s) => s.selectedTee);

  const [preRoundOpen, setPreRoundOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [trustFeedback, setTrustFeedback] = useState<TrustLoopData[]>([]);

  const isStreaming = streamingStatus === 'streaming';

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

  const handleTrustFeedback = (feedback: TrustLoopData) => {
    setTrustFeedback((prev) => {
      // Replace or add feedback for this hole
      return [...prev.filter((f) => f.hole !== feedback.hole), feedback];
    });
  };

  useEffect(() => {
    return () => {
      if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isStreaming && !playbook && !course) router.back();
  }, [playbook, course, router, isStreaming]);

  if (!course) return null;

  // Use playbook data if complete, otherwise use streaming data
  const allHoles = playbook
    ? playbook.holeStrategies
    : streamingHoles.filter((h): h is NonNullable<typeof h> => h !== null);
  const holes = playbook
    ? playbook.holeStrategies.slice(holesStart, holesStart + holesCount)
    : streamingHoles.slice(holesStart, holesStart + holesCount);
  const loadedHoleCount = holes.filter((h) => h !== null).length;
  const teeName = playbook?.teeName || selectedTee || '';
  const teeInfo = (course.tees as TeeInfo[]).find((t) => t.name === teeName);
  const totalYds = teeInfo?.totalYardage || 0;
  const loadedHoles = holes.filter((h): h is NonNullable<typeof h> => h !== null);
  const totalPar = loadedHoles.reduce((s, h) => s + h.par, 0);
  const parChances = loadedHoles.filter((h) => h.is_par_chance).length;
  const holesPlayed = scores.slice(holesStart, holesStart + holesCount).filter((s) => s !== null).length;
  const preRoundTalk = playbook?.preRoundTalk || streamingMeta?.pre_round_talk;
  const projectedScore = playbook?.projectedScore || streamingMeta?.projected_score;
  const driverHolesCount = playbook?.driverHoles?.length || streamingMeta?.driver_holes?.length || 0;

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
        <Text className="text-[13px] tracking-[4px] uppercase text-gold font-semibold mb-2">
          Caddie Playbook
        </Text>
        <Text className="text-[28px] text-white text-center" style={{ fontFamily: 'serif' }}>
          {course.name}
        </Text>
        <Text className="text-[15px] text-cream-dim mt-1.5">
          {teeName} Tees · {holesCount} holes{totalPar > 0 ? ` · Par ${totalPar}` : ''}
          {isStreaming ? ` · ${loadedHoleCount}/${holesCount} loaded` : ''}
        </Text>
      </View>

      {/* Streaming indicator */}
      {isStreaming && loadedHoleCount === 0 && (
        <View className="items-center py-10">
          <Text className="text-3xl mb-4">🏌️‍♂️</Text>
          <Text className="text-lg text-gold font-semibold mb-2">
            Your caddie is studying the course...
          </Text>
          <Text className="text-cream-dim text-center leading-5 px-6">
            Analyzing {course.name} with your game profile, weather conditions, and scoring goals.
          </Text>
        </View>
      )}

      {/* Targets */}
      <View className="flex-row justify-center gap-3.5 py-4 px-5 bg-black/25 border-b border-gold/15">
        <View className="items-center min-w-[80px]">
          <Text className="text-cream-dim text-[13px] mb-1">Projected</Text>
          <Text className="text-2xl text-gold" style={{ fontFamily: 'serif' }}>
            {projectedScore || '—'}
          </Text>
        </View>
        <View className="items-center min-w-[80px]">
          <Text className="text-cream-dim text-[13px] mb-1">Par Chances</Text>
          <Text className="text-2xl text-par-green" style={{ fontFamily: 'serif' }}>
            {parChances}
          </Text>
        </View>
        <View className="items-center min-w-[80px]">
          <Text className="text-cream-dim text-[13px] mb-1">Driver Holes</Text>
          <Text className="text-2xl text-danger" style={{ fontFamily: 'serif' }}>
            {driverHolesCount}
          </Text>
        </View>
      </View>

      {/* Competition Mode Badge */}
      {isCompetitionMode && (
        <View className="mx-4 mt-3 py-2 px-4 bg-gold/10 border border-gold/30 rounded-xl flex-row items-center justify-center gap-2">
          <Text className="text-[13px] tracking-[2px] uppercase text-gold font-bold">Competition Mode</Text>
          <Text className="text-[13px] text-cream-dim">· Rule 4.3 Active</Text>
        </View>
      )}

      {/* Print Yardage Book */}
      {playbook && (
        <Pressable
          onPress={handlePrintYardageBook}
          disabled={isPrinting}
          className="mx-4 mt-3 py-3 px-4 bg-black/20 border border-gold/20 rounded-xl flex-row items-center justify-center gap-2"
        >
          <Text className={`text-sm font-semibold ${isPrinting ? 'text-cream-dim' : 'text-gold'}`}>
            {isPrinting ? 'Generating PDF...' : 'Print Yardage Book'}
          </Text>
        </Pressable>
      )}

      {/* Live Score */}
      {loadedHoleCount > 0 && (
        <LiveScoreBar holes={loadedHoles} scores={scores.slice(holesStart, holesStart + holesCount)} />
      )}

      {/* Pre-Round Talk */}
      {preRoundTalk ? (
        <View className="mx-4 mt-4 mb-2 bg-green-card border border-gold/20 rounded-2xl overflow-hidden">
          <Pressable
            onPress={() => setPreRoundOpen((o) => !o)}
            className="flex-row justify-between items-center px-5 py-4"
          >
            <Text className="text-[13px] tracking-[3px] uppercase text-gold font-bold">
              Pre-Round Talk
            </Text>
            <Text className="text-gold text-lg">{preRoundOpen ? '▲' : '▼'}</Text>
          </Pressable>
          {preRoundOpen && <PreRoundTalk content={preRoundTalk} />}
        </View>
      ) : null}

      {/* Hole Selector */}
      {loadedHoleCount > 0 && (
        <HoleSelector
          holes={loadedHoles}
          currentHole={currentHole}
          scores={scores.slice(holesStart, holesStart + holesCount)}
          onSelect={setCurrentHole}
          holesStart={holesStart}
        />
      )}

      {/* Current Hole Card */}
      {holes[currentHole] ? (
        <HoleCard
          hole={holes[currentHole]!}
          score={scores[holesStart + currentHole]}
          onScore={(score) => setScore(holesStart + currentHole, score)}
          onNext={() => setCurrentHole(Math.min(currentHole + 1, holesCount - 1))}
          isCompetitionMode={isCompetitionMode}
          note={holeNotes[holesStart + currentHole]}
          onNote={(n) => handleNoteChange(holesStart + currentHole, n)}
          onTrustFeedback={handleTrustFeedback}
        />
      ) : isStreaming ? (
        <View className="mx-4 mt-4 p-6 bg-green-card border border-gold/10 rounded-2xl items-center">
          <Text className="text-cream-dim text-[15px]">
            Analyzing hole {holesStart + currentHole + 1}...
          </Text>
        </View>
      ) : null}

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
