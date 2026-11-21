import { StyleSheet } from 'react-native';
import { BottomSheet } from '../design/BottomSheet';
import { ListRow } from '../design/ListRow';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onEditProfile: () => void;
  onShare: () => void;
  testID?: string;
}

/**
 * Your own profile's "...": Edit Profile and Share Profile, kept off the page itself so the
 * profile, not its buttons, is what it shows (Harbir's call). Each closes the sheet as it goes.
 */
export function OwnProfileSheet({
  visible,
  onClose,
  onEditProfile,
  onShare,
  testID = 'own-profile-sheet',
}: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} testID={testID}>
      <Text style={styles.title}>Your Profile</Text>
      <ListRow
        testID={`${testID}-edit`}
        icon="edit-2"
        title="Edit Profile"
        subtitle="Name, photo, bio and montage"
        onPress={() => {
          onClose();
          onEditProfile();
        }}
      />
      <ListRow
        testID={`${testID}-share`}
        icon="share"
        title="Share Profile"
        subtitle="Send a friend your @username"
        divider
        onPress={() => {
          onClose();
          onShare();
        }}
        accessibilityLabel="Share your profile"
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
});
