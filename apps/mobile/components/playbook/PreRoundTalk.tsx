import { View, Text, Pressable } from 'react-native';
import { useState } from 'react';
import * as Haptics from 'expo-haptics';

interface PreRoundTalkProps {
  content: string;
}

export function PreRoundTalk({ content }: PreRoundTalkProps) {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    Haptics.selectionAsync();
    setExpanded(!expanded);
  };

  return (
    <View className="px-4 pb-5">
      <Pressable
        onPress={toggle}
        className="bg-green-card border border-gold/20 rounded-[14px] px-6 py-4.5 flex-row justify-between items-center"
      >
        <Text className="text-[17px] font-semibold text-gold">
          📋 Caddie's Pre-Round Talk
        </Text>
        <Text
          className="text-[22px] text-gold"
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        >
          ▾
        </Text>
      </Pressable>
      {expanded && (
        <View className="bg-green-card border border-gold/20 border-t-0 rounded-b-[14px] p-6">
          <Text className="text-[17px] leading-7 text-cream">{content}</Text>
        </View>
      )}
    </View>
  );
}
