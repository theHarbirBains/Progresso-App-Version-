import { View } from 'react-native';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import { feedStyles as styles } from '../screens/feedStyles';
import { firstName, greetingFor } from './greeting';

/**
 * The top of Feed: a greeting for the time of day, with the person's first name, and a short
 * push under it (feed/greeting.ts). Plain text over the photo, not a card -- in `textPrimary`,
 * like the hero's own words over the same photo.
 */
export function FeedGreeting({
  displayName,
  now = new Date(),
}: {
  displayName: string | null;
  /** The moment to greet, for tests; otherwise now. */
  now?: Date;
}) {
  const { headline, line } = greetingFor(now, firstName(displayName));
  return (
    <View testID="feed-greeting" style={styles.greeting}>
      <Text
        testID="feed-greeting-headline"
        accessibilityRole="header"
        style={[styles.greetingHeadline, { color: colors.textPrimary }]}
      >
        {headline}
      </Text>
      <Text style={[styles.greetingLine, { color: colors.textPrimary }]}>{line}</Text>
    </View>
  );
}
