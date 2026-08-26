import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { fromKg, roundWeight } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { fetchOneRepMax, fetchRepPRs, type OneRepMax, type RepPR } from '../workouts/prQueries';
import { workoutStyles as styles } from './workoutStyles';

type Props = RootStackScreenProps<'PRHistory'>;

function formatWeight(kg: number, unit: 'kg' | 'lb'): string {
  const value = roundWeight(fromKg(kg, unit));
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Read-only view over the database-maintained rep_prs/one_rep_maxes tables
// (see supabase/migrations/20260823100008_pr_infrastructure.sql) -- nothing
// here is calculated client-side, it's a direct display of what the
// database has already recomputed.
export function PRHistoryScreen({ route, navigation }: Props) {
  const { exerciseId, exerciseName } = route.params;
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;

  const [repPRs, setRepPRs] = useState<RepPR[]>([]);
  const [oneRepMax, setOneRepMax] = useState<OneRepMax | null>(null);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId || !accessToken) return;
      setLoading(true);
      setError(null);
      try {
        const [prs, orm, profile] = await Promise.all([
          fetchRepPRs(userId, exerciseId),
          fetchOneRepMax(userId, exerciseId),
          getMyProfile(accessToken),
        ]);
        if (cancelled) return;
        setRepPRs(prs);
        setOneRepMax(orm);
        setWeightUnit(profile.weightUnit);
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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{exerciseName}</Text>
        <TouchableOpacity testID="pr-history-back" onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>Back</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <Text testID="pr-history-error" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {loading ? (
        <ActivityIndicator testID="pr-history-loading" size="large" color="#FFFFFF" />
      ) : (
        <>
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>1RM</Text>
            {oneRepMax ? (
              <Text testID="one-rep-max-value" style={styles.cardMetaHighlight}>
                {formatWeight(oneRepMax.weightKg, weightUnit)}
                {weightUnit} · {formatDate(oneRepMax.achievedAt)}
              </Text>
            ) : (
              <Text testID="one-rep-max-empty" style={styles.emptyText}>
                No 1RM recorded yet — log a single-rep set to set one.
              </Text>
            )}
          </View>

          <Text style={styles.bannerTitle}>Rep PRs</Text>
          {repPRs.length === 0 ? (
            <Text testID="rep-prs-empty" style={styles.emptyText}>
              No rep PRs recorded yet
            </Text>
          ) : (
            repPRs.map((pr) => (
              <View key={pr.reps} testID={`pr-row-${pr.reps}`} style={styles.listItem}>
                <Text style={styles.listItemTitle}>
                  {pr.reps} Rep — {formatWeight(pr.bestWeightKg, weightUnit)}
                  {weightUnit}
                </Text>
                <Text style={styles.listItemMeta}>{formatDate(pr.achievedAt)}</Text>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}
