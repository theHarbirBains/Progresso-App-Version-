import { useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { Card } from '../design/Card';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { Screen } from '../design/Screen';
import { SkeletonCards } from '../design/Skeleton';
import { widgetGap } from '../design/theme';
import { WorkoutFeedCard } from '../feed/WorkoutFeedCard';
import { listTrainerClients } from '../lib/api';
import { recallShown, rememberShown } from '../lib/lastShown';
import { AppMenuContext } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { clientName, pickableClients } from '../trainer/clientPicker';
import { fetchClientsActivity, type ClientActivityItem } from '../trainer/clientQueries';
import { useWorkspace } from '../workspace/WorkspaceContext';
import { WorkspaceSwitcher } from '../workspace/WorkspaceSwitcher';

type Props = RootStackScreenProps<'TrainerActivity'>;

/**
 * The Trainer Workspace's Activity tab: every client's latest finished workouts in one
 * feed, newest first, as the same cards Feed shows -- the client's name in the byline.
 * Tapping one opens that client. Refreshes each time it comes into view, since it only
 * ever changes from elsewhere (a client training, or the trainer logging for them).
 */
export function TrainerActivityScreen({ navigation }: Props) {
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const userId = user?.id;
  const { weightUnit } = useProgressTheme();
  // The side menu and the workspace switcher (both absent outside the app shell, e.g. in a test).
  const menu = useContext(AppMenuContext);
  const workspace = useWorkspace();

  // What this page showed last time (lib/lastShown.ts): reopening the tab starts from it.
  const [items, setItems] = useState<ClientActivityItem[] | null>(
    () => recallShown<ClientActivityItem[]>(userId, 'trainer.activity') ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const clients = await listTrainerClients(accessToken);
      // Active clients only -- an invite or request still waiting has nothing to read yet.
      const active = pickableClients(clients, new Set()).map((client) => ({
        clientId: client.clientId as string,
        name: clientName(client),
      }));
      const latest = await fetchClientsActivity(active);
      setItems(latest);
      rememberShown(userId, 'trainer.activity', latest);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load activity');
    }
  }, [accessToken, userId]);

  // Loads each time the page comes into view -- including the first, so no separate mount load.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => void load());
    return unsubscribe;
  }, [navigation, load]);

  return (
    <Screen
      contentContainerStyle={{ gap: widgetGap }}
      header={
        <AppHeader
          testID="trainer-activity-header"
          title="Activity"
          titleContent={workspace?.isTrainer ? <WorkspaceSwitcher /> : undefined}
          leftAction={
            menu
              ? {
                  icon: 'menu',
                  onPress: () => menu.openMenu(),
                  accessibilityLabel: 'Open menu',
                  testID: 'trainer-activity-open-menu',
                }
              : undefined
          }
        />
      }
    >
      {error && !items ? (
        <ErrorState testID="trainer-activity-error" message={error} onRetry={() => void load()} />
      ) : null}

      {!items && !error ? (
        <SkeletonCards testID="trainer-activity-loading" heights={[220, 220]} />
      ) : null}

      {items && items.length === 0 ? (
        <Card testID="trainer-activity-empty">
          <EmptyState
            title="No client workouts yet"
            description="When a client finishes a workout, or you log one for them, it shows up here, newest first."
          />
        </Card>
      ) : null}

      {items?.map((item) => (
        <WorkoutFeedCard
          key={item.workout.id}
          idPrefix="trainer-activity-workout"
          workout={item.workout}
          authorName={item.clientName}
          timestamp={item.workout.performedAt}
          weightUnit={weightUnit}
          onPress={() =>
            navigation.navigate('TrainerClientDetail', {
              clientId: item.clientId,
              clientName: item.clientName,
            })
          }
        />
      ))}
    </Screen>
  );
}
