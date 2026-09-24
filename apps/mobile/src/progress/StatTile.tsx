import { View } from 'react-native';
import { Text } from '../design/Text';
import { progressStyles as styles } from './progressStyles';

interface Props {
  label: string;
  value: string;
  testID?: string;
}

/** One compact stat (lifetime overview stats, Training Momentum): a neutral mono number over a quiet label. Plain content, not a card and not decorated with an icon. */
export function StatTile({ label, value, testID }: Props) {
  return (
    <View testID={testID} style={styles.statTile}>
      <Text style={styles.statTileValue}>{value}</Text>
      <Text style={styles.statTileLabel}>{label}</Text>
    </View>
  );
}
