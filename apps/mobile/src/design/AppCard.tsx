import type { ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from './theme';

interface Props {
  children: ReactNode;
  /** Reserved for the single most important card on a screen (e.g. Dashboard's Recent Workout). */
  hero?: boolean;
  onPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function AppCard({ children, hero, onPress, testID, style }: Props) {
  const cardStyle = [styles.card, hero && styles.hero, style];

  if (onPress) {
    return (
      <TouchableOpacity testID={testID} style={cardStyle} onPress={onPress} activeOpacity={0.8}>
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View testID={testID} style={cardStyle}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  hero: {
    backgroundColor: colors.surfaceHero,
    borderColor: colors.borderHero,
  },
});
