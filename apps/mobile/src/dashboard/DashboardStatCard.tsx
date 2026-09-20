import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppCard } from '../design/AppCard';
import { colors } from '../design/theme';
import { withAlpha } from '../theme/accentColor';
import { dashboardStyles as styles } from '../screens/dashboardStyles';

interface Props {
  testID: string;
  icon: keyof typeof Feather.glyphMap;
  value: string;
  title: string;
  subtitle: string;
  accentColor: string;
  onPress?: () => void;
}

// One tile of the Workout Home 2x2 stat grid (Sets Done / Workouts This
// Month / Day Streak / Weekly Goal) -- built on the shared AppCard (dark
// glass) rather than a hand-rolled background, per the redesign's "use the
// shared glass/card architecture" instruction.
export function DashboardStatCard({
  testID,
  icon,
  value,
  title,
  subtitle,
  accentColor,
  onPress,
}: Props) {
  return (
    <AppCard testID={testID} style={styles.statGridCard} onPress={onPress}>
      <View style={[styles.statGridIcon, { backgroundColor: withAlpha(accentColor, 0.14) }]}>
        <Feather name={icon} size={16} color={accentColor} />
      </View>
      <Text style={styles.statGridValue}>{value}</Text>
      <Text style={styles.statGridTitle}>{title}</Text>
      <View style={styles.statGridFooterRow}>
        <Text style={styles.statGridSubtitle}>{subtitle}</Text>
        <Feather name="chevron-right" size={14} color={colors.textMuted} />
      </View>
    </AppCard>
  );
}
