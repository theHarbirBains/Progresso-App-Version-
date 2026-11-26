import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Skeleton } from '../design/Skeleton';
import { Text } from '../design/Text';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { useProfileIfAny } from '../profile/profileContext';
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, type MuscleGroup } from './muscleGroups';
import { MUSCLE_TILES } from './muscleTiles.generated';

const TILE_WIDTH = 100;
const TILE_HEIGHT = 116;
const TILE_GAP = spacing.sm;
/** How faint the other tiles go while one is chosen: still there, a tap away. */
const UNCHOSEN_OPACITY = 0.55;

/** Whose figures the tiles show: a woman's for a woman, a man's otherwise. */
export function figureSexFor(gender: string | null | undefined): 'male' | 'female' {
  return gender === 'female' ? 'female' : 'male';
}

/**
 * One group's tile. Chosen, an accent outline fades in round it; while another is chosen it goes
 * faint, never away. A press gives a small spring, so the tap is felt. All on the native driver,
 * and still under Reduce Motion.
 */
function Tile({
  group,
  count,
  sex,
  chosen,
  anyChosen,
  accentColor,
  onPress,
  testID,
}: {
  group: MuscleGroup;
  count: number;
  sex: 'male' | 'female';
  chosen: boolean;
  anyChosen: boolean;
  accentColor: string;
  onPress: () => void;
  testID: string;
}) {
  const reduceMotion = useReduceMotionPreference();
  const outline = useRef(new Animated.Value(chosen ? 1 : 0)).current;
  const presence = useRef(new Animated.Value(anyChosen && !chosen ? UNCHOSEN_OPACITY : 1)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const to = { outline: chosen ? 1 : 0, presence: anyChosen && !chosen ? UNCHOSEN_OPACITY : 1 };
    if (reduceMotion) {
      outline.setValue(to.outline);
      presence.setValue(to.presence);
      return;
    }
    Animated.parallel([
      Animated.timing(outline, {
        toValue: to.outline,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(presence, {
        toValue: to.presence,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [chosen, anyChosen, reduceMotion, outline, presence]);

  const springTo = (value: number) => {
    if (reduceMotion) return;
    Animated.spring(press, {
      toValue: value,
      stiffness: 320,
      damping: 22,
      mass: 1,
      useNativeDriver: true,
    }).start();
  };

  const tile = MUSCLE_TILES[sex][group];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={() => springTo(0.95)}
      onPressOut={() => springTo(1)}
      accessibilityRole="button"
      accessibilityLabel={`${MUSCLE_GROUP_LABELS[group]}, ${count} exercises`}
      accessibilityState={{ selected: chosen }}
      accessibilityHint={chosen ? 'Shows every muscle again' : undefined}
    >
      <Animated.View style={[styles.tile, { opacity: presence, transform: [{ scale: press }] }]}>
        {tile ? (
          <Image
            testID={`${testID}-${sex}`}
            source={tile.image}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="top"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={styles.glyph}>
            <Feather
              name={group === 'full_body' ? 'user' : 'grid'}
              size={28}
              color={colors.textMuted}
            />
          </View>
        )}
        <View style={styles.words}>
          <Text style={styles.name} numberOfLines={1}>
            {MUSCLE_GROUP_LABELS[group]}
          </Text>
          <Text style={[styles.count, { color: accentColor }]}>{count}</Text>
        </View>
        <Animated.View
          pointerEvents="none"
          testID={chosen ? `${testID}-chosen` : undefined}
          style={[styles.outline, { borderColor: accentColor, opacity: outline }]}
        />
      </Animated.View>
    </Pressable>
  );
}

/**
 * The library's and the picker's Browse by Muscle -- the muscle filter itself: a sideways row of
 * tiles, one for each muscle group with exercises -- Harbir's figure of that group, a man's or a
 * woman's by the person's sex (their profile's; a man's when it says neither), the group's name
 * over its faded bottom and how many exercises are for it in the accent. A tap shows just that
 * group's exercises; the tile stays outlined in the accent and the rest stay, fainter, so it's
 * clear what's shown -- a tap on it again shows every muscle. The chosen tile scrolls into view.
 * Full Body and Other, which have no figure, show a glyph.
 */
export function MuscleBrowseStrip({
  counts,
  chosen = null,
  onChoose,
  accentColor,
  testID = 'muscle-browse',
}: {
  counts: Partial<Record<MuscleGroup, number>>;
  /** The muscle the list is showing, if any. */
  chosen?: MuscleGroup | null;
  /** A tile tapped: its group, or null when it was the one chosen (show every muscle again). */
  onChoose: (group: MuscleGroup | null) => void;
  accentColor: string;
  testID?: string;
}) {
  const sex = figureSexFor(useProfileIfAny()?.gender);
  const scroller = useRef<ScrollViewInstance>(null);
  // The chosen group stays a tile even if what else is chosen leaves it no exercises.
  const groups = MUSCLE_GROUPS.filter((group) => (counts[group] ?? 0) > 0 || group === chosen);
  const chosenIndex = chosen ? groups.indexOf(chosen) : -1;

  useEffect(() => {
    if (chosenIndex < 0) return;
    scroller.current?.scrollTo({
      x: Math.max(0, chosenIndex * (TILE_WIDTH + TILE_GAP) - TILE_WIDTH / 2),
      animated: true,
    });
  }, [chosenIndex]);

  if (groups.length === 0) return null;
  return (
    <View testID={testID} style={styles.wrap}>
      <Text style={styles.kicker}>BROWSE BY MUSCLE</Text>
      <ScrollView
        ref={scroller}
        keyboardDismissMode="on-drag"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {groups.map((group) => (
          <Tile
            key={group}
            testID={`${testID}-${group}`}
            group={group}
            count={counts[group] ?? 0}
            sex={sex}
            chosen={group === chosen}
            anyChosen={chosen !== null}
            accentColor={accentColor}
            onPress={() => onChoose(group === chosen ? null : group)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/** Browse by Muscle while the exercises are read: the kicker and a row of tile-shaped placeholders. */
export function MuscleBrowseSkeleton({ testID = 'muscle-browse-loading' }: { testID?: string }) {
  return (
    <View testID={testID} style={styles.wrap}>
      <Skeleton width={120} height={10} />
      <View style={styles.skeletonRow}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width={TILE_WIDTH} height={TILE_HEIGHT} radius={radii.md} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  kicker: {
    ...typeScale.caption,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  row: {
    gap: TILE_GAP,
    // Room for a pressed tile's spring and the outline.
    paddingVertical: 2,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: TILE_GAP,
    overflow: 'hidden',
  },
  tile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  outline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.md,
    borderWidth: 2,
  },
  glyph: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
  },
  // The name and count over the figure's faded bottom, as on Harbir's tiles.
  words: {
    position: 'absolute',
    left: spacing.xs,
    right: spacing.xs,
    bottom: spacing.sm,
    alignItems: 'center',
  },
  name: {
    ...typeScale.label,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  count: {
    ...typeScale.caption,
    fontFamily: fonts.mono,
  },
});
