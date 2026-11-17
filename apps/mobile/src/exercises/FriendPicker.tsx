import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BottomSheet } from '../design/BottomSheet';
import { EmptyState } from '../design/EmptyState';
import { ListRow } from '../design/ListRow';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, radii, spacing, typeScale } from '../design/theme';
import type { SharingFriend } from './sharingFriends';

interface Props {
  /** The people you follow who share exercises (sharingFriends), A-Z. */
  friends: SharingFriend[];
  /** The one friend whose exercises show, or null for everyone's. */
  value: string | null;
  onChange: (friendId: string | null) => void;
  accentColor: string;
  testID?: string;
}

function exercisesText(count: number): string {
  return `${count} ${count === 1 ? 'exercise' : 'exercises'}`;
}

/**
 * The Friends tab's choice of whose exercises show -- one quiet row, "Showing: All Friends" or a
 * friend's name, that opens a sheet to search the people you follow by name and pick one (or All
 * Friends again). Built for a long list of friends, where a chip each would run off the screen:
 * the sheet's list is searched as it's typed, each friend with how many exercises they share.
 */
export function FriendPicker({
  friends,
  value,
  onChange,
  accentColor,
  testID = 'exercise-friend-filter',
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const chosen = friends.find((friend) => friend.id === value) ?? null;
  const matches = useMemo(() => {
    const wanted = search.trim().toLowerCase();
    return wanted
      ? friends.filter((friend) => friend.name.toLowerCase().includes(wanted))
      : friends;
  }, [friends, search]);

  function pick(friendId: string | null) {
    onChange(friendId);
    setOpen(false);
    setSearch('');
  }

  return (
    <>
      <View style={styles.row}>
        <TouchableOpacity
          testID={testID}
          style={styles.trigger}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Showing ${chosen ? `${chosen.name}'s exercises` : 'all friends'}. Choose a friend`}
        >
          <Feather name="users" size={16} color={colors.textSecondary} />
          <Text style={styles.triggerText} numberOfLines={1}>
            {chosen ? chosen.name : 'All Friends'}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.textMuted} />
        </TouchableOpacity>
        {/* A friend chosen: back to everyone's in one tap. */}
        {chosen ? (
          <TouchableOpacity
            testID={`${testID}-clear`}
            onPress={() => onChange(null)}
            accessibilityRole="button"
            accessibilityLabel="Show all friends"
            hitSlop={8}
          >
            <Text style={[styles.clearText, { color: accentColor }]}>Show All</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <BottomSheet visible={open} onClose={() => setOpen(false)} testID={`${testID}-sheet`}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Choose a Friend</Text>
          <TextInput
            testID={`${testID}-search`}
            placeholder="Search friends by name"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            leftAccessory={<Feather name="search" size={16} color={colors.textMuted} />}
          />
          <ScrollView
            testID={`${testID}-list`}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
          >
            {search.trim() ? null : (
              <ListRow
                testID={`${testID}-all-friends`}
                icon="users"
                title="All Friends"
                subtitle={`${friends.length} ${friends.length === 1 ? 'friend' : 'friends'}`}
                onPress={() => pick(null)}
                trailing={
                  value === null ? (
                    <Feather name="check" size={18} color={accentColor} />
                  ) : undefined
                }
              />
            )}
            {matches.length === 0 ? (
              <EmptyState
                testID={`${testID}-no-match`}
                title={`No friends named "${search.trim()}"`}
              />
            ) : (
              matches.map((friend, index) => (
                <ListRow
                  key={friend.id}
                  testID={`${testID}-${friend.id}`}
                  title={friend.name}
                  subtitle={exercisesText(friend.count)}
                  divider={index > 0 || !search.trim()}
                  onPress={() => pick(friend.id)}
                  trailing={
                    friend.id === value ? (
                      <Feather name="check" size={18} color={accentColor} />
                    ) : undefined
                  }
                />
              ))
            )}
          </ScrollView>
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  trigger: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  triggerText: {
    ...typeScale.label,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  clearText: {
    ...typeScale.label,
  },
  sheet: {
    gap: spacing.md,
  },
  sheetTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  list: {
    maxHeight: 420,
  },
});
