import Constants from 'expo-constants';
import { View } from 'react-native';
import { AppHeader } from '../design/AppHeader';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import type { RootStackScreenProps } from '../navigation/types';
import { ComingSoonRow } from '../settings/ComingSoonRow';
import { settingsStyles as styles } from '../settings/settingsStyles';

type Props = RootStackScreenProps<'SettingsSupport'>;

/**
 * Support & About: Feedback & Suggestions (sending a bug, an idea or anything else, and seeing
 * what happens to it), help and contact links still "Coming Soon" (nothing here pretends to
 * work yet), plus the app's own version/build, informational only (not a setting -- there's
 * nothing to save), read from the app's build metadata. Omits a version/build line entirely
 * rather than showing "undefined" when either isn't available (e.g. inside Expo Go).
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
        <View>
          <ListRow
            testID="help-feedback"
            icon="message-square"
            title="Feedback & Suggestions"
            subtitle="Report a bug, suggest a feature, see what's happening with it"
            onPress={() => navigation.navigate('Feedback')}
          />
          <ComingSoonRow testID="help-faq" icon="help-circle" title="Help & FAQ" showDivider />
          <ComingSoonRow
            testID="help-contact-support"
            icon="message-circle"
            title="Contact Support"
            showDivider
          />
        </View>
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
