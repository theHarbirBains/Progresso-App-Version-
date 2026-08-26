import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import type { RootStackScreenProps } from '../navigation/types';
import {
  fetchActiveWorkout,
  fetchWorkoutHistory,
  type WorkoutSummary,
} from '../workouts/workoutQueries';
import { workoutStyles as styles } from './workoutStyles';

const PAGE_SIZE = 20;

type Props = RootStackScreenProps<'WorkoutHistory'>;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function WorkoutHistoryScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const [activeWorkout, setActiveWorkout] = useState<WorkoutSummary | null>(null);
  const [rows, setRows] = useState<WorkoutSummary[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [active, history] = await Promise.all([
        fetchActiveWorkout(userId),
        fetchWorkoutHistory(userId, 0, PAGE_SIZE),
      ]);
      setActiveWorkout(active);
      setRows(history.rows);
      setHasMore(history.hasMore);
      setPage(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workouts');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    // Re-load every time this screen gains focus, not just on mount, so
    // returning here after starting/completing a workout shows current data.
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  async function handleLoadMore() {
    if (!userId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const history = await fetchWorkoutHistory(userId, next, PAGE_SIZE);
      setRows((prev) => [...prev, ...history.rows]);
      setHasMore(history.hasMore);
      setPage(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workouts');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.title}>Workouts</Text>
              <TouchableOpacity testID="workout-history-back" onPress={() => navigation.goBack()}>
                <Text style={styles.backLink}>Back</Text>
              </TouchableOpacity>
            </View>

            {activeWorkout ? (
              <View style={styles.banner}>
                <Text style={styles.bannerTitle}>You have a workout in progress</Text>
                <TouchableOpacity
                  testID="resume-active-workout"
                  style={styles.button}
                  onPress={() =>
                    navigation.navigate('ActiveWorkout', { workoutId: activeWorkout.id })
                  }
                >
                  <Text style={styles.buttonText}>Resume &quot;{activeWorkout.name}&quot;</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                testID="start-new-workout"
                style={styles.button}
                onPress={() => navigation.navigate('NewWorkout')}
              >
                <Text style={styles.buttonText}>Start New Workout</Text>
              </TouchableOpacity>
            )}

            {error ? (
              <Text testID="workout-history-error" style={styles.error}>
                {error}
              </Text>
            ) : null}

            {loading ? (
              <ActivityIndicator testID="workout-history-loading" size="large" color="#FFFFFF" />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`workout-item-${item.id}`}
            style={styles.listItem}
            onPress={() => navigation.navigate('WorkoutDetail', { workoutId: item.id })}
          >
            <Text style={styles.listItemTitle}>{item.name}</Text>
            <Text style={styles.listItemMeta}>{formatDate(item.performedAt)}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No workouts yet</Text> : null}
        ListFooterComponent={
          hasMore ? (
            <TouchableOpacity
              testID="workout-history-load-more"
              style={styles.secondaryButton}
              onPress={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.secondaryButtonText}>Load More</Text>
              )}
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}
