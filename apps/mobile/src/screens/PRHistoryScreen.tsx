import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { colors } from '../design/theme';
import { formatWeightKg } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { fetchOneRepMax, fetchRepPRs, type OneRepMax, type RepPR } from '../workouts/prQueries';
import { formatShortDate } from '../workouts/workoutFormat';
import { exerciseProgressStyles as styles } from './exerciseProgressStyles';

type Props = RootStackScreenProps<'PRHistory'>;

// Read-only view over the database-maintained rep_prs/one_rep_maxes tables
// (see supabase/migrations/20260823100008_pr_infrastructure.sql) -- nothing
// here is calculated client-side, it's a direct display of what the
// database has already recomputed.
//
// Layout: a stack of widgets -- "View Trend", the true 1RM as the one large
// accent readout in the hero card (never estimated -- only a logged single-rep
// set makes one), then the rep-count PRs as rows (rep count, date, heaviest
// weight).
export function PRHistoryScreen({ route, navigation }: Props) {
  const { exerciseId, exerciseName } = route.params;
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const { theme, weightUnit } = useProgressTheme();

  const [repPRs, setRepPRs] = useState<RepPR[]>([]);
  const [oneRepMax, setOneRepMax] = useState<OneRepMax | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId || !accessToken) return;
      setLoading(true);
      setError(null);
      try {
        const [prs, orm] = await Promise.all([
          fetchRepPRs(userId, exerciseId),
          fetchOneRepMax(userId, exerciseId),
        ]);
        if (cancelled) return;
        setRepPRs(prs);
        setOneRepMax(orm);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load PR history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, accessToken, exerciseId]);

  return (
    <Screen
      scrollTestID="pr-history-scroll"
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          title={exerciseName}
          leftAction={{
            icon: 'arrow-left',
            onPress: () => navigation.goBack(),
            accessibilityLabel: 'Back',
            testID: 'pr-history-back',
          }}
        />
      }
    >
      {error ? (
        <Text testID="pr-history-error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator testID="pr-history-loading" size="large" color={colors.textPrimary} />
        </View>
      ) : (
        <>
          <AppCard>
            <ListRow
              testID="view-trend"
              icon="trending-up"
              title="View Trend"
              subtitle="See how this lift has progressed over time"
              onPress={() => navigation.navigate('ExerciseProgress', { exerciseId, exerciseName })}
            />
          </AppCard>

          <AppCard hero topAccent={theme.accent} testID="pr-history-one-rep-max">
            <Section title="1RM">
              {oneRepMax ? (
                <View>
                  <Text
                    testID="one-rep-max-value"
                    style={[styles.oneRepMaxValue, { color: theme.accent }]}
                  >
                    {formatWeightKg(oneRepMax.weightKg, weightUnit)}
                    {weightUnit}
                  </Text>
                  <Text style={styles.oneRepMaxDate}>{formatShortDate(oneRepMax.achievedAt)}</Text>
                </View>
              ) : (
                <Text testID="one-rep-max-empty" style={styles.emptyText}>
                  No 1RM recorded yet — log a single-rep set to set one.
                </Text>
              )}
            </Section>
          </AppCard>

          <AppCard testID="pr-history-rep-prs">
            <Section title="Rep PRs">
              {repPRs.length === 0 ? (
                <Text testID="rep-prs-empty" style={styles.emptyText}>
                  No rep PRs recorded yet
                </Text>
              ) : (
                repPRs.map((pr, index) => (
                  <ListRow
                    key={pr.reps}
                    testID={`pr-row-${pr.reps}`}
                    divider={index > 0}
                    title={`${pr.reps} Rep`}
                    subtitle={formatShortDate(pr.achievedAt)}
                    value={`${formatWeightKg(pr.bestWeightKg, weightUnit)}${weightUnit}`}
                  />
                ))
              )}
            </Section>
          </AppCard>
        </>
      )}
    </Screen>
  );
}
