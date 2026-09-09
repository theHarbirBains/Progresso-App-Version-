import { Text, View } from 'react-native';
import { progressStyles as styles } from './progressStyles';

interface Props {
  title: string;
  /** Optional supporting line under the title -- e.g. "Track how you're getting stronger." */
  subtitle?: string;
  testID?: string;
}

/**
 * Progress's own header: title (+ optional subtitle). Progress is a primary
 * bottom-nav destination (no back affordance) and its internal section
 * navigation is now the horizontal CategoryTabs row below this header, not
 * a menu button -- so this stays a plain, clean title block.
 */
export function ProgressHeader({ title, subtitle, testID }: Props) {
  return (
    <View testID={testID} style={styles.headerColumn}>
      <Text style={styles.headerTitle}>{title}</Text>
      {subtitle ? (
        <Text testID="progress-header-subtitle" style={styles.headerSubtitle}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
