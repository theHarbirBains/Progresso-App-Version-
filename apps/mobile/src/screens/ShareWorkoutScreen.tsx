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
import { STORY_CANVAS, STORY_CAPTURE, ShareStory } from '../sharing/ShareCard';
import { fetchShareCardData, type ShareCardData } from '../sharing/shareCardData';
import { shareCardStyles as styles } from '../sharing/shareCardStyles';
import { SkeletonCards } from '../design/Skeleton';

type Props = RootStackScreenProps<'ShareWorkout'>;

// A finished workout as a story image (9:16) for Instagram, TikTok and the
// like: the screen is just the card and Share. The card on screen IS
// the view that gets captured (via cardRef) -- it is always laid out at its
// one story size and only the preview is scaled to fit the phone, so the
// image never depends on the device. The image is made on the phone and only
// leaves through the system share sheet, where the user picks the app (and
// can also save it) -- nothing is uploaded.
export function ShareWorkoutScreen({ route, navigation }: Props) {
  const { workoutId } = route.params;
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const { theme, weightUnit } = useProgressTheme();

  const cardRef = useRef<ViewInstance>(null);

  const [cardData, setCardData] = useState<ShareCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // How much the preview is shrunk to fit the space above the button (never enlarged).
  const [previewScale, setPreviewScale] = useState<number | null>(null);

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

  function handleStageLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setPreviewScale(Math.min(1, width / STORY_CANVAS.width, height / STORY_CANVAS.height));
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

  const scale = previewScale ?? 0;

  return (
    <Screen scroll={false} contentContainerStyle={styles.content} header={header}>
      <View testID="share-card-stage" style={styles.stage} onLayout={handleStageLayout}>
        {/* Shrinks the preview only: the story inside keeps its own size, so the captured image is the same on every phone. Rounded like a phone screen -- the image itself is square. */}
        <View
          testID="share-card-preview"
          style={{
            width: STORY_CANVAS.width * scale,
            height: STORY_CANVAS.height * scale,
            borderRadius: radii.lg,
            overflow: 'hidden',
            opacity: previewScale === null ? 0 : 1,
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
              storyRef={cardRef}
              data={cardData}
              weightUnit={weightUnit}
              accentColor={theme.accent}
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
