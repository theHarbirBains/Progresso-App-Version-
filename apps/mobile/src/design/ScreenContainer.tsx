import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from './theme';

interface Props {
  children: ReactNode;
  /** Default true. false renders a plain View -- for loading/error/centered states. */
  scroll?: boolean;
  testID?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

// Replaces every screen's hardcoded `paddingTop: 60` with the device's real
// safe-area inset (react-native-safe-area-context was already a dependency,
// just never actually used anywhere -- see the design-phase audit).
export function ScreenContainer({ children, scroll = true, testID, contentContainerStyle }: Props) {
  const insets = useSafeAreaInsets();
  const paddingTop = insets.top + spacing.lg;

  if (!scroll) {
    return (
      <View testID={testID} style={[styles.screen, { paddingTop }, contentContainerStyle]}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView testID={testID} style={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={[styles.content, { paddingTop }, contentContainerStyle]}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
});
