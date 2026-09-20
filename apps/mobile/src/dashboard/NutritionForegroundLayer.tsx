import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useBackgroundTheme } from '../design/backgroundThemeStore';
import { spacing } from '../design/theme';

// Kept to `spacing.lg` deliberately -- Dashboard's tightest real text inset
// is the greeting row's 20px scroll padding (spacing.xl, no card behind it),
// so anything narrower than that can never land on top of a letter. An
// earlier, wider version of this window (90px) covered actual text --
// "Good " in the greeting, the entire "Protein" macro, most of "Search
// Food" -- which is exactly what this effect must never do. Keep this at
// or below spacing.xl unless every text inset on this screen is re-checked.
const LEFT_WINDOW_WIDTH = spacing.lg;
const BOTTOM_WINDOW_HEIGHT = 190;

interface Props {
  /**
   * Always mounted by DashboardScreen (both modes), toggling this instead of
   * conditionally rendering the component -- the same "keep it decoded,
   * just flip opacity" approach AppBackgroundLayer uses for the Workout/
   * Nutrition photo swap itself, so entering Nutrition mode never pays a
   * first-time image-decode cost of its own.
   */
  visible: boolean;
}

// Nutrition Mode's readability pass darkened every widget's glass, which
// would otherwise flatten the background photo's own foreground objects
// (the plant on the left edge, the table/bowl/bottle at the bottom) into
// the same dim wash as the rest of the scene behind the cards. This layer
// re-reveals exactly those two screen regions at full brightness, drawn
// *above* the widgets (mounted after the ScrollView in DashboardScreen,
// below the fixed header/bottom bar's own zIndex 10) -- background image,
// then widgets, then these foreground slivers, matching the depth/parallax
// composition the Nutrition Mode visual reference calls for.
//
// The underlying NutritionBackground.png (or whichever Background Theme's
// own nutritionImageSource is active) is never cropped, recolored, or
// otherwise modified -- this renders a second, full-size copy of the exact
// same image, sized and positioned identically to the real background layer
// (see AppBackgroundLayer.tsx's own useWindowDimensions-based sizing), and
// only lets a small clipped window of it show through. Because both copies
// use the same image, the same full-screen size, and the same `cover` fit,
// whatever appears in each window lines up pixel-for-pixel with the real
// background directly beneath it -- there is no separate crop/asset to keep
// in sync if the photo or device size ever changes.
export function NutritionForegroundLayer({ visible }: Props) {
  const { theme } = useBackgroundTheme();
  const { width, height } = useWindowDimensions();
  const imageSource = theme.nutritionImageSource;

  if (!imageSource) return null;

  const fullScreenStyle = { position: 'absolute' as const, top: 0, left: 0, width, height };
  const bottomWindowTop = height - BOTTOM_WINDOW_HEIGHT;
  const opacity = visible ? 1 : 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="nutrition-foreground-layer">
      <View
        testID="nutrition-foreground-left-window"
        style={[styles.leftWindow, { width: LEFT_WINDOW_WIDTH, height, opacity }]}
      >
        <Image
          testID="nutrition-foreground-left-image"
          source={imageSource}
          style={fullScreenStyle}
          resizeMode="cover"
        />
      </View>
      <View
        testID="nutrition-foreground-bottom-window"
        style={[
          styles.bottomWindow,
          { top: bottomWindowTop, width, height: BOTTOM_WINDOW_HEIGHT, opacity },
        ]}
      >
        <Image
          testID="nutrition-foreground-bottom-image"
          source={imageSource}
          style={[fullScreenStyle, { top: -bottomWindowTop }]}
          resizeMode="cover"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  leftWindow: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  bottomWindow: {
    position: 'absolute',
    left: 0,
    overflow: 'hidden',
  },
});
