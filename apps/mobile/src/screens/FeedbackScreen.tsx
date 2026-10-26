import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { SkeletonRows } from '../design/Skeleton';
import { FeedbackStatusBadge } from '../feedback/FeedbackStatusBadge';
import { CATEGORY_LABELS } from '../feedback/feedbackLabels';
import { fetchMyFeedback } from '../feedback/feedbackQueries';
import type { FeedbackSubmission } from '../lib/feedbackApi';
import type { RootStackScreenProps } from '../navigation/types';
import { settingsStyles } from '../settings/settingsStyles';
import { useAppTheme } from '../theme/appThemeContext';
import { formatShortDate } from '../workouts/workoutFormat';

type Props = RootStackScreenProps<'Feedback'>;

/**
 * Feedback & Suggestions (Settings > Support & About): one filled Send Feedback, then everything
 * the person has sent, newest first, each with its status -- read on every visit, so feedback
 * just sent, or a status an admin moved on, shows at once. Only theirs: Supabase's RLS.
 */
export function FeedbackScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id;
  const { accent } = useAppTheme();
  const [items, setItems] = useState<FeedbackSubmission[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      setItems(await fetchMyFeedback(userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your feedback');
    }
  }, [userId]);

  useEffect(() => navigation.addListener('focus', () => void load()), [navigation, load]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen
      testID="feedback-screen"
      scrollTestID="feedback-scroll"
      contentContainerStyle={settingsStyles.categoryGap}
      header={
        <AppHeader
          testID="feedback-header"
          title="Feedback & Suggestions"
          onBack={() => navigation.goBack()}
        />
      }
    >
      <PrimaryButton
        testID="feedback-send"
        label="Send Feedback"
        icon="edit-3"
        onPress={() => navigation.navigate('FeedbackForm')}
        accentColor={accent.accent}
        onAccentColor={accent.onAccent}
      />

      {items === null && !error ? (
        <SkeletonRows testID="feedback-loading" count={3} />
      ) : items === null ? (
        <ErrorState testID="feedback-error" message={error!} onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <EmptyState
          testID="feedback-empty"
          title="Nothing sent yet"
          description="Report a bug, suggest a feature, or tell us what's hard to use. You'll see what happens to it here."
        />
      ) : (
        <Section title="Your Feedback">
          <View>
            {items.map((item, index) => (
              <ListRow
                key={item.id}
                testID={`feedback-item-${item.id}`}
                title={item.title}
                subtitle={`${CATEGORY_LABELS[item.category]} · ${formatShortDate(item.createdAt)}`}
                trailing={<FeedbackStatusBadge status={item.status} />}
                divider={index > 0}
                onPress={() => navigation.navigate('FeedbackDetail', { id: item.id })}
                accessibilityLabel={`${item.title}, ${CATEGORY_LABELS[item.category]}, sent ${formatShortDate(item.createdAt)}`}
              />
            ))}
          </View>
        </Section>
      )}
    </Screen>
  );
}
