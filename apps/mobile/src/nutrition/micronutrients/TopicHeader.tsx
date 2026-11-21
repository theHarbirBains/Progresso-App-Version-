import type { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GlyphWell } from '../../design/GlyphWell';
import { Text } from '../../design/Text';
import { colors, spacing, typeScale } from '../../design/theme';

/**
 * What a Micronutrients widget is about, made to stand out: its glyph in an accent well, its title
 * in `cardTitle`, a short muted line under it, and anything on the right (a figure). Each topic on
 * the pages -- the week, the vitamins, what a nutrient does, too little, too much -- leads with one.
 */
export function TopicHeader({
  icon,
  title,
  detail,
  right,
  accentColor,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  detail?: string | null;
  right?: ReactNode;
  accentColor: string;
  testID?: string;
}) {
  return (
    <View testID={testID} style={styles.row}>
      <GlyphWell icon={icon} accentColor={accentColor} size={34} />
      <View style={styles.text}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {detail ? (
          <Text testID={testID ? `${testID}-detail` : undefined} style={styles.detail}>
            {detail}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  text: {
    flex: 1,
    gap: 1,
  },
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  detail: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
});
