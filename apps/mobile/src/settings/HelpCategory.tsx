import { View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { SectionHeader } from '../design/SectionHeader';
import { ComingSoonRow } from './ComingSoonRow';
import { settingsStyles as styles } from './settingsStyles';

// No help/support/legal destination exists anywhere in this app today -- no
// FAQ content, no support contact address, no About screen, no Terms of
// Service or Privacy Policy URL. Per the task's explicit rule ("do not
// fabricate URLs"), every row here is a real, visible "Coming Soon" rather
// than a link to a page or address that doesn't exist yet.
export function HelpCategory() {
  return (
    <View style={styles.section}>
      <SectionHeader label="Help" />
      <AppCard>
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
      </AppCard>
    </View>
  );
}
