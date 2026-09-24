import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { PrimaryButton, TextButton } from '../design/Button';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale } from '../design/theme';

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

      <View style={styles.actions}>
        <PrimaryButton testID={`${testID}-connect`} label={connectLabel} onPress={onConnect} />
        <TextButton testID={`${testID}-skip`} label={skipLabel} onPress={onSkip} />
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
