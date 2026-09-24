import { View } from 'react-native';
import { EmptyState } from '../design/EmptyState';
import { Section } from '../design/Section';
import { settingsStyles as styles } from './settingsStyles';

export function PrivacyCategory() {
  return (
    <View style={styles.categoryGap}>
      <Section title="Privacy">
        <EmptyState testID="settings-privacy-empty" title="Privacy controls are coming soon." />
      </Section>
    </View>
  );
}
