import { StyleSheet, View } from 'react-native';
import { Avatar } from '../design/Avatar';
import { colors, typeScale } from '../design/theme';

interface Props {
  /** The machine/equipment photo, or null/undefined for most exercises (see exercises.photo_url). */
  uri?: string | null;
  /** The exercise's own name, for the initial-letter fallback. */
  name: string;
  size?: number;
  testID?: string;
}

// An exercise's optional machine photo, shown "like a contact photo" -- a
// circle with the real picture when one exists, otherwise the exercise
// name's first letter (Avatar's own existing fallback, reused as-is: the
// exact same "photo, else initial" convention already used for a person's
// profile picture elsewhere in this app).
export function ExercisePhoto({ uri, name, size = 44, testID }: Props) {
  const frame = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View testID={testID} style={[styles.frame, frame]}>
      <Avatar
        testID={testID ? `${testID}-inner` : undefined}
        uri={uri}
        initial={name.trim().charAt(0).toUpperCase() || null}
        size={size}
        iconSize={Math.round(size * 0.5)}
        iconColor={colors.textSecondary}
        initialStyle={[styles.initial, { fontSize: Math.round(size * 0.4) }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  initial: {
    ...typeScale.cardTitle,
    color: colors.textSecondary,
  },
});
