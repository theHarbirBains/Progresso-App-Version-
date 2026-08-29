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
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
