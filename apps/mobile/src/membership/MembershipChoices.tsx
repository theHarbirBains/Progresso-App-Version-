import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { ChoiceTile } from '../design/ChoiceTile';
import { GlyphWell } from '../design/GlyphWell';
import { RiseIn } from '../design/RiseIn';
import { Text } from '../design/Text';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';
import type { MembershipTier } from '../lib/api';
import { withAlpha } from '../theme/accentColor';
import { useAppTheme } from '../theme/appThemeContext';
import { MEMBERSHIP_OPTIONS } from './membershipTiers';

interface Props {
  testID: string;
  /** The membership chosen, or none yet. */
  value: MembershipTier | null;
  onChoose: (tier: MembershipTier) => void;
}

/**
 * Onboarding's membership choice: the three memberships at once, one widget tile each, every
 * tile the size of the tallest -- its glyph, its name with "Free" beside it, its one line, then
 * three short lines on what it includes, each with its glyph. A tap chooses it. (Settings >
 * Membership keeps the full cards, MembershipCards, with every feature listed.)
 */
export function MembershipChoices({ testID, value, onChoose }: Props) {
  const accent = useAppTheme().accent.accent;
  // Every tile as tall as the tallest, whatever the text size.
  const [tallest, setTallest] = useState(0);
  function measure(event: LayoutChangeEvent) {
    const height = Math.ceil(event.nativeEvent.layout.height);
    setTallest((current) => (height > current ? height : current));
  }

  return (
    <View testID={testID} style={styles.list}>
      {MEMBERSHIP_OPTIONS.map((option) => {
        const chosen = value === option.tier;
        return (
          <RiseIn key={option.tier}>
            <View
              testID={`${testID}-card-${option.tier}`}
              onLayout={measure}
              style={tallest > 0 ? { minHeight: tallest } : null}
            >
              <ChoiceTile
                testID={`${testID}-${option.tier}`}
                selected={chosen}
                onPress={() => onChoose(option.tier)}
                accessibilityLabel={`${option.name}, free. ${option.summary} ${option.highlights
                  .map((line) => line.text)
                  .join(', ')}.`}
                style={styles.tile}
              >
                <View style={styles.head}>
                  <GlyphWell icon={option.icon} accentColor={accent} size={44} />
                  <View style={styles.headText}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.name, chosen && { color: accent }]}>{option.name}</Text>
                      <View style={[styles.free, { backgroundColor: withAlpha(accent, 0.14) }]}>
                        <Text style={[styles.freeText, { color: accent }]}>Free</Text>
                      </View>
                    </View>
                    <Text style={styles.summary}>{option.summary}</Text>
                  </View>
                </View>
                <View style={styles.highlights}>
                  {option.highlights.map((line) => (
                    <View key={line.text} style={styles.highlight}>
                      <Feather name={line.icon} size={14} color={accent} />
                      <Text style={styles.highlightText}>{line.text}</Text>
                    </View>
                  ))}
                </View>
              </ChoiceTile>
            </View>
          </RiseIn>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  tile: {
    flexGrow: 1,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // Room for the tick in the corner.
    paddingRight: spacing.lg,
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  name: {
    ...typeScale.cardTitle,
    fontFamily: fonts.displayHeavy,
    color: colors.textPrimary,
  },
  free: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  freeText: {
    ...typeScale.caption,
  },
  summary: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  highlights: {
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  highlightText: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
    flex: 1,
  },
});
