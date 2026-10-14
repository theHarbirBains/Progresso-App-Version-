import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Skeleton, SkeletonCards } from './Skeleton';
import { radii, spacing } from './theme';

interface Props {
  testID?: string;
  /**
   * Inside a screen that already shows its own header: just the cards.
   * Default false -- a whole page still loading gets a header bar too, so the
   * page has its shape from the first frame.
   */
  inline?: boolean;
}

// What a page shows while its data loads: the page's shape -- a header bar and
// a few card-shaped placeholders that gently pulse (still under Reduce
// Motion) -- rather than a blank screen and a spinner, so the real content
// lands in place instead of popping in.
export function LoadingState({ testID, inline = false }: Props) {
  const insets = useSafeAreaInsets();
  if (inline) {
    return <SkeletonCards testID={testID} />;
  }
  return (
    <View style={[styles.page, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <Skeleton width={128} height={20} radius={radii.sm} />
      </View>
      <SkeletonCards testID={testID} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    // Transparent, so a loading screen shows the same warm background
    // (photo included) as the screen it is loading, with no flash.
    backgroundColor: 'transparent',
  },
  // The header's own height (an icon button's row), with its title centred.
  header: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
});
