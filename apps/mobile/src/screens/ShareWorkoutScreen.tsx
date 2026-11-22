import { useCallback, useEffect, useRef, useState } from 'react';
import { View, type LayoutChangeEvent, type ViewInstance } from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { SkeletonCards } from '../design/Skeleton';
import { Text } from '../design/Text';
import { radii } from '../design/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { prCheer, showPrCheer } from '../notifications/reminderScheduler';
import { useReminders } from '../notifications/remindersContext';
import { useProfile } from '../profile/ProfileProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
import { STORY_CANVAS, STORY_CAPTURE, ShareStory } from '../sharing/ShareCard';
import { fetchShareCardData, type ShareCardData } from '../sharing/shareCardData';
import { shareCardStyles as styles } from '../sharing/shareCardStyles';
import { useAppTheme } from '../theme/appThemeContext';

type Props = RootStackScreenProps<'ShareWorkout'>;

/** How far the preview may enlarge the story: past this its text would start to soften. */
const MAX_PREVIEW_SCALE = 1.2;

// A finished workout as a story image (9:16) for Instagram, TikTok and the like: the screen is the
// image and two ways out with it -- Share (the one filled button), which opens the system share
// sheet, and Save to Photos. The story on screen IS the view that gets captured (via storyRef):
// always laid out at its one size (360x640pt, captured at 1080x1920), so the image never depends
// on the device -- only the preview is scaled, to fill the room above the buttons. The image is
// made on the phone and only leaves through the share sheet or into the person's own Photos --
// nothing is uploaded. Opened as the workout is finished, a new PR in it is cheered with a
// notification ("KEEP GOING, HARBIR!"), when PR Cheers is on; the achievements it earned wait
// until this page is left (AchievementUnlockHost).
export function ShareWorkoutScreen({ route, navigation }: Props) {
  const { workoutId, justFinished = false } = route.params;
  const { profile } = useProfile();
  const reminders = useReminders();
  const cheered = useRef(false);
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const { theme, weightUnit } = useProgressTheme();
  // Through the holidays, the image is dressed for them too: lights, a hat, pines and a deer.
  const { decorating } = useAppTheme();

  const storyRef = useRef<ViewInstance>(null);

  const [cardData, setCardData] = useState<ShareCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The room above the buttons: the preview fills it.
  const [stage, setStage] = useState<{ width: number; height: number } | null>(null);

  const [busy, setBusy] = useState<'share' | 'save' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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

  /** The story as a 1080x1920 PNG on the phone. */
  async function captureStory(): Promise<string> {
    if (!storyRef.current) throw new Error('The card is not ready yet');
    return captureRef(storyRef, { ...STORY_CAPTURE, format: 'png', quality: 1 });
  }

  async function handleShare() {
    setActionError(null);
    setSaved(false);
    setBusy('share');
    try {
      const uri = await captureStory();
      if (!(await Sharing.isAvailableAsync())) {
        setActionError('Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
    } catch (err) {
      // Covers real capture/share failures. Neither iOS nor Android reject
      // shareAsync's promise on a plain user dismissal of the share sheet,
      // so anything that does land here is a genuine failure, not a cancel.
      setActionError(err instanceof Error ? err.message : 'Failed to share workout');
    } finally {
      setBusy(null);
    }
  }

  // Saved into the person's own Photos, asking first. Full access is asked for (not add-only):
  // the photo-library wording every build already carries covers it, so it can never be missing.
  async function handleSave() {
    setActionError(null);
    setSaved(false);
    setBusy('save');
    try {
      let permission = await MediaLibrary.getPermissionsAsync(false);
      if (!permission.granted && permission.canAskAgain) {
        permission = await MediaLibrary.requestPermissionsAsync(false);
      }
      if (!permission.granted) {
        setActionError('Allow Progresso to use Photos in iPhone Settings to save the card.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(await captureStory());
      setSaved(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to save the card');
    } finally {
      setBusy(null);
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

  // The whole image, as large as the room above the buttons allows.
  const scale = stage
    ? Math.min(
        MAX_PREVIEW_SCALE,
        stage.width / STORY_CANVAS.width,
        stage.height / STORY_CANVAS.height,
      )
    : 0;

  return (
    <Screen scroll={false} contentContainerStyle={styles.content} header={header}>
      <View testID="share-card-stage" style={styles.stage} onLayout={handleStageLayout}>
        {/* Scales the preview only: the story inside keeps its own size, so the captured image is the same on every phone. */}
        <View
          testID="share-card-preview"
          style={{
            width: STORY_CANVAS.width * scale,
            height: STORY_CANVAS.height * scale,
            borderRadius: radii.lg,
            overflow: 'hidden',
            opacity: stage === null ? 0 : 1,
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: (STORY_CANVAS.width * scale - STORY_CANVAS.width) / 2,
              top: (STORY_CANVAS.height * scale - STORY_CANVAS.height) / 2,
              transform: [{ scale }],
            }}
          >
            <ShareStory
              storyRef={storyRef}
              data={cardData}
              weightUnit={weightUnit}
              festive={decorating}
            />
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          testID="share-workout-share"
          label="Share"
          loading={busy === 'share'}
          disabled={busy !== null}
          onPress={handleShare}
          accentColor={theme.accent}
          onAccentColor={theme.onAccent}
        />
        <SecondaryButton
          testID="share-workout-save"
          label={saved ? 'Saved to Photos' : 'Save to Photos'}
          icon={saved ? 'check' : 'download'}
          loading={busy === 'save'}
          disabled={busy !== null}
          onPress={handleSave}
        />
        {actionError ? (
          <Text testID="share-workout-share-error" style={styles.actionError}>
            {actionError}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
