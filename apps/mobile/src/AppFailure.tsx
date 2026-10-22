import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from './design/theme';
import { recordQuietFailure } from './lib/sentry';

// What the app shows when it fails outright -- while its code is loading (index.ts) or while
// drawing a screen (AppErrorBoundary) -- instead of a blank screen. It says what went wrong, so
// the failure can be reported and fixed. Deliberately plain: it may show before the app's fonts
// load and without anything else of the app's working, so it uses only react-native, the theme's
// colours and the system face.

/** The failure in words: its message, or what was thrown. */
function describe(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

interface Props {
  error: unknown;
  /** Offered after a screen failed to draw; a failure while loading has nothing to retry. */
  onRetry?: () => void;
}

export function AppFailure({ error, onRetry }: Props) {
  return (
    <View testID="app-failure" style={styles.screen}>
      <Text style={styles.title}>Progresso hit a problem</Text>
      <Text style={styles.body}>
        {onRetry
          ? 'Something went wrong on this screen. Try again, or close Progresso and open it again.'
          : 'Something went wrong while Progresso was opening. Close it and open it again.'}{' '}
        If it keeps happening, send this to Progresso:
      </Text>
      <ScrollView style={styles.detail} contentContainerStyle={styles.detailContent}>
        <Text testID="app-failure-message" selectable style={styles.message}>
          {describe(error)}
        </Text>
      </ScrollView>
      {onRetry ? (
        <Pressable
          testID="app-failure-retry"
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
        >
          <Text style={styles.buttonLabel}>Try Again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Shows AppFailure, rather than a blank screen, when a screen throws while drawing. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    recordQuietFailure('app.render', error);
    if (info.componentStack) console.error(info.componentStack);
  }

  render() {
    if (this.state.error !== null) {
      return <AppFailure error={this.state.error} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xxl,
    paddingTop: 96,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  body: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
  },
  detail: {
    flexGrow: 0,
    maxHeight: 240,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
  },
  detailContent: {
    padding: spacing.md,
  },
  message: {
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: 'Menlo',
  },
  button: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    backgroundColor: colors.heroAction,
  },
  pressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '700',
  },
});
