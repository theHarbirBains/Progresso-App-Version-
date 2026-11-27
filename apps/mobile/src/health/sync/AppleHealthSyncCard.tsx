import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { AppCard } from '../../design/AppCard';
import { PrimaryButton, SecondaryButton, TextButton } from '../../design/Button';
import { Text } from '../../design/Text';
import { colors, fonts, radii, spacing, typeScale } from '../../design/theme';
import { withAlpha } from '../../theme/accentColor';
import { StatusPill } from '../preview/healthParts';
import type { ConnectionState } from '../preview/sampleHealthData';
import { appleHealthMetricName, formatHealthValue } from './appleHealthMetrics';
import {
  connectedHere,
  disconnectAppleHealthSync,
  syncAppleHealth,
  useAppleHealthSync,
  type AppleHealthSyncState,
} from './appleHealthSyncStore';
import { localDayKey } from './sleepNights';

// Apple Health as it really is -- the connection, its sync and what came in -- on Health's Devices
// page (Phase 3, development builds only), above the prototype's sample devices.

/** The connection's state as Health shows it. */
export function appleHealthState(sync: AppleHealthSyncState): ConnectionState {
  if (sync.phase === 'syncing') return 'syncing';
  if (!sync.connection || sync.connection.status === 'disconnected') return 'notConnected';
  if (sync.asked === false) return 'permission';
  if (sync.error || sync.connection.status === 'error') return 'issue';
  return 'connected';
}

/** "just now", "5 min ago", "3 h ago", else the day. */
export function syncedAgo(at: string, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(at).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dayName(day: string, now = new Date()): string {
  const today = localDayKey(now);
  const yesterday = localDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';
  const [y = 0, m = 1, d = 1] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function confirmDisconnect(): void {
  Alert.alert(
    'Disconnect Apple Health?',
    'Progresso stops reading Apple Health. To stop iPhone sharing it too, turn Progresso off in the Health app.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Keep History', onPress: () => void disconnectAppleHealthSync(false) },
      {
        text: 'Delete History',
        style: 'destructive',
        onPress: () => void disconnectAppleHealthSync(true),
      },
    ],
  );
}

export function AppleHealthSyncCard({
  accent,
  onConnect,
}: {
  accent: string;
  onConnect: () => void;
}) {
  const sync = useAppleHealthSync();
  const state = appleHealthState(sync);
  const here = connectedHere(sync);
  const error =
    sync.error ?? (sync.connection?.status === 'error' ? sync.connection.lastError : null);

  let body: ReactNode;
  if (sync.available === false) {
    body = (
      <Text testID="apple-health-sync-unavailable" style={styles.note}>
        Apple Health isn’t available here: it needs an iPhone and a development build (Expo Go
        doesn’t have it).
      </Text>
    );
  } else if (!sync.loaded) {
    body = <Text style={styles.note}>Checking…</Text>;
  } else if (!here) {
    const elsewhere = sync.connection && sync.connection.status !== 'disconnected';
    body = (
      <>
        <Text style={styles.note}>
          {elsewhere
            ? 'Connected on another iPhone. Connect here to keep it syncing.'
            : sync.connection
              ? 'Disconnected. Connect again any time.'
              : 'Bring your sleep, heart and activity into Progresso.'}
        </Text>
        <PrimaryButton
          testID="apple-health-sync-connect"
          label="Connect Apple Health"
          icon="heart"
          accentColor={accent}
          onPress={onConnect}
        />
      </>
    );
  } else {
    const connection = sync.connection!;
    body = (
      <>
        <View style={styles.facts}>
          <Text testID="apple-health-sync-synced" style={styles.fact}>
            {sync.phase === 'syncing'
              ? 'Syncing…'
              : connection.lastSyncedAt
                ? `Synced ${syncedAgo(connection.lastSyncedAt)}`
                : 'Not synced yet'}
          </Text>
          {connection.devices.length > 0 ? (
            <Text testID="apple-health-sync-devices" style={styles.note}>
              {connection.devices.join(' · ')}
            </Text>
          ) : null}
          {sync.lastSync ? (
            <Text testID="apple-health-sync-last" style={styles.note}>
              Last sync: {sync.lastSync.upserted.toLocaleString('en-US')} saved
              {sync.lastSync.refused > 0 ? ` · ${sync.lastSync.refused} refused` : ''}
            </Text>
          ) : null}
        </View>

        <View testID="apple-health-sync-latest">
          <Text style={styles.kicker}>WHAT CAME IN</Text>
          {sync.latest.length === 0 ? (
            <Text style={styles.note}>Nothing from the last week yet.</Text>
          ) : (
            sync.latest.map((row, i) => (
              <View
                key={row.metric}
                testID={`apple-health-sync-value-${row.metric}`}
                style={[styles.row, i > 0 && styles.divider]}
              >
                <Text style={styles.rowName}>{appleHealthMetricName(row.metric)}</Text>
                <Text style={styles.rowValue}>{formatHealthValue(row.metric, row.value)}</Text>
                <Text style={styles.rowDay}>{dayName(row.day)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.actions}>
          <SecondaryButton
            testID="apple-health-sync-now"
            label="Sync Now"
            icon="refresh-cw"
            size="md"
            loading={sync.phase === 'syncing'}
            onPress={() => void syncAppleHealth('manual')}
          />
          <TextButton
            testID="apple-health-sync-disconnect"
            label="Disconnect"
            destructive
            disabled={sync.phase !== 'idle'}
            onPress={confirmDisconnect}
          />
        </View>
      </>
    );
  }

  return (
    <AppCard testID="apple-health-sync">
      <View style={styles.block}>
        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: withAlpha(accent, 0.14) }]}>
            <Feather name="heart" size={16} color={accent} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.title}>Apple Health</Text>
            <Text style={styles.note}>Your real data</Text>
          </View>
          <StatusPill state={state} accent={accent} />
        </View>
        {error ? (
          <Text testID="apple-health-sync-error" style={styles.error}>
            {error}
          </Text>
        ) : null}
        {body}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  note: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  error: {
    ...typeScale.secondary,
    color: colors.destructive,
  },
  facts: {
    gap: 2,
  },
  fact: {
    ...typeScale.label,
    color: colors.textPrimary,
  },
  kicker: {
    ...typeScale.caption,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowName: {
    ...typeScale.callout,
    color: colors.textPrimary,
    flex: 1,
  },
  rowValue: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
  },
  rowDay: {
    ...typeScale.caption,
    color: colors.textMuted,
    width: 84,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});
