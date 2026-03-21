import { Text } from 'react-native';

interface SectionLabelProps {
  children: string;
  className?: string;
}

export function SectionLabel({ children, className = '' }: SectionLabelProps) {
  return (
    <Text
      className={`text-[13px] tracking-[2px] uppercase text-gold font-bold mb-3 ${className}`}
    >
      {children}
    </Text>
  );
}
