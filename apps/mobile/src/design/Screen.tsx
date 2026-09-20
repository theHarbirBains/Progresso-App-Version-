import type { ReactElement, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from './theme';

interface Props {
  children: ReactNode;
  /** Usually an `<AppHeader />`. AppHeader pads for the top safe area itself, so when a header is given this frame adds no top inset of its own. */
  header?: ReactNode;
  /** Default true: the body scrolls. false renders a plain View -- for a screen that manages its own scrolling (a FlatList) or has none. */
  scroll?: boolean;
  /** Default false. Wraps the body so the on-screen keyboard pushes content up instead of covering an input. */
  keyboardAvoiding?: boolean;
  /** Default true: the standard horizontal screen padding (`spacing.xxl`). Set false for edge-to-edge content such as a full-bleed list. */
  padded?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshControl?: ReactElement<RefreshControlProps>;
  testID?: string;
  /** testID for the scrolling body itself (when scroll is true), for tests/automation that address the scroll view. */
  scrollTestID?: string;
}

// The one screen frame. Every screen that isn't a special case (Dashboard's
// photo-backed stack, the camera scanner) should compose from this instead of
// hand-rolling its own safe-area/scroll/keyboard handling -- that duplication
// is why headers and top padding drift between screens today.
//
// What it deliberately does NOT do:
//   - Paint a background. The root is transparent so AppBackgroundLayer
//     (mounted once behind the navigator) shows through; a screen never sets
//     its own background colour.
//   - Reserve space for the bottom navigation. BottomNavBar is an in-flow
//     sibling of the navigator (see App.tsx), so the navigator's content area
//     already ends above it.
export function Screen({
  children,
  header,
  scroll = true,
  keyboardAvoiding = false,
  padded = true,
  contentContainerStyle,
  refreshControl,
  testID,
  scrollTestID,
}: Props) {
  const insets = useSafeAreaInsets();
  const topInset = header ? 0 : insets.top + spacing.lg;
  const horizontal = padded ? styles.padded : null;

  const body = scroll ? (
    <ScrollView
      testID={scrollTestID}
      style={styles.flex}
      contentContainerStyle={[horizontal, styles.scrollContent, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, horizontal, contentContainerStyle]}>{children}</View>
  );

  const framed = keyboardAvoiding ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {body}
    </KeyboardAvoidingView>
  ) : (
    body
  );

  return (
    <View testID={testID} style={[styles.root, { paddingTop: topInset }]}>
      {header}
      {framed}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Transparent on purpose -- see the component comment.
    backgroundColor: 'transparent',
  },
  flex: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: spacing.xxl,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
});
