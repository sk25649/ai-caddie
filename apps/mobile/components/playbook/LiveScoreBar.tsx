import { View, Text } from 'react-native';
import type { HoleStrategy } from '../../lib/api';

interface LiveScoreBarProps {
  holes: HoleStrategy[];
  scores: (number | null)[];
}

export function LiveScoreBar({ holes, scores }: LiveScoreBarProps) {
  const holesPlayed = scores.filter((s) => s !== null).length;
  if (holesPlayed === 0) return null;

  const currentTotal = scores.reduce((sum, v) => sum + (v || 0), 0);
  const overPar = scores.reduce(
    (sum, v, i) => (v === null ? sum : sum + (v - holes[i].par)),
    0
  );
  const projected =
    currentTotal +
    holes
      .filter((_, i) => scores[i] === null)
      .reduce((sum, h) => sum + h.par + 1, 0);

  const bgColor =
    overPar <= 14
      ? 'bg-par-green/10'
      : overPar <= 18
        ? 'bg-gold/[0.08]'
        : 'bg-danger/[0.12]';

  const projectedColor =
    projected <= 85
      ? 'text-par-green'
      : projected <= 89
        ? 'text-gold'
        : projected <= 99
          ? 'text-cream-dim'
          : 'text-danger';

  return (
    <View className={`py-3.5 px-5 ${bgColor} border-b border-gold/10 items-center`}>
      <View className="flex-row items-baseline">
        <Text className="text-[15px] text-cream-dim">Thru {holesPlayed}: </Text>
        <Text className="text-[26px] text-gold" style={{ fontFamily: 'serif' }}>
          {currentTotal}
        </Text>
        <Text className="text-[15px] text-cream-dim">
          {' '}
          ({overPar > 0 ? '+' : ''}
          {overPar}) · Pace:{' '}
        </Text>
        <Text className={`text-xl ${projectedColor}`} style={{ fontFamily: 'serif' }}>
          {projected}
        </Text>
      </View>
    </View>
  );
}
