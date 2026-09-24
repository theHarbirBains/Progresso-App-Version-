import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '../design/Text';
import { GlassBackground } from '../design/GlassBackground';
import { spacing } from '../design/theme';
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, type MuscleGroup } from './muscleGroups';

interface Props {
  value: MuscleGroup | null;
  onChange: (value: MuscleGroup | null) => void;
  /** Adds a leading "All" chip that clears the filter (null). */
  includeAll?: boolean;
  /** Selected-chip fill/text color. Omit to fall back to the shared default
   * accent (styles.chipSelected); every current call site (library filter,
   * ExerciseFormScreen's screen and sheet presentations) passes the user's
   * Workout accent so the selected chip follows it dynamically. */
  accentColor?: string;
  onAccentColor?: string;
  /** Border/text color for the UNSELECTED chip state. Pass current theme
   * tokens (colors.border / colors.textSecondary) instead of the legacy
   * hardcoded exerciseStyles.chip values -- every current call site does. */
  chipBorderColor?: string;
  chipTextColor?: string;
}

// Shared by the library's filter row (includeAll) and the create/edit
// form's required single-select picker.
export function MuscleGroupChips({
  value,
  onChange,
  includeAll = false,
  accentColor,
  onAccentColor,
  chipBorderColor,
  chipTextColor,
}: Props) {
  const options: (MuscleGroup | null)[] = includeAll
    ? [null, ...MUSCLE_GROUPS]
    : [...MUSCLE_GROUPS];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={localStyles.scroll}
      contentContainerStyle={[styles.chipRow, localStyles.chipRowContent]}
    >
      {options.map((option) => {
        const selected = option === value;
        const label = option === null ? 'All' : MUSCLE_GROUP_LABELS[option];
        return (
          <TouchableOpacity
            key={option ?? 'all'}
            testID={`muscle-group-chip-${option ?? 'all'}`}
            style={[
              styles.chip,
              localStyles.chip,
              chipBorderColor && !selected ? { borderColor: chipBorderColor } : null,
              selected &&
                (accentColor
                  ? { backgroundColor: accentColor, borderColor: accentColor }
                  : styles.chipSelected),
            ]}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            {!selected ? <GlassBackground bordered={false} /> : null}
            <Text
              style={[
                styles.chipText,
                localStyles.chipText,
                chipTextColor && !selected ? { color: chipTextColor } : null,
                selected && (onAccentColor ? { color: onAccentColor } : styles.chipTextSelected),
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// Local to this component only -- does not touch the shared exerciseStyles.ts
// (still relied on above for the base chip look/colors, kept as-is for
// every existing caller). Two layers of defense against the chip row
// rendering as empty/skinny pills, both applied here rather than to the
// shared file:
//
// 1. `scroll`/`chipRowContent` -- DESIGN.md's documented tabs-row layout
//    trap (§12): flexGrow: 0 on the ScrollView keeps the row from ever
//    being stretched by a flex-competing sibling, and alignItems: 'center'
//    on the row stops the row's cross-axis from defaulting to 'stretch'
//    (which would otherwise stretch every chip to whatever height the row
//    resolves to). See settingsStyles.ts's tabsScroll/tabsRow for the same
//    two-part fix, confirmed working there.
// 2. `chip`/`chipText` -- exerciseStyles.chip/chipText (shared, legacy)
//    define color/border/padding but no explicit height or flexShrink, so
//    (1) alone still leaves the chip's actual rendered height entirely up
//    to platform font-metric inference. flexShrink: 0 stops the chip (and
//    its label) from ever being compressed by a surrounding flex context;
//    minHeight is a generous floor (comfortably above what a 13px label +
//    this padding needs) with justifyContent: 'center' to keep the label
//    centered within it, WITHOUT constraining the label's own line box the
//    way an explicit lineHeight/numberOfLines would -- a hardcoded lineHeight
//    smaller than the font's actual rendered line height would clip the
//    label just as badly as the original bug, so this only ever adds
//    headroom, never restricts it.
// Restored inline after screens/exerciseStyles.ts was deleted in fd21bd8
// without updating this file's import -- this component was left as the
// module's only remaining consumer, so these five keys (with their exact
// prior values) are restored here rather than recreating the whole shared
// file. Not a redesign: this keeps the chip's existing look unchanged.
const styles = StyleSheet.create({
  chipRow: {
    gap: 8,
    paddingBottom: 12,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A32',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#0B0B0F',
  },
});

const localStyles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  chipRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    // Overrides exerciseStyles.chipRow's hardcoded `gap: 8` (a raw pixel
    // value, not a DESIGN.md spacing token) with spacing.lg for clearly
    // visible, token-driven breathing room between chips. Later entries in a
    // style array win for the same property, so this doesn't require
    // touching the shared (legacy, out-of-scope-screens-affecting)
    // exerciseStyles.ts file.
    // Overrides exerciseStyles.chipRow's hardcoded `gap: 8` (a raw pixel
    // value, not a DESIGN.md spacing token) with spacing.md for comfortable,
    // token-driven breathing room between chips. Later entries in a style
    // array win for the same property, so this doesn't require touching the
    // shared (legacy, out-of-scope-screens-affecting) exerciseStyles.ts file.
    gap: spacing.md,
    paddingRight: spacing.xxl,
  },
  chip: {
    flexShrink: 0,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    // Overrides exerciseStyles.chip's hardcoded paddingHorizontal: 14 with a
    // spacing token so each chip's own internal breathing room matches the
    // inter-chip gap above -- the chip still sizes to its own label (no
    // flex/width set here), it just gets more room around that label.
    paddingHorizontal: spacing.lg,
    // Clips GlassBackground's absolute fill to the chip's own rounded
    // corners (exerciseStyles.chip's borderRadius) -- without this the
    // unselected chip's dark glass tint would square off past the pill
    // shape.
    overflow: 'hidden',
  },
  chipText: {
    flexShrink: 0,
  },
});
