import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { HoleStrategy } from '../../lib/api';

interface HoleSelectorProps {
  holes: HoleStrategy[];
  currentHole: number;
  scores: (number | null)[];
  onSelect: (index: number) => void;
}

interface HoleButtonProps {
  hole: HoleStrategy;
  index: number;
  score: number | null;
  isActive: boolean;
  onPress: (index: number) => void;
}

function scoreColor(overPar: number): string {
  if (overPar <= -1) return '#3dbd6e';
  if (overPar === 0) return '#d4a843';
  if (overPar === 1) return '#b8a888';
  if (overPar === 2) return '#e07055';
  return '#cc3333';
}

function HoleButton({ hole, index, score, isActive, onPress }: HoleButtonProps) {
  const scored = score !== null;
  const overPar = scored ? (score! - hole.par) : 0;
  const color = scored ? scoreColor(overPar) : undefined;

  const handlePress = () => {
    Haptics.selectionAsync();
    onPress(index);
  };

  return (
    <Pressable
      onPress={handlePress}
      className={`w-[42px] h-[42px] rounded-[10px] items-center justify-center border-2 ${
        isActive
          ? 'border-gold bg-gold/20'
          : scored
            ? 'bg-black/30'
            : 'border-gold/15 bg-black/30'
      }`}
      style={
        scored && !isActive
          ? { borderColor: color + '66', backgroundColor: color + '18' }
          : undefined
      }
    >
      <Text
        className={`text-[17px] font-semibold ${
          isActive ? 'text-gold font-bold' : scored ? '' : 'text-cream-dim'
        }`}
        style={scored && !isActive ? { color } : undefined}
      >
        {scored ? score : hole.hole_number}
      </Text>
    </Pressable>
  );
}

export function HoleSelector({ holes, currentHole, scores, onSelect }: HoleSelectorProps) {
  const front = holes.slice(0, 9);
  const back = holes.slice(9, 18);

  return (
    <View className="px-4 pt-5 pb-3">
      <Text className="text-center text-xs tracking-[3px] text-cream-dim uppercase font-semibold mb-2.5">
        Front 9
      </Text>
      <View className="flex-row gap-1 justify-center flex-wrap mb-4">
        {front.map((hole, i) => (
          <HoleButton
            key={hole.hole_number}
            hole={hole}
            index={i}
            score={scores[i]}
            isActive={currentHole === i}
            onPress={onSelect}
          />
        ))}
      </View>
      {back.length > 0 && (
        <>
          <Text className="text-center text-xs tracking-[3px] text-cream-dim uppercase font-semibold mb-2.5">
            Back 9
          </Text>
          <View className="flex-row gap-1 justify-center flex-wrap">
            {back.map((hole, i) => (
              <HoleButton
                key={hole.hole_number}
                hole={hole}
                index={i + 9}
                score={scores[i + 9]}
                isActive={currentHole === i + 9}
                onPress={onSelect}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}
