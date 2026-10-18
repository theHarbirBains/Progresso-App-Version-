import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { Avatar } from '../design/Avatar';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton, TextButton } from '../design/Button';
import { ListRow } from '../design/ListRow';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale } from '../design/theme';
import type { FollowUser } from '../lib/followsApi';
import { blockUser, reportUser } from '../lib/safetyApi';
import { REPORT_REASON_LABELS, REPORT_REASONS, type ReportReason } from './reportReasons';

interface Props {
  /** Who the sheet is about. Null closes it. */
  person: FollowUser | null;
  /** The Friends-feed workout the sheet was opened from, so a report can point at it. */
  workoutId?: string;
  onClose: () => void;
  /** After a block succeeds, so the screen can drop the person from what it shows. */
  onBlocked: (userId: string) => void;
  accentColor?: string;
  onAccentColor?: string;
  testID?: string;
}

type Step = 'menu' | 'report' | 'reported';

/** "Sam Lee" from a display name, "@sam" from a username, else "this person". */
export function personName(person: FollowUser): string {
  return person.displayName ?? (person.username ? `@${person.username}` : 'this person');
}

/**
 * What you can do about another person: report them (or the workout you opened this from)
 * and block them. A mini profile at the top -- avatar, name, username -- says who it's
 * about. Shared by Find People and the Friends feed.
 */
export function PersonActionsSheet({
  person,
  workoutId,
  onClose,
  onBlocked,
  accentColor = colors.accent,
  onAccentColor = colors.onAccent,
  testID = 'person-actions',
}: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const [step, setStep] = useState<Step>('menu');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Each person opens on the menu, with nothing left over from the last one.
  useEffect(() => {
    setStep('menu');
    setReason(null);
    setDetails('');
    setError(null);
  }, [person?.id]);

  if (!person) return null;
  const name = personName(person);

  function confirmBlock() {
    if (!person) return;
    Alert.alert(
      `Block ${name}?`,
      "You'll stop following each other, and they won't be able to find you, follow you or invite you to a group. They won't be told.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => void block() },
      ],
    );
  }

  async function block() {
    if (!accessToken || !person) return;
    setBusy(true);
    setError(null);
    try {
      await blockUser(accessToken, person.id);
      onBlocked(person.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not block this person');
    } finally {
      setBusy(false);
    }
  }

  async function sendReport() {
    if (!accessToken || !person || !reason) return;
    setBusy(true);
    setError(null);
    try {
      await reportUser(accessToken, {
        reportedUserId: person.id,
        ...(workoutId ? { workoutId } : {}),
        reason,
        ...(details.trim() ? { details: details.trim() } : {}),
      });
      setStep('reported');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the report');
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet visible onClose={onClose} testID={testID}>
      <View style={styles.header}>
        <Avatar
          uri={person.avatarUrl}
          initial={name.replace('@', '').charAt(0).toUpperCase()}
          size={40}
          iconSize={18}
          iconColor={colors.textSecondary}
        />
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {person.displayName && person.username ? (
            <Text style={styles.username} numberOfLines={1}>
              @{person.username}
            </Text>
          ) : null}
        </View>
      </View>

      {step === 'menu' ? (
        <>
          <ListRow
            testID={`${testID}-report`}
            icon="flag"
            title={workoutId ? 'Report Workout' : `Report ${name}`}
            onPress={() => setStep('report')}
            disabled={busy}
          />
          <ListRow
            testID={`${testID}-block`}
            icon="slash"
            title={`Block ${name}`}
            subtitle="They can't find, follow or invite you"
            destructive
            chevron={false}
            divider
            onPress={confirmBlock}
            disabled={busy}
          />
        </>
      ) : null}

      {step === 'report' ? (
        <>
          <Text style={styles.heading}>What&apos;s wrong?</Text>
          {REPORT_REASONS.map((option, index) => (
            <ListRow
              key={option}
              testID={`${testID}-reason-${option}`}
              title={REPORT_REASON_LABELS[option]}
              divider={index > 0}
              chevron={false}
              accessibilityLabel={`${REPORT_REASON_LABELS[option]}${reason === option ? ', selected' : ''}`}
              trailing={
                reason === option ? (
                  <Feather name="check" size={18} color={accentColor} />
                ) : undefined
              }
              onPress={() => setReason(option)}
            />
          ))}
          <View style={styles.details}>
            <TextInput
              testID={`${testID}-details`}
              label="Anything else? (optional)"
              placeholder="What happened"
              value={details}
              onChangeText={(text) => setDetails(text.slice(0, 1000))}
              autoCapitalize="sentences"
            />
          </View>
          <PrimaryButton
            testID={`${testID}-send-report`}
            label="Send Report"
            onPress={() => void sendReport()}
            loading={busy}
            disabled={!reason}
            accentColor={accentColor}
            onAccentColor={onAccentColor}
          />
        </>
      ) : null}

      {step === 'reported' ? (
        <>
          <Text testID={`${testID}-reported`} style={styles.heading}>
            Thanks. We&apos;ll look into it.
          </Text>
          <ListRow
            testID={`${testID}-block-after-report`}
            icon="slash"
            title={`Block ${name}`}
            subtitle="They can't find, follow or invite you"
            destructive
            chevron={false}
            onPress={confirmBlock}
            disabled={busy}
          />
          <PrimaryButton
            testID={`${testID}-done`}
            label="Done"
            onPress={onClose}
            accentColor={accentColor}
            onAccentColor={onAccentColor}
          />
        </>
      ) : null}

      {error ? (
        <Text testID={`${testID}-error`} style={styles.error}>
          {error}
        </Text>
      ) : null}

      {step !== 'reported' ? (
        <View style={styles.cancel}>
          <TextButton testID={`${testID}-cancel`} label="Cancel" onPress={onClose} />
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  username: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  heading: {
    ...typeScale.sectionHeading,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  details: {
    marginVertical: spacing.lg,
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
    marginTop: spacing.md,
  },
  cancel: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
});
