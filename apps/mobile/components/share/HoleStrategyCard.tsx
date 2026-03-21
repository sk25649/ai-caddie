import { View, Text } from 'react-native';

interface HoleStrategyCardProps {
  hole: number;
  par: number;
  yardage: number;
  courseName: string;
  aimPoint: string;
  teeClub: string;
  carryTarget: number;
  keyTips: string[];
  terrain?: string;
  danger: string;
}

/**
 * Single hole strategy card for sharing.
 * Shows the specific caddie advice for one hole.
 * 1080x1350px square format (Instagram feed).
 */
export function HoleStrategyCard({
  hole,
  par,
  yardage,
  courseName,
  aimPoint,
  teeClub,
  carryTarget,
  keyTips,
  terrain,
  danger,
}: HoleStrategyCardProps) {
  return (
    <View className="bg-green-deep p-6 items-center justify-center" style={{ minHeight: 700 }}>
      {/* Header */}
      <Text className="text-xs tracking-[4px] uppercase text-gold font-bold mb-1">
        Hole Strategy
      </Text>

      {/* Hole Number - Hero */}
      <Text className="text-8xl text-gold font-bold" style={{ fontFamily: 'serif' }}>
        {hole}
      </Text>

      {/* Hole Details */}
      <View className="flex-row gap-4 mb-6 mt-2">
        <View className="items-center">
          <Text className="text-xs text-cream-dim">Par</Text>
          <Text className="text-2xl text-gold font-bold">{par}</Text>
        </View>
        <View className="w-px bg-gold/30" />
        <View className="items-center">
          <Text className="text-xs text-cream-dim">Yards</Text>
          <Text className="text-2xl text-cream font-bold">{yardage}</Text>
        </View>
      </View>

      <Text className="text-sm text-cream-dim mb-6">{courseName}</Text>

      {/* Aim Point - Hero Section */}
      <View className="bg-gold/10 border-2 border-gold rounded-lg p-5 mb-6 w-full items-center">
        <Text className="text-xs tracking-[2px] uppercase text-gold font-bold mb-2">
          Aim Here
        </Text>
        <Text className="text-lg text-white font-bold text-center">{aimPoint}</Text>
      </View>

      {/* Tee Club & Carry */}
      <View className="flex-row gap-4 mb-6 w-full">
        <View className="flex-1 bg-gold/5 rounded-lg p-4 items-center">
          <Text className="text-xs text-cream-dim mb-1">Club</Text>
          <Text className="text-xl text-gold font-bold">{teeClub}</Text>
        </View>
        <View className="flex-1 bg-gold/5 rounded-lg p-4 items-center">
          <Text className="text-xs text-cream-dim mb-1">Carry</Text>
          <Text className="text-xl text-gold font-bold">{carryTarget}</Text>
        </View>
      </View>

      {/* Key Tips */}
      {keyTips.length > 0 && (
        <View className="mb-6 w-full">
          <Text className="text-xs tracking-[2px] uppercase text-gold font-bold mb-2">
            Do This
          </Text>
          {keyTips.map((tip, idx) => (
            <Text key={idx} className="text-sm text-cream mb-1">
              • {tip}
            </Text>
          ))}
        </View>
      )}

      {/* Terrain Warning */}
      {terrain && (
        <View className="bg-orange-500/20 border border-orange-500/40 rounded-lg p-3 mb-4 w-full">
          <Text className="text-xs text-orange-300 font-bold">⛰️ TERRAIN</Text>
          <Text className="text-xs text-orange-100 mt-1">{terrain}</Text>
        </View>
      )}

      {/* Danger */}
      <View className="bg-danger/10 border border-danger/30 rounded-lg p-3 w-full">
        <Text className="text-xs text-danger font-bold">DANGER</Text>
        <Text className="text-xs text-danger/80 mt-1">{danger}</Text>
      </View>

      {/* Footer */}
      <View className="w-full mt-6 pt-4 border-t border-gold/20 items-center">
        <Text className="text-xs text-gold font-semibold">AI Caddie</Text>
      </View>
    </View>
  );
}
