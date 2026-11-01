import { Feather } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '../design/Text';
import { withAlpha } from '../theme/accentColor';
import { progressStyles as styles } from './progressStyles';

interface Props {
  title: string;
  subtitle?: string;
  subtitleTestID?: string;
  /** A leading icon in a faint accent tile (the All Time cards). */
  icon?: ComponentProps<typeof Feather>['name'];
  /** The icon's colour, and its tile's tint. */
  accentColor?: string;
  /** A link at the right ("View All"). */
  action?: ReactNode;
}

/** The title row of a Progress card: its title and a line under it, an icon or a link beside. */
export function ProgressCardHeader({
  title,
  subtitle,
  subtitleTestID,
  icon,
  accentColor,
  action,
}: Props) {
  return (
    <View style={styles.overviewCardHeader}>
      {icon && accentColor ? (
        <View
          style={[styles.overviewCardIconWrap, { backgroundColor: withAlpha(accentColor, 0.14) }]}
        >
          <Feather name={icon} size={18} color={accentColor} />
        </View>
      ) : null}
      <View style={styles.overviewCardTitleColumn}>
        <Text style={styles.overviewCardTitle}>{title}</Text>
        {subtitle ? (
          <Text testID={subtitleTestID} style={styles.overviewCardSubtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}
