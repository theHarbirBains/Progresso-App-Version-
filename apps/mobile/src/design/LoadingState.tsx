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
    // Transparent, so a loading screen shows the same warm background
    // (photo included) as the screen it is loading, with no flash.
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
