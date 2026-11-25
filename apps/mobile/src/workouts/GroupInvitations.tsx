import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { Avatar } from '../design/Avatar';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { SectionHeader } from '../design/SectionHeader';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale } from '../design/theme';
import {
  cancelGroupInvite,
  inviteToGroup,
  listFollowing,
  type FollowUser,
  type GroupDetail,
  type GroupInvitation,
} from '../lib/api';
import { withAlpha } from '../theme/accentColor';

const STATUS_LABELS: Record<GroupInvitation['status'], string> = {
  pending: 'Waiting',
  accepted: 'Joined',
  declined: 'Declined',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

/** The invites as they are: the server's story of each, or -- from an API from before -- the
 * people still invited, waiting. */
function invitationsOf(group: GroupDetail): GroupInvitation[] {
  if (group.invitations) return group.invitations;
  return group.members
    .filter((member) => member.status === 'invited')
    .map((member) => ({
      userId: member.userId,
      displayName: member.displayName,
      status: 'pending' as const,
      invitedById: null,
      invitedByDisplayName: null,
      invitedAt: '',
      respondedAt: null,
      canCancel: false,
    }));
}

function nameOf(person: { displayName: string | null; username?: string | null }): string {
  return person.displayName ?? (person.username ? `@${person.username}` : 'A friend');
}

/**
 * A live group's invitations, inside it: every invite and what became of it -- Waiting (with
 * who sent it), Joined, Declined, Cancelled, Expired -- the ones you sent (or, as the host, any)
 * with Cancel while they wait; and Invite Friends, a sheet of the people you follow (ticked, as
 * many as you like; anyone in the group or invited already isn't offered, so nobody's invited
 * twice), sent together. Nobody in the group is ever moved by any of it.
 */
export function GroupInvitations({
  group,
  accessToken,
  accentColor,
  onAccentColor,
  onChanged,
  testID = 'group-session-invited',
}: {
  group: GroupDetail;
  accessToken: string;
  accentColor: string;
  onAccentColor: string;
  /** Read the group again: something changed. */
  onChanged: () => Promise<void>;
  testID?: string;
}) {
  const live = group.status === 'live';
  const invitations = invitationsOf(group);
  const [picking, setPicking] = useState(false);
  const [friends, setFriends] = useState<FollowUser[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  // Not offered: anyone in the group, or invited and waiting.
  const taken = new Set([
    ...group.members.map((member) => member.userId),
    ...invitations.filter((invite) => invite.status === 'pending').map((invite) => invite.userId),
  ]);
  const offered = (friends ?? []).filter((friend) => !taken.has(friend.id));

  function openPicker() {
    setChosen(new Set());
    setPicking(true);
    listFollowing(accessToken)
      .then(setFriends)
      .catch(() => setFriends([]));
  }

  function toggle(id: string) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    if (chosen.size === 0) return;
    setSending(true);
    try {
      const { results } = await inviteToGroup(accessToken, group.id, [...chosen]);
      setPicking(false);
      const skipped = results.filter((result) => result.status === 'skipped');
      if (skipped.length > 0) {
        const names = skipped.map((result) =>
          nameOf(friends?.find((f) => f.id === result.userId) ?? { displayName: null }),
        );
        Alert.alert(
          skipped.length === 1 ? "Couldn't invite them" : "Couldn't invite everyone",
          `${names.join(', ')} can't be invited to this workout.`,
        );
      }
      await onChanged();
    } catch (err) {
      Alert.alert('Could not send the invites', err instanceof Error ? err.message : 'Try again');
    } finally {
      setSending(false);
    }
  }

  function cancel(invite: GroupInvitation) {
    Alert.alert(`Cancel ${nameOf(invite)}'s invite?`, "They won't be able to join from it.", [
      { text: 'Keep It', style: 'cancel' },
      {
        text: 'Cancel Invite',
        style: 'destructive',
        onPress: () =>
          void (async () => {
            setCancelling(invite.userId);
            try {
              await cancelGroupInvite(accessToken, group.id, invite.userId);
              await onChanged();
            } catch (err) {
              Alert.alert(
                'Could not cancel the invite',
                err instanceof Error ? err.message : 'Try again',
              );
            } finally {
              setCancelling(null);
            }
          })(),
      },
    ]);
  }

  if (!live && invitations.length === 0) return null;

  return (
    <>
      <AppCard testID={testID}>
        <SectionHeader label="Invitations" />
        {invitations.length === 0 ? (
          <Text style={styles.empty}>No one invited yet.</Text>
        ) : (
          invitations.map((invite, index) => (
            <ListRow
              key={`${invite.userId}-${invite.invitedAt}`}
              testID={`${testID}-${invite.userId}`}
              title={nameOf(invite)}
              subtitle={
                invite.status === 'pending' && invite.invitedByDisplayName
                  ? `Invited by ${invite.invitedByDisplayName}`
                  : undefined
              }
              divider={index > 0}
              chevron={false}
              trailing={
                <View style={styles.trailing}>
                  <View
                    testID={`${testID}-${invite.userId}-status`}
                    style={[
                      styles.status,
                      invite.status === 'accepted' && {
                        backgroundColor: withAlpha(accentColor, 0.14),
                        borderColor: 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        invite.status === 'accepted' && { color: accentColor },
                      ]}
                    >
                      {STATUS_LABELS[invite.status]}
                    </Text>
                  </View>
                  {invite.canCancel ? (
                    <TextButton
                      testID={`${testID}-${invite.userId}-cancel`}
                      label="Cancel"
                      destructive
                      loading={cancelling === invite.userId}
                      onPress={() => cancel(invite)}
                    />
                  ) : null}
                </View>
              }
            />
          ))
        )}
        {live ? (
          <View style={styles.inviteButton}>
            <SecondaryButton
              testID={`${testID}-invite`}
              label="Invite Friends"
              icon="user-plus"
              size="md"
              onPress={openPicker}
            />
          </View>
        ) : null}
      </AppCard>

      <BottomSheet visible={picking} onClose={() => setPicking(false)} testID={`${testID}-picker`}>
        <Text style={styles.sheetTitle}>Invite Friends</Text>
        <Text style={styles.sheetNote}>
          They&apos;ll get an invite to join this live workout, and can accept or decline.
        </Text>
        {friends === null ? (
          <LoadingState testID={`${testID}-picker-loading`} inline />
        ) : offered.length === 0 ? (
          <Text testID={`${testID}-picker-none`} style={styles.empty}>
            Everyone you follow is in this workout or invited already.
          </Text>
        ) : (
          <ScrollView style={styles.list}>
            {offered.map((friend, index) => {
              const on = chosen.has(friend.id);
              return (
                <ListRow
                  key={friend.id}
                  testID={`${testID}-friend-${friend.id}`}
                  title={nameOf(friend)}
                  subtitle={friend.username ? `@${friend.username}` : undefined}
                  leading={
                    <Avatar
                      uri={friend.avatarUrl}
                      initial={nameOf(friend).replace('@', '').charAt(0).toUpperCase()}
                      size={36}
                      iconSize={16}
                      iconColor={colors.textSecondary}
                    />
                  }
                  divider={index > 0}
                  chevron={false}
                  onPress={() => toggle(friend.id)}
                  accessibilityLabel={`${nameOf(friend)}${on ? ', chosen' : ''}`}
                  trailing={
                    <Feather
                      name={on ? 'check-circle' : 'circle'}
                      size={22}
                      color={on ? accentColor : colors.textMuted}
                    />
                  }
                />
              );
            })}
          </ScrollView>
        )}
        <View style={styles.send}>
          <PrimaryButton
            testID={`${testID}-send`}
            label={chosen.size > 1 ? `Send ${chosen.size} Invites` : 'Send Invite'}
            loading={sending}
            disabled={chosen.size === 0}
            onPress={() => void send()}
            accentColor={accentColor}
            onAccentColor={onAccentColor}
          />
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  empty: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    paddingVertical: spacing.sm,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // What became of an invite: a quiet outlined pill, Joined on the accent's tint.
  status: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusText: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  inviteButton: {
    marginTop: spacing.md,
  },
  sheetTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  sheetNote: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  list: {
    maxHeight: 360,
  },
  send: {
    marginTop: spacing.md,
  },
});
