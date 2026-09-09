import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, typeScale } from './theme';

interface Props {
  title?: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  icon?: ReactNode;
  testID?: string;
}

// Component Logic: mirrors EmptyState's minimal icon/title/message layout
// (same spacing, same centered treatment) and reuses a plain text "Retry"
// action rather than pulling in a filled destructive button -- retrying
// isn't itself a destructive action, so it stays visually calm.
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retrying,
  icon,
  testID,
}: Props) {
  return (
    <View style={styles.container}>
      {icon}
      <Text style={styles.title}>{title}</Text>
      <Text testID={testID} style={styles.message}>
        {message}
      </Text>
      {onRetry ? (
        <TouchableOpacity
          testID={testID ? `${testID}-retry` : undefined}
          onPress={onRetry}
          disabled={retrying}
          style={styles.retry}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          accessibilityState={{ disabled: Boolean(retrying) }}
        >
          {retrying ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={styles.retryText}>Retry</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  retry: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  retryText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
});
