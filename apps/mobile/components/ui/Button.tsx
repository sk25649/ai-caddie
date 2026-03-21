import { Pressable, Text, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
}: ButtonProps) {
  const baseClasses = 'rounded-xl py-4 px-6 items-center justify-center flex-row';
  const variantClasses = {
    primary: 'bg-gold',
    secondary: 'bg-green-card border-2 border-gold/20',
    danger: 'bg-danger/20 border-2 border-danger/30',
  };
  const textClasses = {
    primary: 'text-green-deep',
    secondary: 'text-gold',
    danger: 'text-danger',
  };

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${disabled ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#0a1a0a' : '#d4a843'}
          size="small"
        />
      ) : (
        <Text
          className={`text-base font-bold ${textClasses[variant]}`}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}
