import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChoiceTile } from '../design/ChoiceTile';
import { Text } from '../design/Text';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';
import { withAlpha } from '../theme/accentColor';
import { useAppTheme } from '../theme/appThemeContext';

interface Props {
  testID: string;
  /** Its mark, at the left: a glyph well, a level meter. */
  leading: ReactNode;
  title: string;
  /** A short fact in an accent pill under the title ("7,500-10,000 steps a day"). */
  pill?: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}

/**
 * One answer of an onboarding question that needs a line or two to tell apart (how confident,
 * how active): a full-width widget tile (`ChoiceTile`) with its mark at the left, its name, an
 * optional accent pill and its line. Chosen, it's ticked with the accent's edge.
 */
export function ChoiceCard({
  testID,
  leading,
  title,
  pill,
  description,
  selected,
  onPress,
}: Props) {
  const accent = useAppTheme().accent.accent;
  return (
    <ChoiceTile
      testID={testID}
      selected={selected}
      onPress={onPress}
      accessibilityLabel={[title, pill, description].filter(Boolean).join('. ')}
    >
      <View style={styles.row}>
        <View style={styles.leading}>{leading}</View>
        <View style={styles.body}>
          <Text style={[styles.title, selected && { color: accent }]}>{title}</Text>
          {pill ? (
            <View style={[styles.pill, { backgroundColor: withAlpha(accent, 0.14) }]}>
              <Text style={[styles.pillText, { color: accent }]}>{pill}</Text>
            </View>
          ) : null}
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
      </View>
    </ChoiceTile>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // Room for the tick in the corner.
    paddingRight: spacing.lg,
  },
  leading: {
    alignSelf: 'center',
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typeScale.callout,
    fontFamily: fonts.display,
    color: colors.textPrimary,
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pillText: {
    ...typeScale.caption,
  },
  description: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
});
