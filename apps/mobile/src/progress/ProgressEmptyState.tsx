import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { EmptyState } from '../design/EmptyState';
import { colors } from '../design/theme';
import { progressStyles as styles } from './progressStyles';

interface Props {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  testID?: string;
}

/** The shared "no data yet" look for every Progress page -- never a fake chart/list. */
export function ProgressEmptyState({ icon = 'trending-up', title, testID }: Props) {
  return (
    <View style={styles.emptyStateWrap}>
      <EmptyState
        testID={testID}
        icon={<Feather name={icon} size={24} color={colors.textMuted} />}
        title={title}
      />
    </View>
  );
}
