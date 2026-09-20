import { Feather } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { colors, fonts, radii, spacing } from '../design/theme';

interface Props {
  testID: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  connectLabel: string;
  skipLabel: string;
  onConnect: () => void;
  onSkip: () => void;
}

/**
 * Generic "ask for a permission/connection, or skip" step, shared by the
 * Apple Health and push-notification onboarding steps. Both are currently
 * preference-only placeholders (no real HealthKit/expo-notifications
 * dependency has been approved yet) -- pressing Connect/Allow here just
 * records the user's preference, exactly like pressing Not Now does. Real
 * OS permission requests are a follow-up once a specific dependency is
 * approved.
 */
export function PermissionStep({
  testID,
  icon,
  title,
  description,
  connectLabel,
  skipLabel,
  onConnect,
  onSkip,
}: Props) {
  return (
    <View testID={testID} style={styles.container}>
      <View style={styles.iconCircle}>
        <Feather name={icon} size={32} color={colors.accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      <TouchableOpacity
        testID={`${testID}-connect`}
        style={styles.connectButton}
        onPress={onConnect}
      >
        <Text style={styles.connectButtonText}>{connectLabel}</Text>
      </TouchableOpacity>

      <TouchableOpacity testID={`${testID}-skip`} style={styles.skipButton} onPress={onSkip}>
        <Text style={styles.skipButtonText}>{skipLabel}</Text>
      </TouchableOpacity>
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
    color: colors.textPrimary,
    fontFamily: fonts.display,
    fontSize: 20,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  connectButton: {
    alignSelf: 'stretch',
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  connectButtonText: {
    color: colors.onAccent,
    fontFamily: fonts.display,
    fontSize: 15,
  },
  skipButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  skipButtonText: {
    color: colors.textSecondary,
    fontFamily: fonts.displayMedium,
    fontSize: 14,
  },
});
