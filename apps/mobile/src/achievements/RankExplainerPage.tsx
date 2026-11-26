import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { AppHeader } from '../design/AppHeader';
import { colors, spacing } from '../design/theme';
import { RankExplainer } from './RankExplainer';

/**
 * How ranks work, as a page of its own over whatever opened it -- an iPhone page sheet, swiped
 * down or closed with its X. Onboarding opens it from How ranks work, so the step itself stays a
 * line and a button.
 */
export function RankExplainerPage({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View testID="rank-explainer-page" style={styles.page}>
        <AppHeader
          title="How Ranks Work"
          safeArea={false}
          rightAction={{
            icon: 'x',
            onPress: onClose,
            accessibilityLabel: 'Close',
            testID: 'rank-explainer-page-close',
          }}
        />
        <ScrollView keyboardDismissMode="on-drag" contentContainerStyle={styles.content}>
          <RankExplainer />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.md,
  },
  content: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
});
