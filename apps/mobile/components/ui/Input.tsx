import { View, Text, TextInput, type TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
}

export function Input({ label, error, ...props }: InputProps) {
  return (
    <View className="mb-4">
      <Text className="text-cream-dim text-sm font-semibold mb-2 tracking-wider uppercase">
        {label}
      </Text>
      <TextInput
        className={`bg-black/30 border-2 ${
          error ? 'border-danger/50' : 'border-gold/15'
        } rounded-xl px-4 py-3.5 text-cream text-base`}
        placeholderTextColor="#b8a88866"
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
      />
      {error && (
        <Text className="text-danger text-sm mt-1">{error}</Text>
      )}
    </View>
  );
}
