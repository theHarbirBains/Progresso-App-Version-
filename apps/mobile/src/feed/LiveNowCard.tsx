import { ListRow } from '../design/ListRow';
import { Card } from '../design/Card';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';

interface Props {
  testID: string;
  /** What is live: the workout's name, the group's name, or the client's name. */
  title: string;
  /** What kind of workout it is, in plain words. */
  subtitle: string;
  onPress: () => void;
}

/**
 * A workout that is open right now, on the dashboard. One flat card, the same as every
 * other card on the Feed: a quiet "Live now" label, the name, what it is, and a chevron
 * that resumes it. There is only ever one live workout, so these never stack up.
 */
export function LiveNowCard({ testID, title, subtitle, onPress }: Props) {
  return (
    <Card testID={testID} accessibilityLabel={`${title}. Live now. Resume`}>
      <Text style={styles.label}>Live now</Text>
      <ListRow title={title} subtitle={subtitle} chevron onPress={onPress} />
    </Card>
  );
}

const styles = {
  label: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
};
