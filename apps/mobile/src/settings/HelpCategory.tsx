import { View } from 'react-native';
import { Section } from '../design/Section';
import { ComingSoonRow } from './ComingSoonRow';
import { settingsStyles as styles } from './settingsStyles';

/** Help category: every entry is a visible "Coming Soon" row -- nothing here pretends to work yet. */
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
        <ComingSoonRow testID="help-terms" icon="file-text" title="Terms of Service" showDivider />
        <ComingSoonRow
          testID="help-privacy-policy"
          icon="shield"
          title="Privacy Policy"
          showDivider
        />
      </Section>
    </View>
  );
}
