import { useCallback, useEffect, useRef, useState } from 'react';
import { View, type LayoutChangeEvent, type ViewInstance } from 'react-native';
import { Text } from '../design/Text';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { radii } from '../design/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { STORY_CANVAS, STORY_CAPTURE, ShareStory, type CardRect } from '../sharing/ShareCard';
import { fetchShareCardData, type ShareCardData } from '../sharing/shareCardData';
import { shareCardStyles as styles } from '../sharing/shareCardStyles';
import { SkeletonCards } from '../design/Skeleton';
import { useProfile } from '../profile/ProfileProvider';
import { useReminders } from '../notifications/remindersContext';
import { prCheer, showPrCheer } from '../notifications/reminderScheduler';

type Props = RootStackScreenProps<'ShareWorkout'>;

/** The story's background shown around the card in the preview, in canvas points. */
const PREVIEW_MARGIN = 14;
/** How far the preview may enlarge the card: past this its text would start to soften. */
const MAX_PREVIEW_SCALE = 1.4;

// A finished workout as a story image (9:16) for Instagram, TikTok and the
// like: the screen is just the card and Share. The story on screen IS
// the view that gets captured (via cardRef) -- it is always laid out at its
// one story size, so the image never depends on the device -- and the
// preview shows the card itself, close up: the story is scaled so the card
// (with a little of the background around it) fills the room above Share,
// the rest of the canvas out of view. The image is made on the phone and only
// leaves through the system share sheet, where the user picks the app (and
// can also save it) -- nothing is uploaded. Opened as the workout is finished, a new PR in it is
// cheered with a notification ("KEEP GOING, HARBIR!"), when PR Cheers is on.
export function ShareWorkoutScreen({ route, navigation }: Props) {
  const { workoutId, justFinished = false } = route.params;
  const { profile } = useProfile();
  const reminders = useReminders();
  const cheered = useRef(false);
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const { theme, weightUnit } = useProgressTheme();

  const cardRef = useRef<ViewInstance>(null);

  const [cardData, setCardData] = useState<ShareCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The room above the button, and where the card sits on the story: the preview fits the card.
  const [stage, setStage] = useState<{ width: number; height: number } | null>(null);
  const [cardRect, setCardRect] = useState<CardRect | null>(null);

  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId || !accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchShareCardData(workoutId, userId);
      setCardData(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load workout');
    } finally {
      setLoading(false);
    }
  }, [workoutId, userId, accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  // Once, as the finished workout's figures arrive -- the PR labels are worked out with them.
  useEffect(() => {
    if (!justFinished || !cardData || cheered.current) return;
    if (!reminders.active || !reminders.settings?.prCheers.on) return;
    cheered.current = true;
    const firstName = profile?.displayName?.trim().split(/\s+/)[0] || null;
    const cheer = prCheer(firstName, cardData.workoutName, cardData.topSets, weightUnit);
    if (cheer) void showPrCheer(cheer);
  }, [justFinished, cardData, reminders.active, reminders.settings, profile, weightUnit]);

  function handleStageLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setStage({ width, height });
  }

  async function handleShare() {
    setShareError(null);
    setSharing(true);
    try {
      if (!cardRef.current) throw new Error('Card is not ready yet');
      const uri = await captureRef(cardRef, {
        ...STORY_CAPTURE,
        format: 'png',
        quality: 1,
      });
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setShareError('Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
    } catch (err) {
      // Covers real capture/share failures. Neither iOS nor Android reject
      // shareAsync's promise on a plain user dismissal of the share sheet,
      // so anything that does land here is a genuine failure, not a cancel.
      setShareError(err instanceof Error ? err.message : 'Failed to share workout');
    } finally {
      setSharing(false);
    }
  }

  const header = (
    <AppHeader
      title="Share Workout"
      // Sharing slides up as a short task (navigationTransitions.ts), so it
      // closes rather than going back.
      leftAction={{
        icon: 'x',
        onPress: () => navigation.goBack(),
        accessibilityLabel: 'Close',
        testID: 'share-workout-close',
      }}
    />
  );

  if (loading) {
    return (
      <Screen scroll={false} header={header}>
        <SkeletonCards testID="share-workout-loading" heights={[480]} />
      </Screen>
    );
  }

  if (loadError || !cardData) {
    return (
      <Screen scroll={false} header={header}>
        <Text testID="share-workout-load-error" style={styles.errorText}>
          {loadError ?? 'Failed to load workout'}
        </Text>
        <SecondaryButton testID="share-workout-retry" label="Retry" onPress={load} />
      </Screen>
    );
  }

  // What the preview shows: the card and a margin of the story around it -- the whole story until
  // the card has been laid out -- as large as the room allows.
  const region = cardRect
    ? {
        x: Math.max(0, cardRect.x - PREVIEW_MARGIN),
        y: Math.max(0, cardRect.y - PREVIEW_MARGIN),
        width: Math.min(STORY_CANVAS.width, cardRect.width + 2 * PREVIEW_MARGIN),
        height: Math.min(STORY_CANVAS.height, cardRect.height + 2 * PREVIEW_MARGIN),
      }
    : { x: 0, y: 0, width: STORY_CANVAS.width, height: STORY_CANVAS.height };
  const scale = stage
    ? Math.min(
        cardRect ? MAX_PREVIEW_SCALE : 1,
        stage.width / region.width,
        stage.height / region.height,
      )
    : 0;

  return (
    <Screen scroll={false} contentContainerStyle={styles.content} header={header}>
      <View testID="share-card-stage" style={styles.stage} onLayout={handleStageLayout}>
        {/* Scales the preview only: the story inside keeps its own size, so the captured image is the same on every phone. Rounded, the background shown around the card. */}
        <View
          testID="share-card-preview"
          style={{
            width: region.width * scale,
            height: region.height * scale,
            borderRadius: radii.lg,
            overflow: 'hidden',
            opacity: stage === null ? 0 : 1,
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: (STORY_CANVAS.width * scale - STORY_CANVAS.width) / 2 - region.x * scale,
              top: (STORY_CANVAS.height * scale - STORY_CANVAS.height) / 2 - region.y * scale,
              transform: [{ scale }],
            }}
          >
            <ShareStory
              storyRef={cardRef}
              data={cardData}
              weightUnit={weightUnit}
              accentColor={theme.accent}
              onCardLayout={setCardRect}
            />
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          testID="share-workout-share"
          label="Share"
          loading={sharing}
          onPress={handleShare}
          accentColor={theme.accent}
          onAccentColor={theme.onAccent}
        />
        {shareError ? (
          <Text testID="share-workout-share-error" style={styles.actionError}>
            {shareError}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
