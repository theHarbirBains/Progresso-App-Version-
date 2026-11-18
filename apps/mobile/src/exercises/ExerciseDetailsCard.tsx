import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { TextButton } from '../design/Button';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import { useBuiltinExtras } from './builtinExtras';
import { changeOwnPhoto } from './ownPhotoActions';
import { canKeepOwnPhotos, useOwnPhoto } from './ownPhotos';
import { ExerciseGuideSheet } from './ExerciseGuideSheet';
import { ExercisePhoto } from './ExercisePhoto';
import { hasIllustration } from './illustrations/exerciseArt';
import { fetchExerciseDetails, type ExerciseDetails } from './exerciseQueries';
import { machineLine } from './machineDetails';
import { sidesLabel } from './movementTypes';
import { MUSCLE_GROUP_LABELS } from './muscleGroups';

/**
 * An exercise's muscle, movement, photo, gym and handle, read as its page opens -- called at the
 * top of the page, so it's read alongside the page's own figures. Null until it's read, or when
 * it can't be: the page is whole without it.
 */
export function useExerciseDetails(exerciseId: string): ExerciseDetails | null {
  const userId = useAuth().user?.id ?? '';
  const [read, setRead] = useState<{ exerciseId: string; details: ExerciseDetails | null } | null>(
    null,
  );

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchExerciseDetails(userId, exerciseId)
      .then((details) => {
        if (!cancelled) setRead({ exerciseId, details });
      })
      .catch(() => {
        // Only what tells this machine apart is missing; the page's own figures still show.
        if (!cancelled) setRead({ exerciseId, details: null });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, exerciseId]);

  return read?.exerciseId === exerciseId ? read.details : null;
}

/**
 * The top of an exercise's own pages, as its row in the Exercise Library shows it: its photo
 * (tap to see it full size; its first letter when it has none) and "Muscle · Movement · Gym ·
 * Handle", so it's clear which machine the figures below are for. A built-in shows its
 * illustrated instructor instead, with How to Do It under the line. Nothing until it's read.
 */
export function ExerciseDetailsCard({
  details,
  exerciseName,
  testID,
  exerciseId,
}: {
  details: ExerciseDetails | null;
  exerciseName: string;
  testID: string;
  /** The exercise itself, for a built-in's illustration and guide. */
  exerciseId?: string;
}) {
  const extras = useBuiltinExtras(exerciseId);
  const own = useOwnPhoto(exerciseId);
  const [guideOpen, setGuideOpen] = useState(false);
  if (!details) return null;
  // A drawn built-in: its guide is always here, even once a photo of your own replaces the drawing.
  const guided = !!exerciseId && !details.photoUrl && hasIllustration(extras?.slug);
  const builtin = !!exerciseId && !!extras;
  const line = machineLine(
    details,
    MUSCLE_GROUP_LABELS[details.muscleGroup],
    sidesLabel(details.movementType),
  );
  return (
    <AppCard testID={testID}>
      <View style={styles.row}>
        <ExercisePhoto
          testID={`${testID}-photo`}
          uri={details.photoUrl}
          name={exerciseName}
          size={56}
          exerciseId={exerciseId}
          slug={extras?.slug}
        />
        <View style={styles.flex}>
          <Text testID={`${testID}-line`} style={styles.line} numberOfLines={2}>
            {line}
          </Text>
          <View style={styles.actions}>
            {guided ? (
              <TextButton
                testID={`${testID}-how-to`}
                label="How to Do It"
                onPress={() => setGuideOpen(true)}
              />
            ) : null}
            {builtin && exerciseId && canKeepOwnPhotos() ? (
              <TextButton
                testID={`${testID}-photo-action`}
                label={own ? 'Change Photo' : 'Add Your Machine Photo'}
                onPress={() => changeOwnPhoto({ exerciseId, hasPhoto: !!own })}
              />
            ) : null}
          </View>
        </View>
      </View>
      {guided && exerciseId ? (
        <ExerciseGuideSheet
          testID={`${testID}-guide`}
          visible={guideOpen}
          onClose={() => setGuideOpen(false)}
          exerciseId={exerciseId}
          exerciseName={exerciseName}
        />
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
  line: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.lg,
  },
});
