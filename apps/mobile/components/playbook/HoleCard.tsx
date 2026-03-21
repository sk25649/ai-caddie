import { View, Text, Pressable, TextInput } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import type { HoleStrategy } from '../../lib/api';
import { buildVoiceScript } from '../../lib/voiceScript';
import { useElevenLabsVoice } from '../../hooks/useElevenLabsVoice';
import { Card } from '../ui/Card';
import { SectionLabel } from '../ui/SectionLabel';
import { TrustLoop, type TrustLoopData } from './TrustLoop';

interface HoleCardProps {
  hole: HoleStrategy;
  score: number | null;
  onScore: (score: number | null) => void;
  onNext?: () => void;
  isCompetitionMode?: boolean;
  note?: string;
  onNote?: (note: string) => void;
  onTrustFeedback?: (feedback: TrustLoopData) => void;
}

type MissType = 'left' | 'right' | 'short' | null;

function scoreLabel(d: number): string {
  if (d <= -2) return 'Eagle';
  if (d === -1) return 'Birdie';
  if (d === 0) return 'Par';
  if (d === 1) return 'Bogey';
  if (d === 2) return 'Dbl';
  if (d === 3) return 'Trpl';
  return `+${d}`;
}

function scoreColor(d: number): string {
  if (d <= -1) return '#3dbd6e';
  if (d === 0) return '#d4a843';
  if (d === 1) return '#b8a888';
  if (d === 2) return '#e07055';
  return '#cc3333';
}


export function HoleCard({ hole, score, onScore, onNext, isCompetitionMode = false, note, onNote, onTrustFeedback }: HoleCardProps) {
  const [activeMiss, setActiveMiss] = useState<MissType>(null);
  const [competitionRevealed, setCompetitionRevealed] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [showTrustLoop, setShowTrustLoop] = useState(false);
  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voice = useElevenLabsVoice();

  useEffect(() => () => { if (nextTimerRef.current) clearTimeout(nextTimerRef.current); }, []);

  useEffect(() => {
    setCompetitionRevealed(false);
    setShowTrustLoop(false);
  }, [hole.hole_number]);

  // Show trust loop when score is first entered (not when cleared)
  useEffect(() => {
    if (score !== null && !showTrustLoop) {
      // Delay slightly so player sees score first
      const timer = setTimeout(() => setShowTrustLoop(true), 500);
      return () => clearTimeout(timer);
    }
  }, [score, showTrustLoop]);

  const toggleMiss = (type: MissType) => {
    Haptics.selectionAsync();
    setActiveMiss((prev) => (prev === type ? null : type));
  };

  const handleVoice = () => {
    if (voice.isSpeaking) {
      voice.stop();
    } else {
      voice.speak(buildVoiceScript(hole));
    }
  };

  const handleScore = (value: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const isSetting = score !== value;
    onScore(score === value ? null : value);
    if (isSetting) {
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
      nextTimerRef.current = setTimeout(() => onNext?.(), 400);
    }
  };

  const missText =
    activeMiss === 'left'
      ? hole.miss_left
      : activeMiss === 'right'
        ? hole.miss_right
        : activeMiss === 'short'
          ? hole.miss_short
          : '';

  // Determine play bullets — new field or fall back to legacy strategy
  const bullets: string[] =
    hole.play_bullets && hole.play_bullets.length > 0
      ? hole.play_bullets
      : hole.strategy
        ? [hole.strategy]
        : [];

  const hasTerrainNote = Boolean(hole.terrain_note && hole.terrain_note.trim().length > 0);

  return (
    <Card className="mx-4 mb-5">
      {/* Header */}
      <View
        className={`flex-row justify-between items-center px-6 py-5 border-b border-gold/12 ${
          hole.is_par_chance ? 'bg-par-green/[0.06]' : 'bg-gold/[0.04]'
        }`}
      >
        <View>
          <Text className="text-[28px] text-white" style={{ fontFamily: 'serif' }}>
            Hole {hole.hole_number}
          </Text>
          <Text className="text-[15px] text-cream-dim mt-1">
            {hole.handicap_index != null ? `HDCP ${hole.handicap_index}` : ''}
            {hole.is_par_chance && (
              <Text className="text-par-green font-bold"> ★ PAR</Text>
            )}
          </Text>
        </View>
        <View className="flex-row items-center gap-3">
          {/* Voice button */}
          <Pressable
            onPress={handleVoice}
            disabled={voice.isLoading}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: voice.isSpeaking ? 'rgba(212,168,67,0.2)' : 'rgba(255,255,255,0.08)' }}
          >
            <Text className="text-[20px]">
              {voice.isLoading ? '⏳' : voice.isSpeaking ? '⏹' : '🔊'}
            </Text>
          </Pressable>
          <View className="items-end">
            <Text className="text-[38px] text-gold" style={{ fontFamily: 'serif' }}>
              {hole.yardage}
            </Text>
            <Text className="text-sm text-cream-dim font-semibold">
              YDS · PAR {hole.par}
            </Text>
          </View>
        </View>
      </View>

      {/* Tee Club */}
      <View className="flex-row items-center gap-3 px-6 py-3.5 border-b border-gold/8 bg-black/15">
        <View
          className={`px-3.5 py-1.5 rounded-lg ${
            hole.tee_club.includes('Driver') ? 'bg-danger' : 'bg-gold'
          }`}
        >
          <Text
            className={`text-[13px] font-bold tracking-wider ${
              hole.tee_club.includes('Driver') ? 'text-white' : 'text-green-deep'
            }`}
          >
            TEE
          </Text>
        </View>
        <Text className="text-xl font-bold text-white">{hole.tee_club}</Text>
      </View>

      {/* Aim Point — hero element */}
      {hole.aim_point ? (
        <View className="px-6 pt-5 pb-4 border-b border-gold/8">
          <Text className="text-[13px] text-gold tracking-[3px] font-bold uppercase mb-2">
            Aim Here
          </Text>
          <Text className="text-[22px] font-bold text-white leading-8">
            {hole.aim_point}
          </Text>
          {(!isCompetitionMode || competitionRevealed) && hole.carry_target ? (
            <View className="flex-row items-baseline gap-1.5 mt-2">
              <Text className="text-[13px] text-cream-dim tracking-[2px] font-semibold uppercase">
                Carry
              </Text>
              <Text className="text-[24px] font-bold text-gold" style={{ fontFamily: 'serif' }}>
                {hole.carry_target}
              </Text>
              <Text className="text-sm text-cream-dim font-semibold">yds</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Strategy sections — hidden in competition mode until revealed */}
      {(!isCompetitionMode || competitionRevealed) && (
        <>
          {/* Play Bullets */}
          {bullets.length > 0 ? (
            <View className="px-6 pt-5 pb-4">
              <SectionLabel>Game Plan</SectionLabel>
              <View className="gap-3 mt-1">
                {bullets.map((bullet, i) => (
                  <View key={i} className="flex-row gap-3 items-start">
                    <View className="w-6 h-6 rounded-full bg-gold/20 items-center justify-center mt-0.5 shrink-0">
                      <Text className="text-[12px] font-bold text-gold">{i + 1}</Text>
                    </View>
                    <Text className="text-[17px] leading-7 text-cream flex-1">{bullet}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Target */}
          <View
            className={`mx-5 p-4 rounded-[14px] flex-row items-center gap-3.5 border-2 ${
              hole.is_par_chance
                ? 'bg-par-green/10 border-par-green/30'
                : 'bg-gold/[0.06] border-gold/15'
            }`}
          >
            <Text className="text-[26px]">{hole.is_par_chance ? '🎯' : '🛡️'}</Text>
            <View>
              <Text className="text-[13px] text-cream-dim tracking-widest font-semibold uppercase">
                Target
              </Text>
              <Text className="text-[19px] font-bold text-white mt-0.5">
                {hole.target}
              </Text>
            </View>
          </View>

          {/* Terrain Warning — amber/orange, distinct from red danger */}
          {hasTerrainNote ? (
            <View className="mx-5 mt-4 p-4 rounded-[14px] border-2"
              style={{ backgroundColor: 'rgba(200, 120, 20, 0.12)', borderColor: 'rgba(200, 120, 20, 0.30)' }}
            >
              <Text className="text-sm tracking-widest font-bold mb-1.5"
                style={{ color: '#c87814' }}
              >
                ⛰️ TERRAIN
              </Text>
              <Text className="text-[17px] leading-7 text-cream">{hole.terrain_note}</Text>
            </View>
          ) : null}

          {/* Danger */}
          <View className="mx-5 mt-4 p-4 rounded-[14px] bg-danger/[0.12] border-2 border-danger/20">
            <Text className="text-sm text-danger tracking-widest font-bold mb-1.5">
              ⚠️ DANGER
            </Text>
            <Text className="text-[17px] leading-7 text-cream">{hole.danger}</Text>
          </View>

          {/* Caddie Note — collapsible */}
          <View className="mx-5 mt-4">
            <Pressable onPress={() => setNoteOpen((prev) => !prev)} className="flex-row items-center mt-3 mb-1">
              <Text className="text-[13px] tracking-[2px] uppercase text-gold font-bold flex-1">
                Caddie Note
              </Text>
              <Text className="text-gold text-[13px]">{noteOpen ? '▲' : '▼'}</Text>
            </Pressable>
            {!noteOpen && note ? (
              <Text className="text-[13px] text-cream-dim italic" numberOfLines={1}>{note}</Text>
            ) : null}
            {noteOpen && (
              <TextInput
                className="bg-black/30 border border-gold/20 rounded-xl px-3 py-3 text-cream text-sm mt-1"
                placeholder="e.g. Valley at 185 plays 20y longer. Green firm, back pin is dead."
                placeholderTextColor="#b8a88855"
                multiline
                numberOfLines={3}
                value={note ?? ''}
                onChangeText={onNote}
                onBlur={() => {}}
                style={{ minHeight: 72, textAlignVertical: 'top' }}
                accessibilityLabel="Caddie note"
              />
            )}
          </View>

          {/* Miss Buttons */}
          <View className="p-5">
            <SectionLabel>If You Miss...</SectionLabel>
            <View className="flex-row gap-2.5">
              {([
                { key: 'left' as const, label: '⬅️ Hook', color: '#e05545' },
                { key: 'right' as const, label: '➡️ Slice', color: '#a08030' },
                { key: 'short' as const, label: '⬇️ Chunk', color: '#888' },
              ]).map((m) => (
                <Pressable
                  key={m.key}
                  onPress={() => toggleMiss(m.key)}
                  className={`flex-1 py-3.5 rounded-xl border-2 items-center ${
                    activeMiss === m.key
                      ? 'border-gold/30'
                      : 'border-gold/15 bg-black/30'
                  }`}
                  style={
                    activeMiss === m.key
                      ? { borderColor: m.color, backgroundColor: m.color + '20' }
                      : undefined
                  }
                >
                  <Text
                    className={`text-[15px] font-semibold ${
                      activeMiss === m.key ? 'text-white' : 'text-cream-dim'
                    }`}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {activeMiss && (
              <View className="mt-3.5 p-4 bg-black/35 rounded-xl border border-gold/12">
                <Text className="text-[17px] leading-7 text-cream">{missText}</Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* Show Strategy button — competition mode only, when not yet revealed */}
      {isCompetitionMode && !competitionRevealed && (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setCompetitionRevealed(true);
          }}
          className="mx-5 my-3 py-3 rounded-xl border-2 border-gold/30 items-center bg-black/20"
        >
          <Text className="text-sm text-gold font-semibold">Show Strategy</Text>
          <Text className="text-[13px] text-cream-dim mt-0.5">May affect Rule 4.3 compliance</Text>
        </Pressable>
      )}

      {/* Score Entry */}
      <View className="px-6 py-5 border-t border-gold/8 bg-black/20">
        <SectionLabel>Record Score</SectionLabel>
        <View className="flex-row gap-2 justify-center flex-wrap">
          {[-2, -1, 0, 1, 2, 3, 4]
            .filter((d) => hole.par + d >= 1)
            .map((d) => {
              const value = hole.par + d;
              const active = score === value;
              const color = scoreColor(d);
              return (
                <Pressable
                  key={d}
                  onPress={() => handleScore(value)}
                  className={`min-w-[52px] py-2.5 px-3.5 rounded-[10px] items-center border-2 ${
                    active ? '' : 'border-gold/15 bg-black/30'
                  }`}
                  style={
                    active
                      ? { borderColor: color, backgroundColor: color + '30' }
                      : undefined
                  }
                >
                  <Text
                    className={`text-[22px] font-bold ${active ? 'text-white' : 'text-cream-dim'}`}
                  >
                    {value}
                  </Text>
                  <Text
                    className={`text-[12px] mt-0.5 font-medium ${active ? 'text-white' : 'text-cream-dim'}`}
                  >
                    {scoreLabel(d)}
                  </Text>
                </Pressable>
              );
            })}
        </View>
      </View>

      {/* Trust Loop — Quick Feedback After Score Entry */}
      {showTrustLoop && score !== null && (
        <View className="px-6 py-5 border-t border-gold/8 bg-black/20">
          <TrustLoop
            hole={hole.hole_number}
            par={hole.par}
            score={score}
            onSubmit={(data) => {
              onTrustFeedback?.(data);
              setShowTrustLoop(false);
            }}
            onSkip={() => setShowTrustLoop(false)}
          />
        </View>
      )}
    </Card>
  );
}
