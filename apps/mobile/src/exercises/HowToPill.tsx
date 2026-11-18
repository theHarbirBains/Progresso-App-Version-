import { useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../design/Text';
import { radii, spacing, typeScale } from '../design/theme';
import { withAlpha } from '../theme/accentColor';
import { useBuiltinExtras } from './builtinExtras';
import { ExerciseGuideSheet } from './ExerciseGuideSheet';
import { hasIllustration } from './illustrations/exerciseArt';

/**
 * A small pill in the accent under a built-in exercise's name -- "How to Do It" -- so it's plain
 * that its guide (how it's done, then its technique and setup) is one tap away. Nothing for a
 * person's own exercise, or a built-in without a drawing.
 */
export function HowToPill({
  exerciseId,
  name,
  accentColor,
  testID,
}: {
  exerciseId: string | null | undefined;
  name: string;
  accentColor: string;
  testID?: string;
}) {
  const extras = useBuiltinExtras(exerciseId);
  const [open, setOpen] = useState(false);
  // Made the first time it's opened, then kept, so it can slide away.
  const [made, setMade] = useState(false);
  if (!exerciseId || !hasIllustration(extras?.slug)) return null;
  return (
    <>
      <TouchableOpacity
        testID={testID}
        onPress={() => {
          setMade(true);
          setOpen(true);
        }}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`How to do ${name}, and its technique and setup`}
        style={[
          styles.pill,
          {
            backgroundColor: withAlpha(accentColor, 0.12),
            borderColor: withAlpha(accentColor, 0.4),
          },
        ]}
      >
        <Feather name="play-circle" size={12} color={accentColor} />
        <Text style={[styles.label, { color: accentColor }]}>How to Do It</Text>
        <Feather name="chevron-right" size={12} color={accentColor} />
      </TouchableOpacity>
      {made ? (
        <ExerciseGuideSheet
          testID={testID ? `${testID}-sheet` : undefined}
          visible={open}
          onClose={() => setOpen(false)}
          exerciseId={exerciseId}
          exerciseName={name}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    ...typeScale.caption,
  },
});
