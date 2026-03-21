import { Text } from 'react-native';

interface SectionLabelProps {
  children: string;
  className?: string;
}

export function SectionLabel({ children, className = '' }: SectionLabelProps) {
  return (
    <Text
      className={`text-xs tracking-[3px] uppercase text-gold font-bold mb-3 ${className}`}
    >
      {children}
    </Text>
  );
}
