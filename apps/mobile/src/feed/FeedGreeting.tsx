import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import { useAppTheme } from '../theme/appThemeContext';
import { feedStyles as styles } from '../screens/feedStyles';
import { firstName, greetingFor } from './greeting';

/**
 * The top of Feed: a greeting for the time of day, with the person's first name, and a short
 * push under it (feed/greeting.ts) -- festive through the holidays, with Holiday Decorations on,
 * and a small star in the accent beside it. Plain text on the background, not a card, in
 * `textPrimary`. Anything given as `aside` (the Daily Steps widget) sits to its right, the words
 * taking the rest of the row.
 */
export function FeedGreeting({
  displayName,
  aside,
  now = new Date(),
}: {
  displayName: string | null;
  /** Beside the greeting, on its right. */
  aside?: ReactNode;
  /** The moment to greet, for tests; otherwise now. */
  now?: Date;
}) {
  const { decorating, accent } = useAppTheme();
  const { headline, line, festive } = greetingFor(now, firstName(displayName), decorating);
  return (
    <View testID="feed-greeting" style={[styles.greeting, aside ? styles.greetingRow : null]}>
      <View style={styles.greetingWords}>
        <View style={styles.greetingHeadlineRow}>
          <Text
            testID="feed-greeting-headline"
            accessibilityRole="header"
            style={[styles.greetingHeadline, { color: colors.textPrimary }]}
          >
            {headline}
          </Text>
          {festive ? (
            <Feather
              testID="feed-greeting-star"
              name="star"
              size={18}
              color={accent.accent}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ) : null}
        </View>
        <Text style={[styles.greetingLine, { color: colors.textPrimary }]}>{line}</Text>
      </View>
      {aside}
    </View>
  );
}
