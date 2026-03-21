import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { HoleStrategy } from '../../lib/api';

interface HoleSelectorProps {
  holes: HoleStrategy[];
  currentHole: number;
  scores: (number | null)[];
  onSelect: (index: number) => void;
}

function scoreColor(overPar: number): string {
  if (overPar <= -1) return '#3dbd6e';
  if (overPar === 0) return '#d4a843';
  if (overPar === 1) return '#b8a888';
  if (overPar === 2) return '#e07055';
  return '#cc3333';
}

export function HoleSelector({ holes, currentHole, scores, onSelect }: HoleSelectorProps) {
  const front = holes.slice(0, 9);
  const back = holes.slice(9, 18);

  const handlePress = (index: number) => {
    Haptics.selectionAsync();
    onSelect(index);
  };

  const HoleButton = ({ hole, index }: { hole: HoleStrategy; index: number }) => {
    const scored = scores[index] !== null;
    const overPar = scored ? (scores[index]! - hole.par) : 0;
    const active = currentHole === index;
    const color = scored ? scoreColor(overPar) : undefined;

    return (
      <Pressable
        onPress={() => handlePress(index)}
        className={`w-[42px] h-[42px] rounded-[10px] items-center justify-center border-2 ${
          active
            ? 'border-gold bg-gold/20'
            : scored
              ? 'bg-black/30'
              : 'border-gold/15 bg-black/30'
        }`}
        style={
          scored && !active
            ? { borderColor: color + '66', backgroundColor: color + '18' }
            : undefined
        }
      >
        <Text
          className={`text-[17px] font-semibold ${
            active ? 'text-gold font-bold' : scored ? '' : 'text-cream-dim'
          }`}
          style={scored && !active ? { color } : undefined}
        >
          {scored ? scores[index] : hole.hole_number}
        </Text>
      </Pressable>
    );
  };

  return (
    <View className="px-4 pt-5 pb-3">
      <Text className="text-center text-xs tracking-[3px] text-cream-dim uppercase font-semibold mb-2.5">
        Front 9
      </Text>
      <View className="flex-row gap-1 justify-center flex-wrap mb-4">
        {front.map((hole, i) => (
          <HoleButton key={hole.hole_number} hole={hole} index={i} />
        ))}
      </View>
      <Text className="text-center text-xs tracking-[3px] text-cream-dim uppercase font-semibold mb-2.5">
        Back 9
      </Text>
      <View className="flex-row gap-1 justify-center flex-wrap">
        {back.map((hole, i) => (
          <HoleButton key={hole.hole_number} hole={hole} index={i + 9} />
        ))}
      </View>
    </View>
  );
}
