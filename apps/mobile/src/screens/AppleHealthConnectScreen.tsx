import { Feather } from '@expo/vector-icons';
import { useEffect, useState, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale } from '../design/theme';
import {
  connectAppleHealth,
  DAYS_ON_CONNECT,
  refreshAppleHealth,
  useAppleHealthSync,
} from '../health/sync/appleHealthSyncStore';
import type { RootStackScreenProps } from '../navigation/types';
import { withAlpha } from '../theme/accentColor';
import { useAppTheme } from '../theme/appThemeContext';

type Props = RootStackScreenProps<'AppleHealthConnect'>;
type FeatherName = ComponentProps<typeof Feather>['name'];

// What Health reads -- the same list the permission sheet shows, in plain words.
const READS: { icon: FeatherName; name: string; what: string }[] = [
  { icon: 'moon', name: 'Sleep', what: 'Time in bed and asleep, and its stages' },
  { icon: 'trending-up', name: 'Activity', what: 'Steps, distance, active calories and exercise' },
  { icon: 'heart', name: 'Heart', what: 'Heart rate, resting heart rate, HRV and recovery' },
  { icon: 'wind', name: 'Breathing', what: 'Breathing rate and blood oxygen' },
  { icon: 'thermometer', name: 'Temperature', what: 'Sleeping wrist temperature' },
  { icon: 'zap', name: 'Fitness', what: 'VO₂ max' },
];

// How it's kept -- what the Privacy Policy says, in a line each.
const KEPT: { icon: FeatherName; text: string }[] = [
  {
    icon: 'cloud',
    text: `Saved to your Progresso account, so Health works on any phone: the last ${DAYS_ON_CONNECT} days, then as it comes in, in the background too.`,
  },
  {
    icon: 'lock',
    text: 'Only you see it -- never your trainer, the people who follow you, or a group workout.',
  },
  { icon: 'slash', text: 'Progresso never writes to Apple Health.' },
  {
    icon: 'sliders',
    text: 'You choose what to share on the next screen, and can change it any time in the Health app. Disconnect, or delete it, in Devices.',
  },
];

/**
 * Connect Apple Health (Phase 3 of the Health & Wearables brief, development builds only for
 * now): what's read and how it's kept, then iPhone's own permission sheet, then the first 90 days
 * brought in.
 */
export function AppleHealthConnectScreen({ navigation }: Props) {
  const accent = useAppTheme().accent;
  const sync = useAppleHealthSync();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!sync.loaded) void refreshAppleHealth();
  }, [sync.loaded]);

  const connect = async () => {
    if (await connectAppleHealth()) setDone(true);
  };

  const busy = sync.phase === 'asking' || sync.phase === 'syncing';
  const label = done
    ? 'Done'
    : sync.phase === 'asking'
      ? 'Waiting for iPhone…'
      : sync.phase === 'syncing'
        ? `Bringing in ${DAYS_ON_CONNECT} days…`
        : sync.error
          ? 'Try Again'
          : 'Connect Apple Health';

  return (
    <Screen
      scrollTestID="apple-health-connect-scroll"
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          title="Apple Health"
          onBack={() => navigation.goBack()}
          testID="apple-health-connect-header"
        />
      }
    >
      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: withAlpha(accent.accent, 0.14) }]}>
          <Feather name="heart" size={26} color={accent.accent} />
        </View>
        <Text style={styles.heroTitle}>Connect Apple Health</Text>
        <Text style={styles.heroBody}>Bring your sleep, heart and activity into Progresso.</Text>
      </View>

      <AppCard testID="apple-health-connect-reads">
        <View style={styles.list}>
          {READS.map((item) => (
            <View key={item.name} style={styles.item}>
              <Feather name={item.icon} size={18} color={accent.accent} style={styles.itemIcon} />
              <View style={styles.flex}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemWhat}>{item.what}</Text>
              </View>
            </View>
          ))}
        </View>
      </AppCard>

      <View testID="apple-health-connect-kept" style={styles.list}>
        {KEPT.map((item) => (
          <View key={item.icon} style={styles.item}>
            <Feather name={item.icon} size={16} color={colors.textMuted} style={styles.itemIcon} />
            <Text style={[styles.itemWhat, styles.flex]}>{item.text}</Text>
          </View>
        ))}
      </View>

      {sync.available === false ? (
        <Text testID="apple-health-connect-unavailable" style={styles.note}>
          Apple Health isn’t available here: it needs an iPhone and a development build (Expo Go
          doesn’t have it).
        </Text>
      ) : (
        <>
          {sync.error && !busy ? (
            <Text testID="apple-health-connect-error" style={styles.error}>
              {sync.error}
            </Text>
          ) : null}
          {done && sync.lastSync ? (
            <Text testID="apple-health-connect-done" style={styles.note}>
              Connected. {sync.lastSync.upserted.toLocaleString('en-US')} figures brought in
              {sync.lastSync.refused > 0 ? `, ${sync.lastSync.refused} refused` : ''}.
            </Text>
          ) : null}
          <PrimaryButton
            testID="apple-health-connect-button"
            label={label}
            icon={done ? 'check' : 'heart'}
            size="lg"
            loading={busy}
            accentColor={accent.accent}
            onAccentColor={accent.onAccent}
            onPress={done ? () => navigation.goBack() : () => void connect()}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  heroTitle: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  heroBody: {
    ...typeScale.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  list: {
    gap: spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  itemIcon: {
    marginTop: 2,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    ...typeScale.label,
    color: colors.textPrimary,
  },
  itemWhat: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  note: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  error: {
    ...typeScale.secondary,
    color: colors.destructive,
    textAlign: 'center',
  },
});
