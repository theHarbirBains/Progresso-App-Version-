import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { EmptyState } from '../design/EmptyState';
import { SectionHeader } from '../design/SectionHeader';
import { colors } from '../design/theme';
import { settingsStyles as styles } from './settingsStyles';

// No privacy/visibility data model exists anywhere in the app today
// (no profile-visibility, workout-visibility, or social-visibility field,
// no corresponding API) -- per the task's explicit backend rule, this stays
// a real "coming soon" state rather than a database migration invented just
// to populate this screen.
export function PrivacyCategory() {
  return (
    <View style={styles.section}>
      <SectionHeader label="Privacy" />
      <View style={styles.emptyWrap}>
        <EmptyState
          testID="settings-privacy-empty"
          icon={<Feather name="lock" size={24} color={colors.textMuted} />}
          title="Privacy controls are coming soon."
        />
      </View>
    </View>
  );
}
