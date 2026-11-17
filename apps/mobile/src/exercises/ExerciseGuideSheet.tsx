import { useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { ErrorState } from '../design/ErrorState';
import { SectionHeader } from '../design/SectionHeader';
import { SkeletonRows } from '../design/Skeleton';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale } from '../design/theme';
import { useAppTheme } from '../theme/appThemeContext';
import { EQUIPMENT_LABELS } from './equipment';
import { Image } from 'expo-image';
import { readExerciseGuide, type ExerciseGuide } from './builtinExtras';
import { ExerciseIllustration } from './illustrations/ExerciseIllustration';
import { MOVEMENT_PATTERN_LABELS } from './movementPatterns';
import { MEASUREMENT_TYPE_LABELS } from './movementTypes';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from './muscleGroups';

interface Props {
  visible: boolean;
  onClose: () => void;
  exerciseId: string;
  /** Shown while the guide is read. */
  exerciseName: string;
  testID?: string;
}

/**
 * How to do a built-in exercise, as a page of its own over whatever opened it -- an iPhone page
 * sheet, swiped down or closed with its X: the illustrated instructor from start to finish, the
 * muscles it works, then how to set up, how to do it and what to avoid. Read when it opens.
 */
export function ExerciseGuideSheet({
  visible,
  onClose,
  exerciseId,
  exerciseName,
  testID = 'exercise-guide',
}: Props) {
  const accent = useAppTheme().accent.accent;
  const [guide, setGuide] = useState<ExerciseGuide | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setError(null);
    readExerciseGuide(exerciseId)
      .then((read) => {
        if (cancelled) return;
        if (read) setGuide(read);
        else setError("This exercise's guide isn't available.");
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the guide. Check your connection and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [visible, exerciseId, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const shown = guide && guide.name ? guide : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View testID={testID} style={styles.page}>
        <AppHeader
          title="How to Do It"
          safeArea={false}
          rightAction={{
            icon: 'x',
            onPress: onClose,
            accessibilityLabel: 'Close',
            testID: `${testID}-close`,
          }}
        />
        <ScrollView contentContainerStyle={styles.content}>
          <Text testID={`${testID}-name`} style={styles.name}>
            {shown?.name ?? exerciseName}
          </Text>
          {shown ? (
            <Text testID={`${testID}-line`} style={styles.line}>
              {[
                shown.equipment ? EQUIPMENT_LABELS[shown.equipment] : null,
                shown.movementPattern ? MOVEMENT_PATTERN_LABELS[shown.movementPattern] : null,
                shown.movementType === 'unilateral' ? 'One side at a time' : null,
                MEASUREMENT_TYPE_LABELS[shown.measurementType].spoken,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null}

          {error ? (
            <ErrorState testID={`${testID}-error`} message={error} onRetry={retry} />
          ) : !shown ? (
            <SkeletonRows testID={`${testID}-loading`} count={5} />
          ) : (
            <>
              {shown.illustrationUrl ? (
                <AppCard testID={`${testID}-illustration-card`} style={styles.card}>
                  <Image
                    testID={`${testID}-illustration-image`}
                    source={{ uri: shown.illustrationUrl }}
                    style={styles.hostedImage}
                    contentFit="contain"
                    accessibilityLabel={`How ${shown.name} is done`}
                  />
                </AppCard>
              ) : shown.slug ? (
                <AppCard testID={`${testID}-illustration-card`} style={styles.card}>
                  <ExerciseIllustration slug={shown.slug} testID={`${testID}-illustration`} />
                </AppCard>
              ) : null}

              <AppCard testID={`${testID}-muscles`} style={styles.card}>
                <MuscleLine
                  label="Primary"
                  groups={[shown.muscleGroup]}
                  color={accent}
                  strong
                  testID={`${testID}-primary`}
                />
                {shown.secondaryMuscleGroups.length > 0 ? (
                  <MuscleLine
                    label="Also Works"
                    groups={shown.secondaryMuscleGroups}
                    color={colors.textSecondaryBright}
                    testID={`${testID}-secondary`}
                  />
                ) : null}
              </AppCard>

              {shown.summary ? (
                <Text testID={`${testID}-summary`} style={styles.summary}>
                  {shown.summary}
                </Text>
              ) : null}

              <Steps
                title="Starting Position"
                steps={shown.setupSteps}
                accent={accent}
                testID={`${testID}-setup`}
              />
              <Steps
                title="How to Do It"
                steps={shown.executionSteps}
                accent={accent}
                testID={`${testID}-steps`}
              />
              {shown.commonMistakes.length > 0 ? (
                <View testID={`${testID}-mistakes`} style={styles.section}>
                  <SectionHeader label="Common Mistakes" />
                  <AppCard>
                    {shown.commonMistakes.map((mistake, i) => (
                      <View key={i} style={[styles.row, i > 0 && styles.rowGap]}>
                        <Feather
                          name="x-circle"
                          size={16}
                          color={colors.textMuted}
                          style={styles.rowIcon}
                        />
                        <Text style={styles.rowText}>{mistake}</Text>
                      </View>
                    ))}
                  </AppCard>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function MuscleLine({
  label,
  groups,
  color,
  strong,
  testID,
}: {
  label: string;
  groups: MuscleGroup[];
  color: string;
  strong?: boolean;
  testID: string;
}) {
  return (
    <View testID={testID} style={styles.muscleLine}>
      <Text style={styles.muscleLabel}>{label}</Text>
      <View style={styles.pills}>
        {groups.map((group) => (
          <View key={group} style={[styles.pill, { borderColor: color }]}>
            <Text style={[styles.pillText, { color }, strong && styles.pillStrong]}>
              {MUSCLE_GROUP_LABELS[group]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Steps({
  title,
  steps,
  accent,
  testID,
}: {
  title: string;
  steps: string[];
  accent: string;
  testID: string;
}) {
  if (steps.length === 0) return null;
  return (
    <View testID={testID} style={styles.section}>
      <SectionHeader label={title} />
      <AppCard>
        {steps.map((step, i) => (
          <View key={i} style={[styles.row, i > 0 && styles.rowGap]}>
            <Text style={[styles.stepNumber, { color: accent }]}>{i + 1}</Text>
            <Text style={styles.rowText}>{step}</Text>
          </View>
        ))}
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.md,
  },
  content: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  name: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  line: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  card: {
    marginBottom: spacing.md,
  },
  hostedImage: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  muscleLine: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  muscleLabel: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pillText: {
    ...typeScale.label,
  },
  pillStrong: {
    fontWeight: '700',
  },
  summary: {
    ...typeScale.body,
    color: colors.textSecondaryBright,
    marginVertical: spacing.sm,
  },
  section: {
    marginTop: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  rowGap: {
    marginTop: spacing.md,
  },
  stepNumber: {
    ...typeScale.statSmall,
    width: 18,
    textAlign: 'center',
  },
  rowIcon: {
    marginTop: 2,
  },
  rowText: {
    ...typeScale.body,
    color: colors.textPrimary,
    flex: 1,
  },
});
