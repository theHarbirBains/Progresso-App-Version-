import type { ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from './Text';
import { colors, fonts, minTouchTarget, radii, spacing, typeScale } from './theme';

interface Props {
  title: string;
  subtitle?: string;
  /** An optional third, quieter line under the subtitle (a summary, a list of days). One line, truncated. */
  detail?: string;
  /** testID for the title text itself, for a screen that needs to assert on it. */
  titleTestID?: string;
  /** A Feather glyph shown in a small neutral well on the left. Ignored when `leading` is given. */
  icon?: keyof typeof Feather.glyphMap;
  /** Fully custom leading content (an avatar, a thumbnail). Takes precedence over `icon`. */
  leading?: ReactNode;
  /** A short trailing value ("120 lb", "On"). Shown in the mono readout face -- for numbers; use `trailing` for anything else. */
  value?: string;
  /** Fully custom trailing content (a Toggle, a Badge). Takes precedence over `value` and the chevron. */
  trailing?: ReactNode;
  /** Shows a trailing chevron. Defaults to true for a pressable row, false otherwise. */
  chevron?: boolean;
  onPress?: () => void;
  /** Hairline above the row -- set on every row but the first in a group. */
  divider?: boolean;
  /** Title in the destructive color, for a destructive action row. */
  destructive?: boolean;
  disabled?: boolean;
  /** Defaults to "title, subtitle". */
  accessibilityLabel?: string;
  testID?: string;
}

// The one list-row pattern -- generalised from the Settings row (icon well +
// title/subtitle + trailing chevron/value/control) so history entries,
// exercises, meals, splits and settings all read as one family. A group of
// rows separated by `divider` hairlines replaces the "card per item" look:
// the rows are the content, and they sit directly on the screen.
export function ListRow({
  title,
  subtitle,
  detail,
  titleTestID,
  icon,
  leading,
  value,
  trailing,
  chevron,
  onPress,
  divider,
  destructive,
  disabled,
  accessibilityLabel,
  testID,
}: Props) {
  const showChevron = chevron ?? Boolean(onPress);
  const body = (
    <>
      {leading ? (
        leading
      ) : icon ? (
        <View style={styles.iconWell}>
          <Feather
            name={icon}
            size={18}
            color={destructive ? colors.destructive : colors.textSecondary}
          />
        </View>
      ) : null}

      <View style={styles.body}>
        <Text
          testID={titleTestID}
          style={[styles.title, destructive && styles.destructiveTitle]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {detail ? (
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>

      {trailing ? (
        trailing
      ) : (
        <>
          {value ? <Text style={styles.value}>{value}</Text> : null}
          {showChevron ? <Feather name="chevron-right" size={18} color={colors.textMuted} /> : null}
        </>
      )}
    </>
  );

  const frameStyle = [styles.row, divider && styles.divider, disabled && styles.disabled];

  if (!onPress) {
    return (
      <View testID={testID} style={frameStyle}>
        {body}
      </View>
    );
  }

  return (
    <TouchableOpacity
      testID={testID}
      style={frameStyle}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      {body}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget + spacing.md,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  disabled: {
    opacity: 0.5,
  },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  title: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  destructiveTitle: {
    color: colors.destructive,
  },
  subtitle: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
  detail: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  value: {
    ...typeScale.statSmall,
    color: colors.textSecondary,
  },
});
