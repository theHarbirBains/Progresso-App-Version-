import { useCallback, useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { SkeletonRows } from '../design/Skeleton';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { sentFromText } from '../feedback/deviceInfo';
import { FeedbackStatusBadge } from '../feedback/FeedbackStatusBadge';
import {
  CATEGORY_LABELS,
  FEEDBACK_STATUSES,
  STATUS_LABELS,
  type FeedbackStatus,
} from '../feedback/feedbackLabels';
import { feedbackStyles as styles } from '../feedback/feedbackStyles';
import { senderName } from '../feedback/senderName';
import { StatusHistory } from '../feedback/StatusHistory';
import {
  addFeedbackNote,
  fetchFeedbackReview,
  updateFeedbackStatus,
  type FeedbackReview,
} from '../lib/feedbackApi';
import type { RootStackScreenProps } from '../navigation/types';
import { settingsStyles } from '../settings/settingsStyles';
import { useAppTheme } from '../theme/appThemeContext';
import { formatShortDate } from '../workouts/workoutFormat';

type Props = RootStackScreenProps<'AdminFeedbackReview'>;

const NOTE_MAX = 4000;

/**
 * One submission, for an admin: what was sent and by whom, its screenshot (a 10-minute link), the
 * app version and platform, its status -- Change Status opens the six in a sheet -- and its
 * history, then the internal notes, which only admins ever see, with a field to add one. Every
 * change and note is recorded by the API (admin_actions).
 */
export function AdminFeedbackReviewScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const { accent } = useAppTheme();
  const [review, setReview] = useState<FeedbackReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const [note, setNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      setReview(await fetchFeedbackReview(accessToken, id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this feedback');
    }
  }, [accessToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeStatus(status: FeedbackStatus) {
    if (!accessToken || changing) return;
    setStatusOpen(false);
    if (status === review?.status) return;
    setChanging(true);
    setActionError(null);
    try {
      setReview(await updateFeedbackStatus(accessToken, id, status));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'The status could not be changed');
    } finally {
      setChanging(false);
    }
  }

  async function handleAddNote() {
    const body = note.trim();
    if (!accessToken || !body || addingNote) return;
    setAddingNote(true);
    setActionError(null);
    try {
      setReview(await addFeedbackNote(accessToken, id, body));
      setNote('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'The note could not be added');
    } finally {
      setAddingNote(false);
    }
  }

  const device = review
    ? sentFromText({
        appVersion: review.appVersion ?? undefined,
        buildNumber: review.buildNumber ?? undefined,
        platform:
          review.platform === 'ios' || review.platform === 'android' ? review.platform : undefined,
        osVersion: review.osVersion ?? undefined,
      })
    : '';

  return (
    <Screen
      testID="admin-feedback-review-screen"
      scrollTestID="admin-feedback-review-scroll"
      keyboardAvoiding
      contentContainerStyle={settingsStyles.categoryGap}
      header={
        <AppHeader
          testID="admin-feedback-review-header"
          title="Review Feedback"
          onBack={() => navigation.goBack()}
        />
      }
    >
      {!review && !error ? (
        <SkeletonRows testID="admin-feedback-review-loading" count={5} />
      ) : !review ? (
        <ErrorState
          testID="admin-feedback-review-error"
          message={error!}
          onRetry={() => void load()}
        />
      ) : (
        <>
          <View testID="admin-feedback-review-summary">
            <View style={styles.headRow}>
              <View style={styles.headText}>
                <Text style={styles.title}>{review.title}</Text>
                <Text style={styles.meta}>
                  {CATEGORY_LABELS[review.category]} · {senderName(review.sender)} ·{' '}
                  {formatShortDate(review.createdAt)}
                </Text>
              </View>
              <FeedbackStatusBadge testID="admin-feedback-review-status" status={review.status} />
            </View>
            <Text testID="admin-feedback-review-description" style={styles.body}>
              {review.description}
            </Text>
            {review.screenshotUrl ? (
              <Image
                testID="admin-feedback-review-screenshot"
                source={{ uri: review.screenshotUrl }}
                style={styles.screenshot}
                resizeMode="contain"
                accessibilityLabel="Their screenshot"
              />
            ) : null}
            {device ? (
              <Text testID="admin-feedback-review-sent-from" style={[styles.caption, styles.body]}>
                Sent with {device}.
              </Text>
            ) : null}
          </View>

          <View style={styles.alignStart}>
            <SecondaryButton
              testID="admin-feedback-change-status"
              label={changing ? 'Changing…' : 'Change Status'}
              icon="flag"
              size="md"
              onPress={() => setStatusOpen(true)}
            />
          </View>

          <StatusHistory testID="admin-feedback-history" history={review.history} />

          <Section title="Internal Notes">
            <View style={styles.gapMedium}>
              <Text style={styles.caption}>
                Only admins see these, never the person who sent it.
              </Text>
              {review.notes.map((entry) => (
                <View key={entry.id} testID={`admin-feedback-note-${entry.id}`}>
                  <Text style={styles.historyDate}>
                    {entry.author?.displayName ?? 'An admin'} · {formatShortDate(entry.createdAt)}
                  </Text>
                  <Text style={styles.historyStatus}>{entry.body}</Text>
                </View>
              ))}
              <TextInput
                testID="admin-feedback-note-input"
                label="Add a note"
                placeholder="What's been found, decided or done"
                value={note}
                onChangeText={setNote}
                maxLength={NOTE_MAX}
                multiline
                autoCapitalize="sentences"
              />
              <PrimaryButton
                testID="admin-feedback-note-add"
                label="Add Note"
                onPress={() => void handleAddNote()}
                loading={addingNote}
                disabled={!note.trim() && !addingNote}
                accentColor={accent.accent}
                onAccentColor={accent.onAccent}
              />
            </View>
          </Section>

          {actionError ? (
            <Text testID="admin-feedback-review-action-error" style={styles.error}>
              {actionError}
            </Text>
          ) : null}

          <BottomSheet
            testID="admin-feedback-status-sheet"
            visible={statusOpen}
            onClose={() => setStatusOpen(false)}
          >
            <Section title="Status">
              {FEEDBACK_STATUSES.map((status, index) => (
                <ListRow
                  key={status}
                  testID={`admin-feedback-status-${status}`}
                  title={STATUS_LABELS[status]}
                  divider={index > 0}
                  chevron={false}
                  trailing={
                    status === review.status ? (
                      <Feather name="check" size={18} color={accent.accent} />
                    ) : undefined
                  }
                  onPress={() => void changeStatus(status)}
                  accessibilityLabel={`${STATUS_LABELS[status]}${status === review.status ? ', current' : ''}`}
                />
              ))}
            </Section>
          </BottomSheet>
        </>
      )}
    </Screen>
  );
}
