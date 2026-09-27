import { View } from 'react-native';
import { Section } from '../design/Section';
import { ComingSoonRow } from './ComingSoonRow';
import { settingsStyles as styles } from './settingsStyles';

/** Privacy category: Terms of Service and Privacy Policy belong here, not
 * under Help -- moved from HelpCategory (same "Coming Soon" placeholder,
 * no URL/content behind either yet, just better organized). */
export function PrivacyCategory() {
  return (
    <View style={styles.categoryGap}>
      <Section title="Privacy">
        <ComingSoonRow testID="privacy-terms" icon="file-text" title="Terms of Service" />
        <ComingSoonRow testID="privacy-policy" icon="shield" title="Privacy Policy" showDivider />
      </Section>
    </View>
  );
}
