import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { Avatar } from '../design/Avatar';
import { SecondaryButton } from '../design/Button';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale } from '../design/theme';
import type { HiddenGroupPerson } from '../workouts/groupWorkoutHistory';

/** "Jo" from "Jo Lee", else their @username, else "They". */
function nameOf(person: HiddenGroupPerson): string {
  return (
    person.displayName?.trim().split(/\s+/)[0] || (person.username ? `@${person.username}` : 'They')
  );
}

/**
 * Someone in a friend's group workout whose workout you may not see (their profile is private
 * and you don't follow them): who they are -- their photo and name, so it's clear who trained --
 * and that their sets, weights, reps and figures are private, with a way to their profile. The
 * API never sent what they did, so there's nothing here to hide.
 */
export function HiddenWorkoutCard({
  person,
  onOpenProfile,
  testID = 'workout-detail-hidden',
}: {
  person: HiddenGroupPerson;
  onOpenProfile: () => void;
  testID?: string;
}) {
  const name = nameOf(person);
  return (
    <AppCard testID={testID}>
      <View style={styles.who}>
        <Avatar
          uri={person.avatarUrl}
          initial={name.replace('@', '').charAt(0).toUpperCase()}
          size={56}
          iconSize={24}
          iconColor={colors.textSecondary}
        />
        <View style={styles.words}>
          <Text style={styles.name} numberOfLines={1}>
            {person.displayName ?? (person.username ? `@${person.username}` : 'Someone')}
          </Text>
          <View style={styles.badge}>
            <Feather name="lock" size={12} color={colors.textSecondary} />
            <Text style={styles.badgeText}>Private Profile</Text>
          </View>
        </View>
      </View>
      <Text testID={`${testID}-line`} style={styles.line}>
        {`${name} trained in this group workout. Their sets, weights, reps and figures are private: follow them to see their workouts.`}
      </Text>
      <SecondaryButton
        testID={`${testID}-profile`}
        label="View Profile"
        size="md"
        onPress={onOpenProfile}
      />
    </AppCard>
  );
}

const styles = StyleSheet.create({
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  words: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  name: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
  },
  badgeText: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  line: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
    marginVertical: spacing.md,
  },
});
