import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { fromKg, roundWeight } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { fetchShareCardData, type ShareCardData } from '../sharing/shareCardData';
import { shareCardStyles as styles } from '../sharing/shareCardStyles';

type Props = RootStackScreenProps<'ShareWorkout'>;

// Final image resolution -- independent of the on-screen card's dp size.
// react-native-view-shot resizes the capture to these dimensions regardless
// of the rendered View's bounds, so the preview below can stay a comfortable
// screen size while the shared/saved file is always a clean 9:16 story image.
const CAPTURE_WIDTH = 1080;
const CAPTURE_HEIGHT = 1920;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatWeight(kg: number, unit: 'kg' | 'lb'): string {
  const value = roundWeight(fromKg(kg, unit));
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

// The on-screen card below IS the view that gets captured (via cardRef) --
// there is no separate image drawn for sharing than what the user previews.
export function ShareWorkoutScreen({ route, navigation }: Props) {
  const { workoutId } = route.params;
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;

  const cardRef = useRef<View>(null);

  const [cardData, setCardData] = useState<ShareCardData | null>(null);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [data, profile] = await Promise.all([
        fetchShareCardData(workoutId, userId),
        getMyProfile(accessToken),
      ]);
      setCardData(data);
      setWeightUnit(profile.weightUnit);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load workout');
    } finally {
      setLoading(false);
    }
  }, [workoutId, userId, accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function captureCard(): Promise<string> {
    if (!cardRef.current) throw new Error('Card is not ready yet');
    return captureRef(cardRef, {
      width: CAPTURE_WIDTH,
      height: CAPTURE_HEIGHT,
      format: 'png',
      quality: 1,
    });
  }

  async function handleShare() {
    setShareError(null);
    setSaved(false);
    setSharing(true);
    try {
      const uri = await captureCard();
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

  async function handleSave() {
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    try {
      const uri = await captureCard();
      // Write-only permission: this screen only ever adds a photo, never
      // reads the library, so it never asks for more access than it needs.
      let permission = await MediaLibrary.getPermissionsAsync(true);
      if (!permission.granted && permission.canAskAgain) {
        permission = await MediaLibrary.requestPermissionsAsync(true);
      }
      if (!permission.granted) {
        setSaveError('Permission to save photos was denied.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save image');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator testID="share-workout-loading" size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (loadError || !cardData) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text testID="share-workout-load-error" style={styles.error}>
          {loadError ?? 'Failed to load workout'}
        </Text>
        <TouchableOpacity testID="share-workout-retry" style={styles.retryButton} onPress={load}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const prTopSets = cardData.topSets.filter((s) => s.prLabel !== null);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Share Workout</Text>
        <TouchableOpacity testID="share-workout-back" onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardWrapper}>
        <View ref={cardRef} collapsable={false} testID="share-card" style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.wordmark}>PROGRESSO</Text>
            <Text testID="share-card-workout-name" style={styles.workoutName} numberOfLines={2}>
              {cardData.workoutName}
            </Text>
            <Text testID="share-card-date" style={styles.workoutDate}>
              {formatDate(cardData.performedAt)}
            </Text>
            {cardData.musclesTrained ? (
              <Text testID="share-card-muscles" style={styles.musclesTrained}>
                {cardData.musclesTrained}
              </Text>
            ) : null}
          </View>

          {cardData.topSets.length > 0 ? (
            <View style={styles.topSetsSection}>
              <Text style={styles.sectionLabel}>TOP SETS</Text>
              {cardData.topSets.map((set, index) => (
                <View key={`${set.exerciseName}-${index}`} style={styles.topSetRow}>
                  <Text style={styles.topSetExercise} numberOfLines={1}>
                    {set.exerciseName}
                  </Text>
                  <Text testID={`share-card-top-set-${index}`} style={styles.topSetValue}>
                    {formatWeight(set.weightKg, weightUnit)}
                    {weightUnit}×{set.reps}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {prTopSets.length > 0 ? (
            <View testID="share-card-pr-section" style={styles.prSection}>
              <Text style={styles.sectionLabel}>PRS ACHIEVED</Text>
              {prTopSets.map((set, index) => (
                <Text key={`${set.exerciseName}-pr-${index}`} style={styles.prLine}>
                  {set.exerciseName} · {set.prLabel}
                </Text>
              ))}
            </View>
          ) : null}

          {cardData.durationMinutes !== null ? (
            <Text testID="share-card-duration" style={styles.footer}>
              {cardData.durationMinutes} min
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          testID="share-workout-share"
          style={[styles.actionButton, sharing && styles.actionButtonDisabled]}
          disabled={sharing}
          onPress={handleShare}
        >
          <Text style={styles.actionButtonText}>{sharing ? 'Preparing…' : 'Share'}</Text>
        </TouchableOpacity>
        {shareError ? (
          <Text testID="share-workout-share-error" style={styles.actionError}>
            {shareError}
          </Text>
        ) : null}

        <TouchableOpacity
          testID="share-workout-save"
          style={[styles.secondaryActionButton, saving && styles.actionButtonDisabled]}
          disabled={saving}
          onPress={handleSave}
        >
          <Text style={styles.secondaryActionButtonText}>
            {saving ? 'Saving…' : 'Save to Photos'}
          </Text>
        </TouchableOpacity>
        {saveError ? (
          <Text testID="share-workout-save-error" style={styles.actionError}>
            {saveError}
          </Text>
        ) : null}
        {saved ? (
          <Text testID="share-workout-saved" style={styles.savedText}>
            Saved to Photos
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}
