import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import { ExercisePhoto } from './ExercisePhoto';
import { fetchExerciseDetails, type ExerciseDetails } from './exerciseQueries';
import { machineLine } from './machineDetails';
import { MOVEMENT_TYPE_LABELS } from './movementTypes';
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
 * Handle", so it's clear which machine the figures below are for. Nothing until it's read.
 */
export function ExerciseDetailsCard({
  details,
  exerciseName,
  testID,
}: {
  details: ExerciseDetails | null;
  exerciseName: string;
  testID: string;
}) {
  if (!details) return null;
  const line = machineLine(
    details,
    MUSCLE_GROUP_LABELS[details.muscleGroup],
    MOVEMENT_TYPE_LABELS[details.movementType],
  );
  return (
    <AppCard testID={testID}>
      <View style={styles.row}>
        <ExercisePhoto
          testID={`${testID}-photo`}
          uri={details.photoUrl}
          name={exerciseName}
          size={56}
        />
        <Text testID={`${testID}-line`} style={styles.line} numberOfLines={2}>
          {line}
        </Text>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  line: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    flex: 1,
  },
});
