import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppCard } from '../design/AppCard';
import { withAlpha } from '../theme/accentColor';
import { progressStyles as styles } from './progressStyles';

interface Props {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  accentColor: string;
  testID?: string;
}

/** One compact stat (lifetime overview stats, Training Momentum) -- deliberately small, never a giant metric card. */
export function StatTile({ icon, label, value, accentColor, testID }: Props) {
  return (
    <AppCard testID={testID} style={styles.statTile}>
      <View style={[styles.statTileIcon, { backgroundColor: withAlpha(accentColor, 0.14) }]}>
        <Feather name={icon} size={16} color={accentColor} />
      </View>
      <View>
        <Text style={styles.statTileValue}>{value}</Text>
        <Text style={styles.statTileLabel}>{label}</Text>
      </View>
    </AppCard>
  );
}
