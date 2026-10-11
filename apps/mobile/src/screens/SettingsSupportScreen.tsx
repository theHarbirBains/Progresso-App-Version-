import Constants from 'expo-constants';
import { AppHeader } from '../design/AppHeader';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import type { RootStackScreenProps } from '../navigation/types';
import { ComingSoonRow } from '../settings/ComingSoonRow';
import { settingsStyles as styles } from '../settings/settingsStyles';

type Props = RootStackScreenProps<'SettingsSupport'>;

/**
 * Support & About: help/contact links (same "Coming Soon" precedent
 * HelpCategory already used -- nothing here pretends to work yet) plus the
 * app's own version/build, informational only (not a setting -- there's
 * nothing to save), read from the same build metadata lib/sentry.ts already
 * uses for its own release tag. Omits a version/build line entirely rather
 * than showing "undefined" when either isn't available (e.g. inside Expo Go).
 */
export function SettingsSupportScreen({ navigation }: Props) {
  const version = Constants.expoConfig?.version;
  const build = Constants.nativeBuildVersion;
  const aboutValue = [version ? `Version ${version}` : null, build ? `Build ${build}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen
      testID="settings-support-screen"
      scrollTestID="settings-support-scroll"
      contentContainerStyle={styles.categoryGap}
      header={
        <AppHeader
          testID="settings-support-header"
          title="Support & About"
          onBack={() => navigation.goBack()}
        />
      }
    >
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
      </Section>

      <Section title="About">
        <ListRow
          testID="about-progresso"
          icon="info"
          title="About Progresso"
          value={aboutValue || undefined}
          chevron={false}
        />
      </Section>
    </Screen>
  );
}
