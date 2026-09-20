import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from './theme';

interface Props {
  testID?: string;
}

export function LoadingState({ testID }: Props) {
  return (
    <View style={styles.container}>
      <ActivityIndicator testID={testID} size="large" color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Kept on the static default rather than 'transparent': this shared
    // component is also used by OnboardingScreen, which is explicitly out
    // of scope for the Background Theme feature.
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
