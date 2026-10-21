import { StyleSheet, View } from 'react-native';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton } from '../design/Button';
import { Text } from '../design/Text';
import { WheelPicker } from '../design/WheelPicker';
import { colors, spacing, typeScale } from '../design/theme';
import { formatRepRange, type RepRange } from '../workouts/progression';
import { settingsStyles } from './settingsStyles';

const RANGE_VALUES = Array.from({ length: 50 }, (_, i) => String(i + 1));

interface Props {
  /** The range being chosen; null while the sheet is closed. */
  draft: RepRange | null;
  onChangeDraft: (draft: RepRange) => void;
  onClose: () => void;
  onSave: (range: RepRange) => void;
  accentColor?: string;
  onAccentColor?: string;
}

/**
 * The person's own rep range, From and To on two wheels (1-50 each; a range may be one number).
 * One filled Save names the range and is held, with a line saying why, while the bottom is
 * above the top. Settings > Workout Preferences and the live workout's header both open it.
 */
export function RepRangeSheet({
  draft,
  onChangeDraft,
  onClose,
  onSave,
  accentColor,
  onAccentColor,
}: Props) {
  const valid = draft !== null && draft.min <= draft.max;
  return (
    <BottomSheet visible={draft !== null} onClose={onClose} testID="rep-range-sheet">
      <Text style={[settingsStyles.rowTitle, { color: colors.textPrimary }]}>Rep Range</Text>
      <Text style={styles.help}>
        When an exercise&apos;s top set reaches the top of your range, it&apos;s time to go heavier.
      </Text>
      {draft ? (
        <View style={styles.wheels}>
          <View style={styles.wheel}>
            <Text style={styles.wheelLabel}>From</Text>
            <WheelPicker
              testID="rep-range-min"
              values={RANGE_VALUES}
              selectedValue={String(draft.min)}
              onChange={(value) => onChangeDraft({ ...draft, min: Number(value) })}
            />
          </View>
          <View style={styles.wheel}>
            <Text style={styles.wheelLabel}>To</Text>
            <WheelPicker
              testID="rep-range-max"
              values={RANGE_VALUES}
              selectedValue={String(draft.max)}
              onChange={(value) => onChangeDraft({ ...draft, max: Number(value) })}
            />
          </View>
        </View>
      ) : null}
      {draft && !valid ? (
        <Text testID="rep-range-error" style={settingsStyles.errorText}>
          The bottom of the range can&apos;t be above the top.
        </Text>
      ) : null}
      <PrimaryButton
        testID="rep-range-save"
        label={valid ? `Save ${formatRepRange(draft)}` : 'Save'}
        onPress={() => {
          if (draft && valid) onSave(draft);
        }}
        disabled={!valid}
        accentColor={accentColor}
        onAccentColor={onAccentColor}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  help: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  wheels: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginVertical: spacing.lg,
  },
  wheel: {
    flex: 1,
    gap: spacing.xs,
  },
  wheelLabel: {
    ...typeScale.label,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
