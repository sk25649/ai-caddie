import { View, Text, Pressable } from 'react-native';
import { useState } from 'react';

export interface TrustLoopData {
  hole: number;
  followedPlan: 'yes' | 'no' | 'partial';
  usefulAdvice: 'yes' | 'no' | 'neutral';
  actualResult: 'birdie' | 'par' | 'bogey' | 'double' | 'other';
  missDirection?: 'left' | 'right' | 'short' | 'long';
  notes?: string;
}

interface TrustLoopProps {
  hole: number;
  par: number;
  score: number;
  onSubmit: (data: TrustLoopData) => void;
  onSkip: () => void;
}

/**
 * Trust loop: Quick feedback capture after each hole.
 * Appears after player enters their score.
 * Collects: followed plan? useful? what actually happened?
 */
export function TrustLoop({
  hole,
  par,
  score,
  onSubmit,
  onSkip,
}: TrustLoopProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [followedPlan, setFollowedPlan] = useState<'yes' | 'no' | 'partial' | null>(null);
  const [usefulAdvice, setUsefulAdvice] = useState<'yes' | 'no' | 'neutral' | null>(null);
  const [actualResult, setActualResult] = useState<TrustLoopData['actualResult'] | null>(null);
  const [missDirection, setMissDirection] = useState<TrustLoopData['missDirection'] | null>(null);

  const scoreDiff = score - par;
  const resultLabel =
    scoreDiff < 0 ? 'Birdie' : scoreDiff === 0 ? 'Par' : scoreDiff === 1 ? 'Bogey' : 'Double+';

  const handleSubmit = () => {
    if (!followedPlan || !usefulAdvice || !actualResult) return;

    onSubmit({
      hole,
      followedPlan,
      usefulAdvice,
      actualResult,
      missDirection: missDirection || undefined,
      notes: undefined,
    });
  };

  if (step === 1) {
    return (
      <View className="bg-green-card border border-gold/30 rounded-lg p-5 mb-4">
        <Text className="text-xs tracking-[2px] uppercase text-gold font-bold mb-4">
          Quick Feedback
        </Text>
        <Text className="text-sm text-cream mb-4">
          Did you follow the caddie's strategy on this hole?
        </Text>
        <View className="gap-2">
          <Pressable
            onPress={() => {
              setFollowedPlan('yes');
              setStep(2);
            }}
            className="bg-par-green/20 border border-par-green/40 rounded-lg py-3 px-4"
          >
            <Text className="text-par-green font-semibold text-center">Yes, I did</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setFollowedPlan('partial');
              setStep(2);
            }}
            className="bg-yellow-600/20 border border-yellow-600/40 rounded-lg py-3 px-4"
          >
            <Text className="text-yellow-300 font-semibold text-center">Partially</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setFollowedPlan('no');
              setStep(2);
            }}
            className="bg-danger/20 border border-danger/40 rounded-lg py-3 px-4"
          >
            <Text className="text-danger font-semibold text-center">No, I didn't</Text>
          </Pressable>
        </View>
        <Pressable onPress={onSkip} className="mt-3">
          <Text className="text-cream-dim text-xs text-center">Skip</Text>
        </Pressable>
      </View>
    );
  }

  if (step === 2) {
    return (
      <View className="bg-green-card border border-gold/30 rounded-lg p-5 mb-4">
        <Text className="text-xs tracking-[2px] uppercase text-gold font-bold mb-4">
          Quick Feedback
        </Text>
        <Text className="text-sm text-cream mb-4">
          Was the caddie's advice useful?
        </Text>
        <View className="gap-2">
          <Pressable
            onPress={() => {
              setUsefulAdvice('yes');
              setActualResult(
                scoreDiff < 0 ? 'birdie' : scoreDiff === 0 ? 'par' : scoreDiff === 1 ? 'bogey' : 'double'
              );
              setStep(3);
            }}
            className="bg-par-green/20 border border-par-green/40 rounded-lg py-3 px-4"
          >
            <Text className="text-par-green font-semibold text-center">Yes, very</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setUsefulAdvice('neutral');
              setActualResult(
                scoreDiff < 0 ? 'birdie' : scoreDiff === 0 ? 'par' : scoreDiff === 1 ? 'bogey' : 'double'
              );
              setStep(3);
            }}
            className="bg-cream/20 border border-cream/40 rounded-lg py-3 px-4"
          >
            <Text className="text-cream font-semibold text-center">Neutral</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setUsefulAdvice('no');
              setActualResult(
                scoreDiff < 0 ? 'birdie' : scoreDiff === 0 ? 'par' : scoreDiff === 1 ? 'bogey' : 'double'
              );
              setStep(3);
            }}
            className="bg-danger/20 border border-danger/40 rounded-lg py-3 px-4"
          >
            <Text className="text-danger font-semibold text-center">Not really</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => setStep(1)} className="mt-3">
          <Text className="text-cream-dim text-xs text-center">Back</Text>
        </Pressable>
      </View>
    );
  }

  // Step 3: Confirm result + miss direction if applicable
  return (
    <View className="bg-green-card border border-gold/30 rounded-lg p-5 mb-4">
      <Text className="text-xs tracking-[2px] uppercase text-gold font-bold mb-4">
        Quick Feedback
      </Text>
      
      {/* Confirm result */}
      <Text className="text-sm text-cream mb-3">
        You made:
      </Text>
      <View className="bg-gold/10 border border-gold/20 rounded-lg p-3 mb-4 flex-row justify-between items-center">
        <Text className="text-cream-dim text-sm">Hole {hole}, Par {par}</Text>
        <Text className="text-2xl font-bold text-gold" style={{ fontFamily: 'serif' }}>
          {score}
        </Text>
      </View>

      {/* Miss direction (if not par/birdie) */}
      {score > par && (
        <View className="mb-4">
          <Text className="text-sm text-cream mb-2">Where did you miss?</Text>
          <View className="gap-2">
            {['left', 'right', 'short', 'long'].map((dir) => (
              <Pressable
                key={dir}
                onPress={() => setMissDirection(dir as TrustLoopData['missDirection'])}
                className={`py-2 px-3 rounded-lg border ${
                  missDirection === dir
                    ? 'bg-gold/20 border-gold'
                    : 'bg-gold/5 border-gold/10'
                }`}
              >
                <Text
                  className={`text-center font-semibold capitalize ${
                    missDirection === dir ? 'text-gold' : 'text-cream-dim'
                  }`}
                >
                  {dir}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Submit */}
      <View className="gap-2 mt-4">
        <Pressable
          onPress={handleSubmit}
          className="bg-gold/20 border border-gold/40 rounded-lg py-3 px-4"
        >
          <Text className="text-gold font-bold text-center">Save Feedback</Text>
        </Pressable>
        <Pressable onPress={() => setStep(2)} className="py-2">
          <Text className="text-cream-dim text-xs text-center">Back</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Hook to manage trust loop state across holes.
 * Stores all feedback for the round.
 */
export function useTrustLoop() {
  const [feedback, setFeedback] = useState<TrustLoopData[]>([]);

  const addFeedback = (data: TrustLoopData) => {
    setFeedback((prev) => {
      // Remove any existing feedback for this hole, then add new one
      return [...prev.filter((f) => f.hole !== data.hole), data];
    });
  };

  const getFeedback = (hole: number) => feedback.find((f) => f.hole === hole);

  const getAllFeedback = () => feedback;

  return { feedback, addFeedback, getFeedback, getAllFeedback };
}
