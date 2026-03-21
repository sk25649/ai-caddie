import { View, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <View
      className={`bg-green-card border border-gold/20 rounded-2xl overflow-hidden ${className}`}
      style={{ borderCurve: 'continuous' }}
      {...props}
    >
      {children}
    </View>
  );
}
