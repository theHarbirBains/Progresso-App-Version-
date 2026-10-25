import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { PrimaryButton, TextButton } from '../design/Button';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale } from '../design/theme';
import { useAppTheme } from '../theme/appThemeContext';

interface Props {
  testID: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  connectLabel: string;
  skipLabel: string;
  onConnect: () => void;
  onSkip: () => void;
  /** True while Connect's own work (e.g. a system permission prompt) is in progress; blocks both actions. */
  connectBusy?: boolean;
}

/** Generic "ask for a permission or connection, or skip" onboarding step; the caller decides what Connect does. */
export function PermissionStep({
  testID,
  icon,
  title,
  description,
  connectLabel,
  skipLabel,
  onConnect,
  onSkip,
  connectBusy = false,
}: Props) {
  const accent = useAppTheme().accent.accent;
  return (
    <View testID={testID} style={styles.container}>
      <View style={styles.iconCircle}>
        <Feather name={icon} size={32} color={accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    ...typeScale.callout,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  actions: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
});
