import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View, type LayoutChangeEvent } from 'react-native';
import { Text } from '../design/Text';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { colors } from '../design/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { STORY_CAPTURE, STORY_CARD, ShareCard } from '../sharing/ShareCard';
import { fetchShareCardData, type ShareCardData } from '../sharing/shareCardData';
import { shareCardStyles as styles } from '../sharing/shareCardStyles';

type Props = RootStackScreenProps<'ShareWorkout'>;

// A finished workout as a story image (9:16) for Instagram, TikTok and the
// like: the screen is just the card and Share to Story. The card on screen IS
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

  const cardRef = useRef<View>(null);

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
    setPreviewScale(Math.min(1, width / STORY_CARD.width, height / STORY_CARD.height));
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
        <View style={styles.loading}>
          <ActivityIndicator
            testID="share-workout-loading"
            size="large"
            color={colors.textPrimary}
          />
        </View>
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
        {/* Shrinks the preview only: the card inside keeps its own story size, so the captured image is the same on every phone. */}
        <View
          testID="share-card-preview"
          style={{
            width: STORY_CARD.width * scale,
            height: STORY_CARD.height * scale,
            opacity: previewScale === null ? 0 : 1,
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: (STORY_CARD.width * scale - STORY_CARD.width) / 2,
              top: (STORY_CARD.height * scale - STORY_CARD.height) / 2,
              transform: [{ scale }],
            }}
          >
            <ShareCard
              cardRef={cardRef}
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
          label="Share to Story"
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
