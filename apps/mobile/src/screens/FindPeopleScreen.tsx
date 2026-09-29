import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { ActivityIndicator, Share, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { Avatar } from '../design/Avatar';
import { Badge } from '../design/Badge';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { TextInput } from '../design/TextInput';
import { colors } from '../design/theme';
import { UnderlineTabs } from '../design/UnderlineTabs';
import {
  listFollowRequests,
  listSuggestedUsers,
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
type FindPeopleTab = 'friends' | 'requests';
type FriendsSubTab = 'suggested' | 'contacts';

const SEARCH_DEBOUNCE_MS = 300;
const INVITE_MESSAGE = 'Join me on Progresso — track your workouts and nutrition.';

function rowLabel(user: FollowUser): { title: string; subtitle: string | undefined } {
  if (user.displayName) {
    return { title: user.displayName, subtitle: user.username ? `@${user.username}` : undefined };
  }
  return { title: user.username ? `@${user.username}` : 'Someone', subtitle: undefined };
}

/**
 * The entry point into Social v1 (see the follows/feed backend modules) --
 * structured after a familiar "search for friends" pattern (tabs up top,
 * a search field, a browsable default list below it) rather than one long
 * scrolling mix of everything, while staying strictly within Progresso's
 * own dark/monochrome theme and component set (AppCard/ListRow/Button),
 * never the source app's own colors.
 *
 * Friends tab: search when typing; when empty, a Suggested/Contacts
 * sub-row. Suggested is real (recency-ranked users you have no existing
 * follow row toward -- see FollowsService.listSuggested); Contacts is
 * visibly present but honestly "Coming Soon" -- it would need a phone
 * number field and device-contacts permission that don't exist yet, so a
 * working tab here isn't a small addition, and a silently-broken one
 * would violate CLAUDE.md's placeholder rules.
 *
 * Requests tab: the full follow-request management list. The
 * notifications bell (NotificationsScreen) surfaces the same pending
 * requests too, alongside recent acceptances -- that's the quick/recent
 * view; this is the full list, same underlying data.
 */
export function FindPeopleScreen({ navigation }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;

  const [tab, setTab] = useState<FindPeopleTab>('friends');
  const [friendsSubTab, setFriendsSubTab] = useState<FriendsSubTab>('suggested');

  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  const [suggested, setSuggested] = useState<FollowSearchResult[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(true);
  const [suggestedError, setSuggestedError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<FollowSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Keyed by followId (requests) or user id (search/suggested results) --
  // disables just the one row's button(s) while its action is in flight,
  // rather than freezing the whole screen.
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

  const loadSuggested = useCallback(async () => {
    if (!accessToken) return;
    setSuggestedLoading(true);
    setSuggestedError(null);
    try {
      setSuggested(await listSuggestedUsers(accessToken));
    } catch (err) {
      setSuggestedError(err instanceof Error ? err.message : 'Failed to load suggested people');
    } finally {
      setSuggestedLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void loadRequests();
      void loadSuggested();
    });
    return unsubscribe;
  }, [navigation, loadRequests, loadSuggested]);

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

  // Shared by the search-results list and the suggested-people list -- both
  // are the same FollowSearchResult shape and Follow/Requested/Following
  // lifecycle, just different data sources, so a follow/unfollow updates
  // whichever list the row actually came from.
  async function follow(
    userId: string,
    setList: Dispatch<SetStateAction<FollowSearchResult[]>>,
    setError: Dispatch<SetStateAction<string | null>>,
  ) {
    if (!accessToken) return;
    setPending((p) => ({ ...p, [userId]: true }));
    try {
      const { status } = await sendFollowRequest(accessToken, userId);
      setList((prev) => prev.map((r) => (r.user.id === userId ? { ...r, status } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send follow request');
    } finally {
      setPending((p) => ({ ...p, [userId]: false }));
    }
  }

  // Also cancels a still-pending outgoing request -- unfollow() removes the
  // follow row regardless of its status (see FollowsService.unfollow).
  async function unfollow(
    userId: string,
    setList: Dispatch<SetStateAction<FollowSearchResult[]>>,
    setError: Dispatch<SetStateAction<string | null>>,
  ) {
    if (!accessToken) return;
    setPending((p) => ({ ...p, [userId]: true }));
    try {
      await unfollowUser(accessToken, userId);
      setList((prev) => prev.map((r) => (r.user.id === userId ? { ...r, status: 'none' } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unfollow');
    } finally {
      setPending((p) => ({ ...p, [userId]: false }));
    }
  }

  async function handleInvite() {
    try {
      await Share.share({ message: INVITE_MESSAGE });
    } catch {
      // The OS share sheet handles its own cancel/error UI -- nothing more to do here.
    }
  }

  function renderResultTrailing(
    result: FollowSearchResult,
    testIDPrefix: string,
    onFollow: (userId: string) => void,
    onUnfollow: (userId: string) => void,
  ) {
    const isPending = Boolean(pending[result.user.id]);
    if (result.status === 'accepted') {
      return (
        <SecondaryButton
          testID={`${testIDPrefix}-${result.user.id}-following`}
          label="Following"
          size="sm"
          loading={isPending}
          onPress={() => onUnfollow(result.user.id)}
        />
      );
    }
    if (result.status === 'pending') {
      return (
        <SecondaryButton
          testID={`${testIDPrefix}-${result.user.id}-requested`}
          label="Requested"
          size="sm"
          loading={isPending}
          onPress={() => onUnfollow(result.user.id)}
        />
      );
    }
    return (
      <PrimaryButton
        testID={`${testIDPrefix}-${result.user.id}-follow`}
        label="Follow"
        size="sm"
        loading={isPending}
        onPress={() => onFollow(result.user.id)}
      />
    );
  }

  function renderResultRow(result: FollowSearchResult, testIDPrefix: string, index: number, trailing: ReactNode) {
    const { title, subtitle } = rowLabel(result.user);
    return (
      <ListRow
        key={result.user.id}
        testID={`${testIDPrefix}-${result.user.id}`}
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
        trailing={trailing}
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
          <UnderlineTabs
            testID="find-people-tab"
            categories={[
              { key: 'friends', label: 'Friends', icon: 'users' },
              {
                key: 'requests',
                label: requests.length > 0 ? `Requests (${requests.length})` : 'Requests',
                icon: 'inbox',
              },
            ]}
            active={tab}
            onSelect={setTab}
            accentColor={colors.accent}
          />
          {tab === 'friends' ? (
            <View style={styles.searchRow}>
              <TextInput
                testID="find-people-search-input"
                placeholder="Search for people on Progresso"
                value={searchInput}
                onChangeText={setSearchInput}
                autoCapitalize="none"
                leftAccessory={<Feather name="search" size={16} color={colors.textMuted} />}
              />
            </View>
          ) : null}
        </View>
      }
    >
      {tab === 'requests' ? (
        requestsLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator
              testID="find-people-requests-loading"
              size="large"
              color={colors.textPrimary}
            />
          </View>
        ) : requestsError ? (
          <ErrorState
            testID="find-people-requests-error"
            message={requestsError}
            onRetry={loadRequests}
          />
        ) : requests.length === 0 ? (
          <EmptyState
            testID="find-people-requests-empty"
            title="No pending requests"
            description="Follow requests you receive show up here."
          />
        ) : (
          <AppCard testID="find-people-requests-card">
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
        )
      ) : search !== '' ? (
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
              <ActivityIndicator
                testID="find-people-search-loading"
                size="large"
                color={colors.textPrimary}
              />
            </View>
          ) : results.length === 0 ? (
            <EmptyState testID="find-people-empty-results" title={`No one found for "${search}"`} />
          ) : (
            <>
              <SectionHeader label="Results" />
              {results.map((result, index) =>
                renderResultRow(
                  result,
                  'find-people-result',
                  index,
                  renderResultTrailing(
                    result,
                    'find-people-result',
                    (userId) => follow(userId, setResults, setSearchError),
                    (userId) => unfollow(userId, setResults, setSearchError),
                  ),
                ),
              )}
            </>
          )}
        </AppCard>
      ) : (
        <>
          <View style={styles.subTabWrap}>
            <UnderlineTabs
              testID="find-people-subtab"
              categories={[
                { key: 'suggested', label: 'Suggested', icon: 'star' },
                { key: 'contacts', label: 'Contacts', icon: 'phone' },
              ]}
              active={friendsSubTab}
              onSelect={setFriendsSubTab}
              accentColor={colors.accent}
            />
          </View>

          {friendsSubTab === 'contacts' ? (
            <AppCard testID="find-people-contacts-card">
              <ListRow
                testID="find-people-contacts-coming-soon"
                icon="phone"
                title="Find friends from your contacts"
                subtitle="Match your phone contacts to people already on Progresso"
                trailing={
                  <Badge
                    label="Coming Soon"
                    color={colors.textMuted}
                    backgroundColor={colors.surfaceRaised}
                    testID="find-people-contacts-coming-soon-badge"
                  />
                }
              />
            </AppCard>
          ) : suggestedLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator
                testID="find-people-suggested-loading"
                size="large"
                color={colors.textPrimary}
              />
            </View>
          ) : suggestedError ? (
            <ErrorState
              testID="find-people-suggested-error"
              message={suggestedError}
              onRetry={loadSuggested}
            />
          ) : suggested.length === 0 ? (
            <EmptyState
              testID="find-people-suggested-empty"
              title="No suggestions right now"
              description="Check back once more people have joined Progresso."
            />
          ) : (
            <AppCard testID="find-people-suggested-card">
              <SectionHeader
                label={`${suggested.length} ${suggested.length === 1 ? 'person' : 'people'} to follow`}
              />
              {suggested.map((result, index) =>
                renderResultRow(
                  result,
                  'find-people-suggested',
                  index,
                  renderResultTrailing(
                    result,
                    'find-people-suggested',
                    (userId) => follow(userId, setSuggested, setSuggestedError),
                    (userId) => unfollow(userId, setSuggested, setSuggestedError),
                  ),
                ),
              )}
            </AppCard>
          )}

          <View style={styles.inviteWrap}>
            <SectionHeader label="Invite friends who aren't on Progresso yet" />
            <PrimaryButton testID="find-people-invite" label="Invite" onPress={handleInvite} />
          </View>
        </>
      )}
    </Screen>
  );
}
