import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { Screen } from '../design/Screen';
import { SkeletonCards } from '../design/Skeleton';
import { Text } from '../design/Text';
import { colors, typeScale, widgetGap } from '../design/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { useProfile } from '../profile/ProfileProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
import { RepRangeSheet } from '../settings/RepRangeSheet';
import { fetchExerciseSettings, saveExerciseSetting } from '../workouts/exerciseSettingsQueries';
import type { RepRange } from '../workouts/progression';
import { RepRangeExceptions, type RangeException } from '../workouts/RepRangeExceptions';

type Props = RootStackScreenProps<'RepRangeExceptions'>;

function byName(a: RangeException, b: RangeException): number {
  return a.exerciseName.localeCompare(b.exerciseName);
}

/**
 * Settings > Workout Preferences > Rep Range Exceptions: the person's rep range and the
 * exercises they train outside it (their own range and/or weight step), each set here or from the
 * exercise's menu in a workout. Read when the page opens; every save updates the list from what
 * was saved.
 */
export function RepRangeExceptionsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { profile, updateProfile } = useProfile();
  const { theme, weightUnit } = useProgressTheme();
  const [exceptions, setExceptions] = useState<RangeException[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rangeDraft, setRangeDraft] = useState<RepRange | null>(null);
  const range: RepRange = { min: profile?.repRangeMin ?? 8, max: profile?.repRangeMax ?? 12 };

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchExerciseSettings(userId)
      .then((settings) => {
        if (!cancelled) setExceptions([...settings.values()].sort(byName));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load your exceptions');
        setExceptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function saveRange(next: RepRange) {
    setRangeDraft(null);
    setError(null);
    try {
      await updateProfile({ repRangeMin: next.min, repRangeMax: next.max });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save your rep range');
    }
  }

  return (
    <>
      <Screen
        contentContainerStyle={styles.content}
        header={
          <AppHeader
            testID="rep-range-exceptions-header"
            title="Rep Range Exceptions"
            onBack={() => navigation.goBack()}
          />
        }
      >
        {error ? (
          <Text testID="rep-range-exceptions-error" style={styles.error}>
            {error}
          </Text>
        ) : null}
        {exceptions === null ? (
          <SkeletonCards testID="rep-range-exceptions-loading" heights={[96, 168]} />
        ) : (
          <RepRangeExceptions
            range={range}
            owner="self"
            exceptions={exceptions}
            weightUnit={weightUnit}
            pickerUserId={userId}
            onEditRange={() => setRangeDraft(range)}
            onSave={async (exercise, setting) => {
              const saved = await saveExerciseSetting(userId, exercise.exerciseId, setting);
              setExceptions((prev) =>
                [
                  ...(prev ?? []).filter((item) => item.exerciseId !== exercise.exerciseId),
                  ...(saved ? [saved] : []),
                ].sort(byName),
              );
            }}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
        )}
      </Screen>
      <RepRangeSheet
        draft={rangeDraft}
        onChangeDraft={setRangeDraft}
        onClose={() => setRangeDraft(null)}
        onSave={(next) => void saveRange(next)}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: widgetGap,
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
