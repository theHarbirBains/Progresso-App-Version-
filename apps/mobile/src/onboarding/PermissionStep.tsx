import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { PrimaryButton, TextButton } from '../design/Button';
import { GlyphWell } from '../design/GlyphWell';
import { RiseIn } from '../design/RiseIn';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale } from '../design/theme';
import { withAlpha } from '../theme/accentColor';
import { useAppTheme } from '../theme/appThemeContext';

type Glyph = keyof typeof Feather.glyphMap;

interface Props {
  testID: string;
  icon: Glyph;
  title: string;
  description: string;
  /** What allowing it gives, a line each with its glyph. */
  points?: { icon: Glyph; text: string }[];
  connectLabel: string;
  skipLabel: string;
  onConnect: () => void;
  onSkip: () => void;
  /** True while Connect's own work (e.g. a system permission prompt) is in progress; blocks both actions. */
  connectBusy?: boolean;
}

/**
 * Generic "ask for a permission or connection, or skip" onboarding step, as one widget: its glyph
 * in a ringed accent well, the title and a line, and what allowing it gives -- then Allow and Not
 * Now beneath. The caller decides what Connect does.
 */
export function PermissionStep({
  testID,
  icon,
  title,
  description,
  points = [],
  connectLabel,
  skipLabel,
  onConnect,
  onSkip,
  connectBusy = false,
}: Props) {
  const accent = useAppTheme().accent.accent;
  return (
    <View testID={testID} style={styles.container}>
      <RiseIn>
        <AppCard hero style={styles.card}>
          <View style={[styles.halo, { borderColor: withAlpha(accent, 0.22) }]}>
            <View style={[styles.iconCircle, { backgroundColor: withAlpha(accent, 0.16) }]}>
              <Feather name={icon} size={30} color={accent} />
            </View>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          {points.length > 0 ? (
            <View style={styles.points}>
              {points.map((point) => (
                <View key={point.text} style={styles.point}>
                  <GlyphWell icon={point.icon} accentColor={accent} size={32} />
                  <Text style={styles.pointText}>{point.text}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </AppCard>
      </RiseIn>

      <RiseIn>
        <View style={styles.actions}>
          <PrimaryButton
            testID={`${testID}-connect`}
            label={connectLabel}
            onPress={onConnect}
            loading={connectBusy}
          />
          <TextButton
            testID={`${testID}-skip`}
            label={skipLabel}
            onPress={onSkip}
            disabled={connectBusy}
          />
        </View>
      </RiseIn>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.lg,
    gap: spacing.xl,
  },
  card: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  halo: {
    width: 92,
    height: 92,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    ...typeScale.callout,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  points: {
    alignSelf: 'stretch',
    gap: spacing.md,
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pointText: {
    ...typeScale.callout,
    color: colors.textSecondaryBright,
    flex: 1,
  },
  actions: {
    gap: spacing.sm,
  },
});
