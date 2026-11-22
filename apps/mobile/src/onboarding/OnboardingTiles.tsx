import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChoiceTile } from '../design/ChoiceTile';
import { GlyphWell } from '../design/GlyphWell';
import { RiseIn } from '../design/RiseIn';
import { Text } from '../design/Text';
import { colors, fonts, spacing, typeScale } from '../design/theme';
import { useAppTheme } from '../theme/appThemeContext';

export interface TileOption<T> {
  value: T;
  /** What it is, in words -- and what VoiceOver reads. */
  label: string;
  /** A Feather glyph in an accent well, over the label. */
  icon?: keyof typeof Feather.glyphMap;
  /** Any other mark in the glyph's place (a sex's own symbol). */
  art?: ReactNode;
  /** A figure in place of a glyph ("3", "45-60"), with `unit` under it. */
  figure?: string;
  unit?: string;
}

interface Props<T> {
  testID: string;
  /** Each tile's testID is `${tilePrefix}-${value}`. */
  tilePrefix: string;
  options: TileOption<T>[];
  isSelected: (value: T) => boolean;
  onPress: (value: T) => void;
  /** Dimmed and not pickable (a pick-several set that already has its most). */
  isDisabled?: (value: T) => boolean;
  columns?: 2 | 3;
}

/**
 * An onboarding question's answers as a grid of widget tiles (`ChoiceTile`s), two or three
 * across: each a glyph in an accent well (or a figure) over its name, the one chosen ticked
 * with the accent's edge. A last row that's short keeps its tiles the size of the rest. Each row
 * rises in as the question opens (RiseIn).
 */
export function OnboardingTiles<T extends string | number>({
  testID,
  tilePrefix,
  options,
  isSelected,
  onPress,
  isDisabled,
  columns = 2,
}: Props<T>) {
  const accent = useAppTheme().accent.accent;
  const rows: TileOption<T>[][] = [];
  for (let i = 0; i < options.length; i += columns) rows.push(options.slice(i, i + columns));

  return (
    <View testID={testID} style={styles.grid}>
      {rows.map((row, r) => (
        <RiseIn key={r}>
          <View style={styles.row}>
            {row.map((option) => {
              const selected = isSelected(option.value);
              return (
                <ChoiceTile
                  key={String(option.value)}
                  testID={`${tilePrefix}-${option.value}`}
                  selected={selected}
                  disabled={isDisabled?.(option.value) ?? false}
                  onPress={() => onPress(option.value)}
                  accessibilityLabel={option.label}
                  style={styles.cell}
                >
                  <View style={[styles.tile, option.figure ? styles.figureTile : null]}>
                    {option.figure ? (
                      <>
                        <Text
                          style={[styles.figure, { color: selected ? accent : colors.textPrimary }]}
                        >
                          {option.figure}
                        </Text>
                        {option.unit ? <Text style={styles.unit}>{option.unit}</Text> : null}
                      </>
                    ) : (
                      <>
                        {option.art ??
                          (option.icon ? (
                            <GlyphWell icon={option.icon} accentColor={accent} size={40} />
                          ) : null)}
                        <Text style={[styles.label, selected && { color: accent }]}>
                          {option.label}
                        </Text>
                      </>
                    )}
                  </View>
                </ChoiceTile>
              );
            })}
            {/* A short last row keeps its tiles the size of the rest. */}
            {Array.from({ length: columns - row.length }, (_, i) => (
              <View key={`gap-${i}`} style={styles.cell} />
            ))}
          </View>
        </RiseIn>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cell: {
    flex: 1,
  },
  tile: {
    minHeight: 92,
    gap: spacing.md,
    justifyContent: 'space-between',
    // Room for the tick in the corner.
    paddingRight: spacing.lg,
  },
  figureTile: {
    minHeight: 76,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  label: {
    ...typeScale.callout,
    fontFamily: fonts.display,
    color: colors.textPrimary,
  },
  figure: {
    ...typeScale.statLarge,
  },
  unit: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
});
