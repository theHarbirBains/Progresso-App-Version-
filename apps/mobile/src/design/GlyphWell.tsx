import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { radii } from './theme';
import { withAlpha } from '../theme/accentColor';

/**
 * A Feather glyph in a round well of the accent at 14% -- the mark beside a cardio activity's name
 * (Add Cardio's heading, the live workout's Cardio page, a finished workout's cardio, a feed card)
 * and beside a heading that leads its topic (the micronutrient pages' TopicHeader). Decorative:
 * hidden from assistive tech, which reads the name beside it.
 */
export function GlyphWell({
  icon,
  accentColor,
  size = 36,
}: {
  icon: keyof typeof Feather.glyphMap;
  accentColor: string;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.well,
        { width: size, height: size, backgroundColor: withAlpha(accentColor, 0.14) },
      ]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Feather name={icon} size={Math.round(size / 2)} color={accentColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  well: {
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
