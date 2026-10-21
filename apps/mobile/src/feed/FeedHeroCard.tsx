import { View } from 'react-native';
import { PrimaryButton } from '../design/Button';
import { Card } from '../design/Card';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import { feedStyles as styles } from '../screens/feedStyles';

interface Props {
  testID: string;
  /** The small heading over the title: "Next Workout", "Workout in Progress". */
  eyebrow: string;
  title: string;
  /** The muscles worked, under the title, when there are any. */
  muscles?: string | null;
  /** One line under that: "Up next after Pull", "Your workout · started 6:42 PM". */
  meta: string;
  /** The button's label: "Start Workout", "Resume Workout". */
  actionLabel: string;
  onPress: () => void;
  accessibilityLabel: string;
}

/**
 * Feed's one hero: not a widget -- no fill of its own, over the brightened sunset photo -- with
 * a small heading, the workout's name, a line or two about it and a warm-cream button. The
 * whole card is the one tap target; the button is shown for the eye with its own touches off.
 * It is the next workout to start, or, while one is going, that one to resume.
 */
export function FeedHeroCard({
  testID,
  eyebrow,
  title,
  muscles,
  meta,
  actionLabel,
  onPress,
  accessibilityLabel,
}: Props) {
  return (
    <Card hero testID={testID} onPress={onPress} accessibilityLabel={accessibilityLabel}>
      <Text style={[styles.nextWorkoutEyebrow, { color: colors.textPrimary }]}>{eyebrow}</Text>
      <Text style={[styles.nextWorkoutDayName, { color: colors.textPrimary }]}>{title}</Text>
      {muscles ? (
        <Text style={[styles.nextWorkoutMuscles, { color: colors.textPrimary }]}>{muscles}</Text>
      ) : null}
      <Text style={[styles.nextWorkoutMeta, { color: colors.textPrimary }]}>{meta}</Text>
      {/* A solid warm-cream pill with dark text, so it reads as a real button against the
          photo rather than disappearing into it. */}
      <View
        style={styles.nextWorkoutAction}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <PrimaryButton
          label={actionLabel}
          onPress={() => undefined}
          accentColor={colors.heroAction}
          onAccentColor={colors.onAccent}
        />
      </View>
    </Card>
  );
}
