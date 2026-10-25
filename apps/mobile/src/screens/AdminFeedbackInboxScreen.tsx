import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { TextButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { FilterChips } from '../design/FilterChips';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { SkeletonRows } from '../design/Skeleton';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors } from '../design/theme';
import { FeedbackStatusBadge } from '../feedback/FeedbackStatusBadge';
import {
  CATEGORY_SHORT_LABELS,
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  STATUS_LABELS,
  feedbackDate,
  type FeedbackCategory,
  type FeedbackStatus,
} from '../feedback/feedbackLabels';
import { feedbackStyles as styles } from '../feedback/feedbackStyles';
import { senderName } from '../feedback/senderName';
import { fetchFeedbackInbox, type FeedbackInbox } from '../lib/feedbackApi';
import type { RootStackScreenProps } from '../navigation/types';
import { settingsStyles } from '../settings/settingsStyles';
import { useAppTheme } from '../theme/appThemeContext';

type Props = RootStackScreenProps<'AdminFeedbackInbox'>;

const SEARCH_DEBOUNCE_MS = 300;

/**
 * The feedback inbox, for support and full admins (Settings > Admin): search, a status filter with
 * how many there are of each, a category filter, then every submission newest first -- title,
 * category, who sent it and when, its status -- each opening its review. Read on every visit, so a
 * status changed one hop away shows at once; Load More reads further back. The API refuses anyone
 * else, whatever the app shows.
 */
export function AdminFeedbackInboxScreen({ navigation }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const { accent } = useAppTheme();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<FeedbackStatus | 'all'>('all');
  const [category, setCategory] = useState<FeedbackCategory | 'all'>('all');
  const [inbox, setInbox] = useState<FeedbackInbox | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // Only the latest read is kept, so a quick change of filters never shows an older one's results.
  const latest = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filters = useCallback(
    () => ({
      ...(status !== 'all' ? { status } : {}),
      ...(category !== 'all' ? { category } : {}),
      ...(search ? { q: search } : {}),
    }),
    [status, category, search],
  );

  const load = useCallback(async () => {
    if (!accessToken) return;
    const request = ++latest.current;
    setError(null);
    try {
      const result = await fetchFeedbackInbox(accessToken, filters());
      if (request === latest.current) setInbox(result);
    } catch (err) {
      if (request === latest.current) {
        setError(err instanceof Error ? err.message : 'Could not load the inbox');
      }
    }
  }, [accessToken, filters]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => navigation.addListener('focus', () => void load()), [navigation, load]);

  async function loadMore() {
    if (!accessToken || !inbox?.nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const more = await fetchFeedbackInbox(accessToken, {
        ...filters(),
        before: inbox.nextBefore,
      });
      setInbox((prev) => (prev ? { ...more, items: [...prev.items, ...more.items] } : more));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load more');
    } finally {
      setLoadingMore(false);
    }
  }

  const total = inbox ? FEEDBACK_STATUSES.reduce((sum, s) => sum + inbox.counts[s], 0) : null;
  const countLabel = (label: string, count: number | undefined) =>
    count === undefined ? label : `${label} · ${count}`;

  return (
    <Screen
      testID="admin-feedback-inbox-screen"
      scrollTestID="admin-feedback-inbox-scroll"
      contentContainerStyle={settingsStyles.categoryGap}
      header={
        <AppHeader
          testID="admin-feedback-inbox-header"
          title="Feedback Inbox"
          onBack={() => navigation.goBack()}
        />
      }
    >
      <View style={styles.gapMedium}>
        <TextInput
          testID="admin-feedback-search"
          placeholder="Search titles and descriptions"
          accessibilityLabel="Search feedback"
          value={searchInput}
          onChangeText={setSearchInput}
          autoCapitalize="none"
          leftAccessory={<Feather name="search" size={16} color={colors.textMuted} />}
        />
        <FilterChips
          testID="admin-feedback-status"
          options={[
            { value: 'all' as const, label: countLabel('All', total ?? undefined) },
            ...FEEDBACK_STATUSES.map((value) => ({
              value,
              label: countLabel(STATUS_LABELS[value], inbox?.counts[value]),
            })),
          ]}
          value={status}
          onChange={setStatus}
          accentColor={accent.accent}
          onAccentColor={accent.onAccent}
        />
        <FilterChips
          testID="admin-feedback-category"
          options={[
            { value: 'all' as const, label: 'Every Kind' },
            ...FEEDBACK_CATEGORIES.map((value) => ({ value, label: CATEGORY_SHORT_LABELS[value] })),
          ]}
          value={category}
          onChange={setCategory}
          accentColor={accent.accent}
          onAccentColor={accent.onAccent}
        />
      </View>

      {inbox === null && !error ? (
        <SkeletonRows testID="admin-feedback-loading" count={5} />
      ) : inbox === null ? (
        <ErrorState testID="admin-feedback-error" message={error!} onRetry={() => void load()} />
      ) : inbox.items.length === 0 ? (
        <EmptyState
          testID="admin-feedback-empty"
          title={
            search || status !== 'all' || category !== 'all' ? 'Nothing matches' : 'No feedback yet'
          }
        />
      ) : (
        <Section title="Feedback">
          <View>
            {inbox.items.map((item, index) => (
              <ListRow
                key={item.id}
                testID={`admin-feedback-item-${item.id}`}
                title={item.title}
                subtitle={`${CATEGORY_SHORT_LABELS[item.category]} · ${senderName(item.sender)} · ${feedbackDate(item.createdAt)}`}
                trailing={<FeedbackStatusBadge status={item.status} />}
                divider={index > 0}
                onPress={() => navigation.navigate('AdminFeedbackReview', { id: item.id })}
              />
            ))}
          </View>
          {error ? (
            <Text testID="admin-feedback-more-error" style={styles.error}>
              {error}
            </Text>
          ) : null}
          {inbox.nextBefore ? (
            <TextButton
              testID="admin-feedback-more"
              label={loadingMore ? 'Loading…' : 'Load More'}
              onPress={() => void loadMore()}
            />
          ) : null}
        </Section>
      )}
    </Screen>
  );
}
