import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Badge } from '../design/Badge';
import { colors } from '../design/theme';
import { settingsStyles as styles } from './settingsStyles';

interface Props {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  showDivider?: boolean;
  testID?: string;
}

/** A visible-but-not-yet-functional settings row: real placeholder, never a fake toggle that silently does nothing. */
export function ComingSoonRow({ icon, title, subtitle, showDivider, testID }: Props) {
  return (
    <View testID={testID} style={[styles.row, showDivider && styles.rowDivider]}>
      <View style={styles.rowIconWrap}>
        <Feather name={icon} size={16} color={colors.textMuted} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Badge
        label="Coming Soon"
        color={colors.textMuted}
        backgroundColor={colors.surfaceRaised}
        testID={testID ? `${testID}-badge` : undefined}
      />
    </View>
  );
}
