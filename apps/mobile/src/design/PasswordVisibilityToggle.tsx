import { TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from './theme';

interface Props {
  testID: string;
  visible: boolean;
  onToggle: () => void;
}

// A TextInput `rightAccessory` for a password field -- shared so every
// password field in the app (Sign In, Create Account's own two) gets the
// same eye/eye-off toggle instead of each screen hand-rolling its own.
export function PasswordVisibilityToggle({ testID, visible, onToggle }: Props) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onToggle}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Hide password' : 'Show password'}
    >
      <Feather name={visible ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}
