import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { Share, View } from 'react-native';
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
import { UnderlineTabs } from '../design/UnderlineTabs';
import {
  listFollowRequests,
  listPersonFollowers,
  listPersonFollowing,
  respondToFollowRequest,
  searchUsers,
  sendFollowRequest,
  unfollowUser,
  type FollowRequest,
  type FollowSearchResult,
  type FollowUser,
} from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { ContactSuggestions } from '../social/ContactSuggestions';
import { PeopleList, personLabel } from '../social/PeopleList';
import { findPeopleStyles as styles } from './findPeopleStyles';
import { SkeletonRows } from '../design/Skeleton';
import { useAppTheme } from '../theme/appThemeContext';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { confirmUnfollow, unfollowName } from '../social/confirmUnfollow';

type Props = RootStackScreenProps<'FindPeople'>;
type FindPeopleTab = 'friends' | 'following' | 'requests';
type FriendsSubTab = 'friends' | 'suggested';

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
 * Friends tab: search when typing; when empty, a Your Friends / Suggested
 * sub-row. Your Friends is everyone who follows you or whom you follow (an
 * accepted follow either way), each with Follow (when you don't follow them
 * back), Requested or Following. Suggested is the people in your phone's
 * contacts who are on Progresso and whom you don't follow yet, found by email
 * or phone number (social/ContactSuggestions.tsx). Read each time the page is
 * shown.
 *
 * Following tab: everyone you follow (whose follow was accepted), each opening their profile,
 * with Following beside them to unfollow. Read each time the page is shown.
 *
 * Requests tab: the full follow-request management list. The
 * notifications bell (NotificationsScreen) surfaces the same pending
 * requests too, alongside recent acceptances -- that's the quick/recent
 * view; this is the full list, same underlying data.
 *
 * Tapping a person opens their profile (PersonProfileScreen), where Report and
 * Block are.
 */
export function FindPeopleScreen({ navigation, route }: Props) {
  const accent = useAppTheme().accent.accent;
  const { user, session } = useAuth();
  const userId = user?.id;
  const accessToken = session?.access_token;

  const [tab, setTab] = useState<FindPeopleTab>(route.params?.tab ?? 'friends');
  // Opened again for a tab while already open underneath.
  const askedTab = route.params?.tab;
  useEffect(() => {
    if (askedTab) setTab(askedTab);
  }, [askedTab]);
  const [friendsSubTab, setFriendsSubTab] = useState<FriendsSubTab>('friends');

  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  // Who you follow, and your friends: them and everyone who follows you.
  const [following, setFollowing] = useState<FollowSearchResult[] | null>(null);
  const [friends, setFriends] = useState<FollowSearchResult[] | null>(null);
  const [followingError, setFollowingError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [results, setResults] = useState<FollowSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Keyed by followId (requests) or user id (search/suggested results) --
  // disables just the one row's button(s) while its action is in flight,
  // rather than freezing the whole screen.
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const openProfile = (userId: string) => navigation.navigate('PersonProfile', { userId });

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

  const loadFollowing = useCallback(async () => {
    if (!accessToken || !userId) return;
    setFollowingError(null);
    try {
      const [followers, followed] = await Promise.all([
        listPersonFollowers(accessToken, userId),
        listPersonFollowing(accessToken, userId),
      ]);
      setFollowing(followed);
      // Each once, by name -- each carrying your own follow of them, so someone who follows you
      // whom you don't follow back offers Follow.
      const byId = new Map<string, FollowSearchResult>();
      for (const person of [...followed, ...followers]) {
        if (!byId.has(person.user.id)) byId.set(person.user.id, person);
      }
      setFriends(
        Array.from(byId.values()).sort((a, b) =>
          personLabel(a.user).title.localeCompare(personLabel(b.user).title, undefined, {
            sensitivity: 'base',
          }),
        ),
      );
    } catch (err) {
      setFollowingError(err instanceof Error ? err.message : 'Failed to load your friends');
    }
  }, [accessToken, userId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void loadRequests();
      void loadFollowing();
    });
    return unsubscribe;
  }, [navigation, loadRequests, loadFollowing]);

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

  // The search results' Follow / Requested / Following -- kept on the row it came from.
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
          onPress={() =>
            confirmUnfollow(unfollowName(result.user), () => onUnfollow(result.user.id))
          }
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

  function renderResultRow(
    result: FollowSearchResult,
    testIDPrefix: string,
    index: number,
    trailing: ReactNode,
  ) {
    const { title, subtitle } = rowLabel(result.user);
    return (
      <ListRow
        key={result.user.id}
        testID={`${testIDPrefix}-${result.user.id}`}
        divider={index > 0}
        onPress={() => openProfile(result.user.id)}
        accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ''}, open profile`}
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
              { key: 'following', label: 'Following', icon: 'user-check' },
              {
                key: 'requests',
                label: requests.length > 0 ? `Requests (${requests.length})` : 'Requests',
                icon: 'inbox',
              },
            ]}
            active={tab}
            onSelect={setTab}
            accentColor={accent}
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
      {tab === 'following' ? (
        followingError ? (
          <ErrorState
            testID="find-people-following-error"
            message={followingError}
            onRetry={loadFollowing}
          />
        ) : following === null ? (
          <SkeletonRows testID="find-people-following-loading" count={6} />
        ) : following.length === 0 ? (
          <EmptyState
            testID="find-people-following-empty"
            title="Not following anyone yet"
            description="People you follow show here once they accept your request."
            action={{
              label: 'Find People',
              onPress: () => setTab('friends'),
              testID: 'find-people-following-find',
            }}
          />
        ) : (
          <AppCard testID="find-people-following-card">
            <SectionHeader
              label={`You follow ${following.length} ${following.length === 1 ? 'person' : 'people'}`}
            />
            <PeopleList
              people={following}
              selfId={userId ?? ''}
              onOpen={openProfile}
              testIDPrefix="find-people-following"
            />
          </AppCard>
        )
      ) : tab === 'requests' ? (
        requestsLoading ? (
          <SkeletonRows testID="find-people-requests-loading" count={4} />
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
                  onPress={() => openProfile(request.user.id)}
                  accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ''}, open profile`}
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
            <SkeletonRows testID="find-people-search-loading" count={4} />
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
                { key: 'friends', label: 'Your Friends', icon: 'users' },
                { key: 'suggested', label: 'Suggested', icon: 'star' },
              ]}
              active={friendsSubTab}
              onSelect={setFriendsSubTab}
              accentColor={accent}
            />
          </View>

          {friendsSubTab === 'suggested' ? (
            <ContactSuggestions onOpen={openProfile} />
          ) : followingError ? (
            <ErrorState
              testID="find-people-friends-error"
              message={followingError}
              onRetry={loadFollowing}
            />
          ) : friends === null ? (
            <SkeletonRows testID="find-people-friends-loading" count={6} />
          ) : friends.length === 0 ? (
            <EmptyState
              testID="find-people-friends-empty"
              title="No friends yet"
              description="People who follow you, and people you follow, show here."
              action={{
                label: 'See Suggested',
                onPress: () => setFriendsSubTab('suggested'),
                testID: 'find-people-friends-suggested',
              }}
            />
          ) : (
            <AppCard testID="find-people-friends-card">
              <SectionHeader
                label={`${friends.length} ${friends.length === 1 ? 'friend' : 'friends'}`}
              />
              <PeopleList
                people={friends}
                selfId={userId ?? ''}
                onOpen={openProfile}
                testIDPrefix="find-people-friend"
              />
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
