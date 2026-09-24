import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '../design/Text';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { SegmentedControl } from '../design/SegmentedControl';
import { Section } from '../design/Section';
import { Toggle } from '../design/Toggle';
import { colors } from '../design/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { ShareCard } from '../sharing/ShareCard';
import { fetchShareCardData, type ShareCardData } from '../sharing/shareCardData';
import {
  DEFAULT_SHARE_OPTIONS,
  SHARE_FORMATS,
  type ShareFormat,
  type ShareOptions,
} from '../sharing/shareCardOptions';
import { shareCardStyles as styles } from '../sharing/shareCardStyles';

type Props = RootStackScreenProps<'ShareWorkout'>;

const FORMAT_OPTIONS = (Object.keys(SHARE_FORMATS) as ShareFormat[]).map((value) => ({
  label: SHARE_FORMATS[value].label,
  value,
}));

// The blocks the user can hide, in the order they appear on the card.
const OPTION_ROWS: { key: keyof ShareOptions; label: string; subtitle?: string }[] = [
  { key: 'date', label: 'Date', subtitle: 'Shown without the year' },
  { key: 'duration', label: 'Duration' },
  { key: 'sets', label: 'Sets' },
  { key: 'volume', label: 'Total volume', subtitle: 'The total weight you lifted' },
  { key: 'lifts', label: 'Top lifts' },
  { key: 'records', label: 'Personal records' },
];

// A finished workout as a shareable image. The card on screen IS the view that
// gets captured (via cardRef) -- there is no separate image drawn for sharing
// than what the user previews. Everything about it is the user's to control:
// Story or Feed size, which blocks show (total volume starts hidden), and an
// optional photo of their own behind it. The image is made on the phone and
// only leaves through the system share sheet or Save to Photos -- nothing is
// uploaded, and the photo is used for this image only, never stored.
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

  const [format, setFormat] = useState<ShareFormat>('story');
  const [options, setOptions] = useState<ShareOptions>(DEFAULT_SHARE_OPTIONS);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

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

  async function captureCard(): Promise<string> {
    if (!cardRef.current) throw new Error('Card is not ready yet');
    const spec = SHARE_FORMATS[format];
    return captureRef(cardRef, {
      width: spec.captureWidth,
      height: spec.captureHeight,
      format: 'png',
      quality: 1,
    });
  }

  function setOption(key: keyof ShareOptions, value: boolean) {
    setSaved(false);
    setOptions((prev) => ({ ...prev, [key]: value }));
  }

  async function handleChoosePhoto() {
    setPhotoError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotoError('Photo library permission is required to choose a background photo.');
      return;
    }
    const spec = SHARE_FORMATS[format];
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      // The picker's own crop step frames the photo to the card.
      allowsEditing: true,
      aspect: [spec.captureWidth, spec.captureHeight],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    setSaved(false);
    setPhotoUri(result.assets[0].uri);
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

  const header = (
    <AppHeader
      title="Share Workout"
      leftAction={{
        icon: 'arrow-left',
        onPress: () => navigation.goBack(),
        accessibilityLabel: 'Back',
        testID: 'share-workout-back',
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

  return (
    <Screen contentContainerStyle={styles.content} header={header}>
      <View style={styles.formatWrap}>
        <SegmentedControl
          testID="share-format"
          options={FORMAT_OPTIONS}
          value={format}
          onChange={(next) => {
            setSaved(false);
            setFormat(next);
          }}
          accentColor={theme.accent}
          onAccentColor={theme.onAccent}
        />
      </View>

      <View style={styles.previewWrap}>
        <ShareCard
          cardRef={cardRef}
          data={cardData}
          weightUnit={weightUnit}
          format={format}
          options={options}
          accentColor={theme.accent}
          photoUri={photoUri}
        />
      </View>

      <Section title="Background">
        <ListRow
          testID="share-photo-choose"
          icon="image"
          title="Background photo"
          value={photoUri ? 'Custom' : 'None'}
          onPress={handleChoosePhoto}
        />
        {photoUri ? (
          <ListRow
            testID="share-photo-remove"
            icon="trash-2"
            title="Remove photo"
            destructive
            chevron={false}
            divider
            onPress={() => {
              setSaved(false);
              setPhotoUri(null);
            }}
          />
        ) : null}
        {photoError ? (
          <Text testID="share-photo-error" style={styles.actionError}>
            {photoError}
          </Text>
        ) : null}
      </Section>

      <Section title="Show on card">
        {OPTION_ROWS.map((row, index) => (
          <ListRow
            key={row.key}
            testID={`share-option-${row.key}`}
            title={row.label}
            subtitle={row.subtitle}
            divider={index > 0}
            trailing={
              <Toggle
                testID={`share-toggle-${row.key}`}
                value={options[row.key]}
                onValueChange={(value) => setOption(row.key, value)}
                accentColor={theme.accent}
                accessibilityLabel={row.label}
              />
            }
          />
        ))}
        <Text style={styles.privacyNote}>
          Made on your phone and only shared if you tap Share. Your name, email and location are
          never included.
        </Text>
      </Section>

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

        <SecondaryButton
          testID="share-workout-save"
          label="Save to Photos"
          loading={saving}
          onPress={handleSave}
        />
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
    </Screen>
  );
}
