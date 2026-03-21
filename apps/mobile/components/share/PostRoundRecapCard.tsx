import { View, Text, Image, Pressable } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

interface PostRoundRecapCardProps {
  playerName?: string;
  courseName: string;
  score: number;
  par: number;
  handicap?: string;
  keyLessons: string[];
  bestHole?: number;
  worstHole?: number;
  parConversion?: number;
  onShare?: () => void;
}

/**
 * Screenshot-friendly post-round recap card.
 * Designed for social media sharing (Instagram, Twitter, etc.)
 * 1080x1920px portrait format (Instagram story size)
 */
export function PostRoundRecapCard({
  playerName,
  courseName,
  score,
  par,
  handicap,
  keyLessons,
  bestHole,
  worstHole,
  parConversion,
  onShare,
}: PostRoundRecapCardProps) {
  const overPar = score - par;
  const scoreColor = score < par ? '#22c55e' : score === par ? '#fbbf24' : '#ef4444';

  return (
    <View className="bg-green-deep p-8 items-center justify-center" style={{ minHeight: 800 }}>
      {/* Header */}
      <Text className="text-sm tracking-[4px] uppercase text-gold font-bold mb-2">
        AI Caddie
      </Text>

      {/* Main Score */}
      <Text
        className="text-9xl font-bold mb-2"
        style={{ color: scoreColor, fontFamily: 'serif' }}
      >
        {score}
      </Text>

      {/* Over/Under Par */}
      <Text className="text-2xl text-cream-dim mb-6">
        {overPar > 0 ? '+' : ''}{overPar} · {courseName}
      </Text>

      {/* Player Info */}
      {playerName && (
        <Text className="text-lg text-cream mb-6">
          {playerName} {handicap ? `(HCP ${handicap})` : ''}
        </Text>
      )}

      {/* Key Metrics */}
      {parConversion !== undefined && (
        <View className="flex-row gap-6 mb-8 bg-gold/10 rounded-lg px-6 py-4 w-full">
          <View className="flex-1 items-center">
            <Text className="text-xs text-cream-dim mb-1">Par Conv.</Text>
            <Text className="text-2xl text-gold font-bold">{parConversion}%</Text>
          </View>
          {bestHole !== undefined && (
            <View className="flex-1 items-center">
              <Text className="text-xs text-cream-dim mb-1">Best</Text>
              <Text className="text-2xl text-par-green font-bold">#{bestHole}</Text>
            </View>
          )}
          {worstHole !== undefined && (
            <View className="flex-1 items-center">
              <Text className="text-xs text-cream-dim mb-1">Learn</Text>
              <Text className="text-2xl text-danger font-bold">#{worstHole}</Text>
            </View>
          )}
        </View>
      )}

      {/* Key Lessons */}
      {keyLessons.length > 0 && (
        <View className="w-full mb-8">
          <Text className="text-xs tracking-[2px] uppercase text-gold font-bold mb-3">
            3 Key Lessons
          </Text>
          {keyLessons.map((lesson, idx) => (
            <View key={idx} className="mb-2 flex-row gap-3">
              <Text className="text-lg text-gold font-bold">{idx + 1}.</Text>
              <Text className="flex-1 text-base text-cream leading-5">{lesson}</Text>
            </View>
          ))}
        </View>
      )}

      {/* CTA */}
      <View className="w-full mt-8 pt-6 border-t border-gold/20">
        <Text className="text-center text-sm text-cream-dim mb-3">
          Get your personalized AI caddie.
        </Text>
        <Text className="text-center text-lg font-bold text-gold">
          AI Caddie — Break 90
        </Text>
      </View>
    </View>
  );
}

export async function sharePostRoundCard(
  cardHtml: string,
  courseName: string,
  score: number
) {
  try {
    const fileName = `AI-Caddie-${score}-at-${courseName.replace(/\s+/g, '-')}.png`;

    // Convert HTML to image via print-to-file
    const { uri } = await Print.printToFileAsync({
      html: cardHtml,
      width: 1080,
      height: 1920,
    });

    // Share the image
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: `Shot ${score} at ${courseName}`,
      UTI: 'public.png',
    });
  } catch (error) {
    console.error('Error sharing card:', error);
    throw error;
  }
}
