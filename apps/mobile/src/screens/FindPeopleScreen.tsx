import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { Avatar } from '../design/Avatar';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { TextInput } from '../design/TextInput';
import { colors } from '../design/theme';
import {
  listFollowRequests,
  respondToFollowRequest,
  searchUsers,
  sendFollowRequest,
  unfollowUser,
  type FollowRequest,
  type FollowSearchResult,
  type FollowUser,
} from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { findPeopleStyles as styles } from './findPeopleStyles';

type Props = RootStackScreenProps<'FindPeople'>;

const SEARCH_DEBOUNCE_MS = 300;

function rowLabel(user: FollowUser): { title: string; subtitle: string | undefined } {
  if (user.displayName) {
    return { title: user.displayName, subtitle: user.username ? `@${user.username}` : undefined };
  }
  return { title: user.username ? `@${user.username}` : 'Someone', subtitle: undefined };
}

/**
 * The entry point into Social v1 (see the follows/feed backend modules):
 * incoming follow requests to accept/reject, plus a search to find and
 * follow people. Reached from the app menu's SOCIAL section (see
 * appMenuSections.ts) rather than Feed's own header, since AppHeader only
 * has room for one right-side action and Feed's "+" quick-actions button
 * already owns that slot.
 *
 * Following requires the other person's acceptance (see the follows
 * migration) -- there is no "search and immediately see their workouts"
 * path here; once accepted, their activity appears in Feed's Friends tab
 * instead.
 */
export function FindPeopleScreen({ navigation }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;

  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<FollowSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Keyed by followId (requests) or user id (search results) -- disables
  // just the one row's button(s) while its action is in flight, rather than
  // freezing the whole screen.
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const loadRequests = useCallback(async () => {
    if (!accessToken) return;
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      setRequests(await listFollowRequests(accessToken));
    } catch (err) {
      setRequestsError(err instanceof Error ? err.message : 'Failed to load follow requests');
    } finally {
      setRequestsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadRequests);
    return unsubscribe;
  }, [navigation, loadRequests]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const runSearch = useCallback(async () => {
    if (!search) {
      setResults([]);
      setSearchError(null);
      return;
    }
    if (!accessToken) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      setResults(await searchUsers(accessToken, search));
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Failed to search people');
    } finally {
      setSearchLoading(false);
    }
  }, [search, accessToken]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  async function handleAccept(followId: string) {
    if (!accessToken) return;
    setPending((p) => ({ ...p, [followId]: true }));
    try {
      await respondToFollowRequest(accessToken, followId, 'accept');
      setRequests((prev) => prev.filter((r) => r.followId !== followId));
    } catch (err) {
      setRequestsError(err instanceof Error ? err.message : 'Failed to accept request');
      setPending((p) => ({ ...p, [followId]: false }));
    }
  }

  async function handleReject(followId: string) {
    if (!accessToken) return;
    setPending((p) => ({ ...p, [followId]: true }));
    try {
      await respondToFollowRequest(accessToken, followId, 'reject');
      setRequests((prev) => prev.filter((r) => r.followId !== followId));
    } catch (err) {
      setRequestsError(err instanceof Error ? err.message : 'Failed to reject request');
      setPending((p) => ({ ...p, [followId]: false }));
    }
  }

  async function handleFollow(userId: string) {
    if (!accessToken) return;
    setPending((p) => ({ ...p, [userId]: true }));
    try {
      const { status } = await sendFollowRequest(accessToken, userId);
      setResults((prev) => prev.map((r) => (r.user.id === userId ? { ...r, status } : r)));
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Failed to send follow request');
    } finally {
      setPending((p) => ({ ...p, [userId]: false }));
    }
  }

  // Also cancels a still-pending outgoing request -- unfollow() removes the
  // follow row regardless of its status (see FollowsService.unfollow).
  async function handleUnfollow(userId: string) {
    if (!accessToken) return;
    setPending((p) => ({ ...p, [userId]: true }));
    try {
      await unfollowUser(accessToken, userId);
      setResults((prev) =>
        prev.map((r) => (r.user.id === userId ? { ...r, status: 'none' } : r)),
      );
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Failed to unfollow');
    } finally {
      setPending((p) => ({ ...p, [userId]: false }));
    }
  }

  function renderSearchResultTrailing(result: FollowSearchResult) {
    const isPending = Boolean(pending[result.user.id]);
    if (result.status === 'accepted') {
      return (
        <SecondaryButton
          testID={`find-people-result-${result.user.id}-following`}
          label="Following"
          size="sm"
          loading={isPending}
          onPress={() => handleUnfollow(result.user.id)}
        />
      );
    }
    if (result.status === 'pending') {
      return (
        <SecondaryButton
          testID={`find-people-result-${result.user.id}-requested`}
          label="Requested"
          size="sm"
          loading={isPending}
          onPress={() => handleUnfollow(result.user.id)}
        />
      );
    }
    return (
      <PrimaryButton
        testID={`find-people-result-${result.user.id}-follow`}
        label="Follow"
        size="sm"
        loading={isPending}
        onPress={() => handleFollow(result.user.id)}
      />
    );
  }

  return (
    <Screen
      scrollTestID="find-people-scroll"
      header={
        <View>
          <AppHeader
            title="Find People"
            onBack={() => navigation.goBack()}
            testID="find-people-header"
          />
          <View style={styles.searchRow}>
            <TextInput
              testID="find-people-search-input"
              placeholder="Search by name or username"
              value={searchInput}
              onChangeText={setSearchInput}
              autoCapitalize="none"
              leftAccessory={<Feather name="search" size={16} color={colors.textMuted} />}
            />
          </View>
        </View>
      }
    >
      {requestsLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator testID="find-people-requests-loading" size="large" color={colors.textPrimary} />
        </View>
      ) : requestsError ? (
        <ErrorState testID="find-people-requests-error" message={requestsError} onRetry={loadRequests} />
      ) : requests.length > 0 ? (
        <AppCard testID="find-people-requests-card">
          <SectionHeader label="Requests" />
          {requests.map((request, index) => {
            const { title, subtitle } = rowLabel(request.user);
            const isPending = Boolean(pending[request.followId]);
            return (
              <ListRow
                key={request.followId}
                testID={`find-people-request-${request.followId}`}
                divider={index > 0}
                leading={
                  <Avatar
                    uri={request.user.avatarUrl}
                    initial={title.charAt(0).toUpperCase()}
                    size={40}
                    iconSize={18}
                    iconColor={colors.textSecondary}
                  />
                }
                title={title}
                subtitle={subtitle}
                trailing={
                  <View style={styles.requestActions}>
                    <SecondaryButton
                      testID={`find-people-request-${request.followId}-reject`}
                      label="Reject"
                      size="sm"
                      loading={isPending}
                      onPress={() => handleReject(request.followId)}
                    />
                    <PrimaryButton
                      testID={`find-people-request-${request.followId}-accept`}
                      label="Accept"
                      size="sm"
                      loading={isPending}
                      onPress={() => handleAccept(request.followId)}
                    />
                  </View>
                }
              />
            );
          })}
        </AppCard>
      ) : null}

      <AppCard testID="find-people-search-card">
        {searchError ? (
          <ErrorState
            testID="find-people-search-error"
            message={searchError}
            onRetry={() => {
              void runSearch();
            }}
          />
        ) : searchLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator testID="find-people-search-loading" size="large" color={colors.textPrimary} />
          </View>
        ) : search === '' ? (
          <EmptyState
            testID="find-people-empty-initial"
            title="Search for someone to follow"
            description="Their activity appears in your Friends feed once they accept."
          />
        ) : results.length === 0 ? (
          <EmptyState testID="find-people-empty-results" title={`No one found for "${search}"`} />
        ) : (
          <>
            <SectionHeader label="Results" />
            {results.map((result, index) => {
              const { title, subtitle } = rowLabel(result.user);
              return (
                <ListRow
                  key={result.user.id}
                  testID={`find-people-result-${result.user.id}`}
                  divider={index > 0}
                  leading={
                    <Avatar
                      uri={result.user.avatarUrl}
                      initial={title.charAt(0).toUpperCase()}
                      size={40}
                      iconSize={18}
                      iconColor={colors.textSecondary}
                    />
                  }
                  title={title}
                  subtitle={subtitle}
                  trailing={renderSearchResultTrailing(result)}
                />
              );
            })}
          </>
        )}
      </AppCard>
    </Screen>
  );
}
