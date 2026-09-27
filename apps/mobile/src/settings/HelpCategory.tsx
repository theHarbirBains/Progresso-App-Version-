import { View } from 'react-native';
import { Section } from '../design/Section';
import { ComingSoonRow } from './ComingSoonRow';
import { settingsStyles as styles } from './settingsStyles';

/** Help category: every entry is a visible "Coming Soon" row -- nothing here pretends to work yet.
 * Terms of Service / Privacy Policy live under Privacy instead, not here -- see PrivacyCategory. */
export function HelpCategory() {
  return (
    <View style={styles.categoryGap}>
      <Section title="Help">
        <ComingSoonRow testID="help-faq" icon="help-circle" title="Help & FAQ" />
        <ComingSoonRow
          testID="help-contact-support"
          icon="message-circle"
          title="Contact Support"
          showDivider
        />
        <ComingSoonRow
          testID="help-report-problem"
          icon="flag"
          title="Report a Problem"
          showDivider
        />
        <ComingSoonRow testID="help-about" icon="info" title="About Progresso" showDivider />
      </Section>
    </View>
  );
}
