import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { Screen } from '../design/Screen';
import { SkeletonCards } from '../design/Skeleton';
import { Text } from '../design/Text';
import { colors, typeScale, widgetGap } from '../design/theme';
import {
  getClientRepRanges,
  setClientExerciseRange,
  setClientRepRange,
  type ClientRangeException,
} from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { RepRangeSheet } from '../settings/RepRangeSheet';
import type { RepRange } from '../workouts/progression';
import { RepRangeExceptions } from '../workouts/RepRangeExceptions';

type Props = RootStackScreenProps<'TrainerClientRepRanges'>;

/** A client with none set follows the app's starting range. */
const DEFAULT_RANGE: RepRange = { min: 8, max: 12 };

function byName(a: ClientRangeException, b: ClientRangeException): number {
  return a.exerciseName.localeCompare(b.exerciseName);
}

/**
 * A trainer's view of a client's rep ranges: the client's own range and their exceptions -- the
 * same settings the client sees and can change -- set here through the API, which checks the
 * active link and records every change. The exercise picker is the trainer's library; one of the
 * trainer's own exercises is saved on the client's copy of it.
 */
export function TrainerClientRepRangesScreen({ navigation, route }: Props) {
  const { clientId, clientName } = route.params;
  const { user, session } = useAuth();
  const accessToken = session?.access_token;
  const { theme, weightUnit } = useProgressTheme();
  const [range, setRange] = useState<RepRange | null>(null);
  const [exceptions, setExceptions] = useState<ClientRangeException[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rangeDraft, setRangeDraft] = useState<RepRange | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    getClientRepRanges(accessToken, clientId)
      .then((result) => {
        if (cancelled) return;
        setRange(result.range ?? DEFAULT_RANGE);
        setExceptions([...result.exceptions].sort(byName));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load their rep ranges');
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, clientId]);

  async function saveRange(next: RepRange) {
    setRangeDraft(null);
    if (!accessToken) return;
    setError(null);
    try {
      setRange(await setClientRepRange(accessToken, clientId, next));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save their rep range');
    }
  }

  const name = clientName ?? 'Client';
  return (
    <>
      <Screen
        contentContainerStyle={styles.content}
        header={
          <AppHeader
            testID="trainer-client-rep-ranges-header"
            title="Rep Ranges"
            subtitle={name}
            onBack={() => navigation.goBack()}
          />
        }
      >
        {error ? (
          <Text testID="trainer-client-rep-ranges-error" style={styles.error}>
            {error}
          </Text>
        ) : null}
        {range === null || exceptions === null ? (
          error ? null : (
            <SkeletonCards testID="trainer-client-rep-ranges-loading" heights={[96, 168]} />
          )
        ) : (
          <RepRangeExceptions
            range={range}
            owner="client"
            exceptions={exceptions}
            weightUnit={weightUnit}
            pickerUserId={user?.id ?? ''}
            onEditRange={() => setRangeDraft(range)}
            onSave={async (exercise, setting) => {
              if (!accessToken) return;
              const saved = await setClientExerciseRange(
                accessToken,
                clientId,
                exercise.exerciseId,
                setting,
              );
              setExceptions((prev) =>
                [
                  ...(prev ?? []).filter(
                    (item) =>
                      item.exerciseId !== exercise.exerciseId &&
                      item.exerciseId !== saved?.exerciseId,
                  ),
                  ...(saved ? [saved] : []),
                ].sort(byName),
              );
            }}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
            testIDPrefix="client-rep-ranges"
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
