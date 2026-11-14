import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { Screen } from '../design/Screen';
import { SkeletonRows } from '../design/Skeleton';
import { listPersonFollowers, listPersonFollowing, type FollowSearchResult } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { PeopleList } from '../social/PeopleList';

type Props = RootStackScreenProps<'FollowList'>;

/**
 * Who follows someone, or who they follow -- for you, or someone who accepted your follow. Each
 * person opens their profile, with Follow / Requested / Following beside them (none on your own
 * row). Read each time it opens; nobody blocked either way is listed.
 */
export function FollowListScreen({ route, navigation }: Props) {
  const { userId, which, name } = route.params;
  const { user, session } = useAuth();
  const accessToken = session?.access_token;
  const [people, setPeople] = useState<FollowSearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      setPeople(
        which === 'followers'
          ? await listPersonFollowers(accessToken, userId)
          : await listPersonFollowing(accessToken, userId),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this list');
    }
  }, [accessToken, userId, which]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => void load());
    return unsubscribe;
  }, [navigation, load]);

  const title = which === 'followers' ? 'Followers' : 'Following';
  const isMine = userId === user?.id;

  return (
    <Screen
      scrollTestID="follow-list-scroll"
      header={
        <AppHeader
          testID="follow-list-header"
          title={title}
          subtitle={!isMine && name ? name : undefined}
          onBack={() => navigation.goBack()}
        />
      }
    >
      {error ? (
        <ErrorState testID="follow-list-error" message={error} onRetry={() => void load()} />
      ) : people === null ? (
        <SkeletonRows testID="follow-list-loading" count={6} />
      ) : people.length === 0 ? (
        <EmptyState
          testID="follow-list-empty"
          title={which === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
          description={
            which === 'followers'
              ? 'People who follow show here once their request is accepted.'
              : 'People followed show here once they accept.'
          }
        />
      ) : (
        <AppCard testID="follow-list-card">
          <PeopleList
            people={people}
            selfId={user?.id ?? ''}
            onOpen={(id) => navigation.push('PersonProfile', { userId: id })}
            testIDPrefix="follow-list-person"
          />
        </AppCard>
      )}
    </Screen>
  );
}
