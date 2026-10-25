import { useMemo, useState } from 'react';
import { Image, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { SegmentedControl } from '../design/SegmentedControl';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { sentFrom, sentFromText } from '../feedback/deviceInfo';
import {
  CATEGORY_LABELS,
  CATEGORY_SHORT_LABELS,
  FEEDBACK_CATEGORIES,
  type FeedbackCategory,
} from '../feedback/feedbackLabels';
import { feedbackStyles as styles } from '../feedback/feedbackStyles';
import { removeUnsentScreenshot, uploadFeedbackScreenshot } from '../feedback/screenshotUpload';
import { sendFeedback } from '../lib/feedbackApi';
import type { RootStackScreenProps } from '../navigation/types';
import { settingsStyles } from '../settings/settingsStyles';
import { useAppTheme } from '../theme/appThemeContext';

type Props = RootStackScreenProps<'FeedbackForm'>;

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 4000;

const PROMPTS: Record<FeedbackCategory, string> = {
  bug: 'What happened, and what did you expect?',
  feature: 'What would you like Progresso to do?',
  usability: 'What was hard to find or use?',
  general: 'Tell us anything.',
};

/**
 * Sending feedback: what it's about (Bug / Feature / Usability / General), a title, a description,
 * an optional screenshot from the photo library, and -- shown, not asked -- the app version and
 * platform it's sent from. One filled Send, needing a title and a description; once sent, a thank
 * you. A screenshot uploads first, into the person's own folder; if the send then fails it's taken
 * back. Nothing sent can be changed or withdrawn afterwards.
 */
export function FeedbackFormScreen({ navigation }: Props) {
  const { user, session } = useAuth();
  const userId = user?.id;
  const accessToken = session?.access_token;
  const { accent } = useAppTheme();
  const device = useMemo(() => sentFrom(), []);
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const canSend = title.trim().length > 0 && description.trim().length > 0 && !sending;

  async function addScreenshot() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library permission is needed to add a screenshot.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setError(null);
    setScreenshotUri(result.assets[0].uri);
  }

  async function handleSend() {
    if (!canSend || !userId || !accessToken) return;
    setSending(true);
    setError(null);
    let screenshotPath: string | undefined;
    try {
      if (screenshotUri) screenshotPath = await uploadFeedbackScreenshot(userId, screenshotUri);
      await sendFeedback(accessToken, {
        category,
        title: title.trim(),
        description: description.trim(),
        ...(screenshotPath ? { screenshotPath } : {}),
        ...device,
      });
      setSent(true);
    } catch (err) {
      if (screenshotPath) void removeUnsentScreenshot(screenshotPath);
      setError(err instanceof Error ? err.message : 'Your feedback could not be sent');
    } finally {
      setSending(false);
    }
  }

  const header = (
    <AppHeader
      testID="feedback-form-header"
      title="Send Feedback"
      onBack={() => navigation.goBack()}
    />
  );

  if (sent) {
    return (
      <Screen
        testID="feedback-form-screen"
        contentContainerStyle={settingsStyles.categoryGap}
        header={header}
      >
        <EmptyState
          testID="feedback-sent"
          title="Thanks for your feedback"
          description="You'll see its status in Feedback & Suggestions as we look at it."
        />
        <PrimaryButton
          testID="feedback-sent-done"
          label="Done"
          onPress={() => navigation.goBack()}
          accentColor={accent.accent}
          onAccentColor={accent.onAccent}
        />
      </Screen>
    );
  }

  const deviceText = sentFromText(device);

  return (
    <Screen
      testID="feedback-form-screen"
      scrollTestID="feedback-form-scroll"
      keyboardAvoiding
      contentContainerStyle={settingsStyles.categoryGap}
      header={header}
    >
      <Section title="What's it about?">
        <SegmentedControl
          testID="feedback-category"
          options={FEEDBACK_CATEGORIES.map((value) => ({
            value,
            label: CATEGORY_SHORT_LABELS[value],
            accessibilityLabel: CATEGORY_LABELS[value],
          }))}
          value={category}
          onChange={setCategory}
          accentColor={accent.accent}
          onAccentColor={accent.onAccent}
        />
      </Section>

      <View style={styles.gapMedium}>
        <TextInput
          testID="feedback-title"
          label="Title"
          placeholder="In a few words"
          value={title}
          onChangeText={setTitle}
          maxLength={TITLE_MAX}
          autoCapitalize="sentences"
        />
        <TextInput
          testID="feedback-description"
          label="Description"
          placeholder={PROMPTS[category]}
          value={description}
          onChangeText={setDescription}
          maxLength={DESCRIPTION_MAX}
          autoCapitalize="sentences"
          multiline
          helperText={
            description.length > DESCRIPTION_MAX - 500
              ? `${description.length.toLocaleString()} of ${DESCRIPTION_MAX.toLocaleString()}`
              : undefined
          }
        />
      </View>

      <Section title="Screenshot">
        {screenshotUri ? (
          <View style={styles.alignStart}>
            <Image
              testID="feedback-screenshot-preview"
              source={{ uri: screenshotUri }}
              style={styles.screenshot}
              resizeMode="contain"
              accessibilityLabel="Your screenshot"
            />
            <TextButton
              testID="feedback-screenshot-remove"
              label="Remove Screenshot"
              onPress={() => setScreenshotUri(null)}
            />
          </View>
        ) : (
          <View style={styles.alignStart}>
            <SecondaryButton
              testID="feedback-screenshot-add"
              label="Add Screenshot"
              icon="image"
              size="md"
              onPress={() => void addScreenshot()}
            />
          </View>
        )}
      </Section>

      <View style={styles.gapSmall}>
        {deviceText ? (
          <Text testID="feedback-sent-from" style={styles.caption}>
            Sent with {deviceText}.
          </Text>
        ) : null}
        <Text style={styles.caption}>Only you and Progresso&apos;s team see it.</Text>
      </View>

      {error ? (
        <Text testID="feedback-form-error" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <PrimaryButton
        testID="feedback-form-send"
        label="Send Feedback"
        onPress={() => void handleSend()}
        loading={sending}
        disabled={!canSend && !sending}
        accentColor={accent.accent}
        onAccentColor={accent.onAccent}
      />
    </Screen>
  );
}
