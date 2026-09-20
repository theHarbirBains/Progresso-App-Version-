import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '../design/Text';
import { IconButton } from '../design/IconButton';
import { colors } from '../design/theme';
import { progressStyles as styles } from './progressStyles';

interface Props {
  /** Opens the app-level side menu, in whichever mode is currently active. */
  onOpenMenu: () => void;
  /** The "PROGRESS" eyebrow's color -- the active mode's accent (Workout blue today; Progress is Workout-only). */
  accentColor: string;
  /** The shared ModeToggle, rendered by the caller (it owns the mode state/handlers) but placed here, between the chrome row and the heading -- matching the reference's composition. */
  modeToggle: ReactNode;
  /** Defaults to true. The Overview tab already shows its own "Your Progress" stat card right below this header, making the "Track Your Growth" heading + supporting text redundant there -- pass false to hide them, while keeping the eyebrow-less spacing otherwise identical. */
  showHeading?: boolean;
  testID?: string;
}

/**
 * Progress's own header: a centered "Progress" title row (hamburger left,
 * balanced by an equal-width empty spacer on the right -- no notification
 * bell any more, matching every page's header now; the symmetric-slot
 * centering pattern itself is unchanged, see design/AppHeader.tsx), then
 * the Workout/Nutrition mode toggle, then -- only outside the Overview
 * tab, see `showHeading` -- a compact eyebrow + heading + supporting text
 * ("PROGRESS" / "Track Your Growth" / "Consistency today. A stronger
 * tomorrow."). Progress's *internal* section navigation is the horizontal
 * CategoryTabs row below this header, not this component -- the two are
 * unrelated concerns.
 */
export function ProgressHeader({
  onOpenMenu,
  accentColor,
  modeToggle,
  showHeading = true,
  testID,
}: Props) {
  return (
    <View testID={testID}>
      <View style={styles.topBar}>
        <IconButton
          testID="progress-open-menu"
          icon="menu"
          onPress={onOpenMenu}
          accessibilityLabel="Open menu"
          color={colors.textSecondaryBright}
        />
        <Text style={styles.wordmark}>Progress</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.modeToggleWrap}>{modeToggle}</View>

      {showHeading ? (
        <View style={styles.headingBlock}>
          <Text style={[styles.eyebrow, { color: accentColor }]}>PROGRESS</Text>
          <Text style={styles.heading}>Track Your Growth</Text>
          <Text testID="progress-header-subtitle" style={styles.headingSupporting}>
            Consistency today.{'\n'}A stronger tomorrow.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
