import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppCard } from '../design/AppCard';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { Text } from '../design/Text';
import { colors, minTouchTarget, radii, spacing, typeScale } from '../design/theme';
import type { MembershipTier } from '../lib/api';
import { withAlpha } from '../theme/accentColor';
import { useAppTheme } from '../theme/appThemeContext';
import { membershipArea, MEMBERSHIP_OPTIONS } from './membershipTiers';

interface Props {
  testID: string;
  /** The membership chosen, or none yet. */
  value: MembershipTier | null;
  onChoose: (tier: MembershipTier) => void;
  /** The one being saved, to show it busy. */
  saving?: MembershipTier | null;
}

/** How much of the next card shows at the right edge, so it's plain there's more to swipe to. */
const PEEK = 28;
/** The room between two cards. */
const GAP = spacing.md;
/** A card's width before the pager's been measured (tests, the first frame). */
const UNMEASURED_WIDTH = 320;

/**
 * The three memberships as large cards in a row, one at a time: swipe left for the next, its
 * edge showing at the right. Each card says only what it adds -- Workouts lists everything in
 * Workouts; the next says "Everything in Workouts, plus:" and lists Nutrition; the last
 * "Everything in Workouts + Nutrition, plus:" and Trainer Mode -- and ends with a button to choose
 * it and, but for the last, "Swipe for ..." (a tap goes there too). Dots beneath say which is
 * showing and open any of them. Opens on the one chosen. Onboarding's membership step and
 * Settings > Membership.
 */
export function MembershipCards({ testID, value, onChoose, saving = null }: Props) {
  const { accent } = useAppTheme();
  const [width, setWidth] = useState(0);
  const cardWidth = width > 0 ? width - PEEK - GAP : UNMEASURED_WIDTH;
  const interval = cardWidth + GAP;
  const lastIndex = MEMBERSHIP_OPTIONS.length - 1;
  // The furthest the row scrolls: the last card at the right edge.
  const maxOffset = Math.max(0, MEMBERSHIP_OPTIONS.length * interval - GAP - width);
  const offsetOf = (index: number) => Math.min(index * interval, maxOffset);

  const startIndex = Math.max(
    0,
    MEMBERSHIP_OPTIONS.findIndex((option) => option.tier === value),
  );
  const [page, setPage] = useState(startIndex);
  const scroller = useRef<ScrollViewInstance>(null);

  // Once its width is known, open on the one chosen.
  useEffect(() => {
    if (width > 0 && startIndex > 0) {
      scroller.current?.scrollTo({ x: offsetOf(startIndex), animated: false });
    }
    // Only as it's first laid out: a choice made here leaves the card where it is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  function onLayout(event: LayoutChangeEvent) {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next !== width) setWidth(next);
  }

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / interval);
    setPage(Math.max(0, Math.min(lastIndex, index)));
  }

  function goTo(index: number) {
    setPage(index);
    scroller.current?.scrollTo({ x: offsetOf(index), animated: true });
  }

  return (
    <View testID={testID} onLayout={onLayout}>
      <ScrollView
        ref={scroller}
        testID={`${testID}-pager`}
        horizontal
        decelerationRate="fast"
        snapToInterval={interval}
        snapToAlignment="start"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        contentOffset={width > 0 ? { x: offsetOf(startIndex), y: 0 } : undefined}
      >
        {MEMBERSHIP_OPTIONS.map((option, index) => {
          const chosen = value === option.tier;
          // What it adds: the last part it includes -- the rest are the card before's.
          const adds = membershipArea(option.areas[option.areas.length - 1]!);
          const previous = index > 0 ? MEMBERSHIP_OPTIONS[index - 1] : null;
          const next = index < lastIndex ? MEMBERSHIP_OPTIONS[index + 1] : null;
          return (
            <View
              key={option.tier}
              testID={`${testID}-card-${option.tier}`}
              style={{ width: cardWidth, marginRight: next ? GAP : 0 }}
            >
              <AppCard hero={chosen} style={styles.card}>
                <View style={styles.head}>
                  <View style={[styles.icon, { backgroundColor: withAlpha(accent.accent, 0.16) }]}>
                    <Feather name={option.icon} size={22} color={accent.accent} />
                  </View>
                  <View style={styles.headText}>
                    <Text style={styles.name}>{option.name}</Text>
                    <Text style={styles.free}>Free for now</Text>
                  </View>
                  {chosen ? (
                    <Feather
                      testID={`${testID}-chosen-${option.tier}`}
                      name="check-circle"
                      size={22}
                      color={accent.accent}
                    />
                  ) : null}
                </View>
                <Text style={styles.summary}>{option.summary}</Text>

                {previous ? (
                  <View
                    testID={`${testID}-${option.tier}-plus`}
                    style={[styles.plus, { backgroundColor: withAlpha(accent.accent, 0.12) }]}
                  >
                    <Feather name="plus-circle" size={16} color={accent.accent} />
                    <Text style={styles.plusText}>
                      Everything in <Text style={styles.plusName}>{previous.name}</Text>, plus:
                    </Text>
                  </View>
                ) : null}

                <View testID={`${testID}-${option.tier}-${adds.area}`} style={styles.area}>
                  <View style={styles.areaHead}>
                    <Feather name={adds.icon} size={16} color={accent.accent} />
                    <Text style={styles.areaTitle}>{adds.title}</Text>
                  </View>
                  {adds.features.map((feature) => (
                    <View key={feature} style={styles.feature}>
                      <View style={[styles.bullet, { backgroundColor: accent.accent }]} />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.action}>
                  {chosen ? (
                    <SecondaryButton
                      testID={`${testID}-${option.tier}`}
                      label="Your Membership"
                      icon="check"
                      onPress={() => onChoose(option.tier)}
                    />
                  ) : (
                    <PrimaryButton
                      testID={`${testID}-${option.tier}`}
                      label={`Choose ${option.name}`}
                      loading={saving === option.tier}
                      onPress={() => onChoose(option.tier)}
                      accentColor={accent.accent}
                      onAccentColor={accent.onAccent}
                    />
                  )}
                </View>

                {next ? (
                  <TouchableOpacity
                    testID={`${testID}-${option.tier}-next`}
                    style={styles.next}
                    onPress={() => goTo(index + 1)}
                    accessibilityRole="button"
                    accessibilityLabel={`Next: ${next.name}`}
                  >
                    <Text style={[styles.nextText, { color: accent.accent }]}>
                      Swipe for {next.name}
                    </Text>
                    <Feather name="arrow-right" size={16} color={accent.accent} />
                  </TouchableOpacity>
                ) : null}
              </AppCard>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.dots}>
        {MEMBERSHIP_OPTIONS.map((option, index) => (
          <TouchableOpacity
            key={option.tier}
            testID={`${testID}-dot-${index}`}
            onPress={() => goTo(index)}
            accessibilityRole="button"
            accessibilityLabel={`Show ${option.name}`}
            accessibilityState={{ selected: page === index }}
            style={styles.dotHit}
          >
            <View
              style={[
                styles.dot,
                page === index ? { backgroundColor: accent.accent, width: 18 } : null,
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Every card as tall as the tallest, so the row reads as one set.
  card: {
    flex: 1,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: {
    flex: 1,
  },
  name: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  free: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  summary: {
    ...typeScale.callout,
    color: colors.textSecondaryBright,
    marginTop: spacing.md,
  },
  // "Everything in Workouts, plus:" -- a band in the accent's tint.
  plus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  plusText: {
    ...typeScale.callout,
    color: colors.textPrimary,
    flex: 1,
  },
  plusName: {
    ...typeScale.label,
    color: colors.textPrimary,
  },
  area: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  areaHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  areaTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: radii.pill,
    marginTop: 7,
  },
  featureText: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
    flex: 1,
  },
  action: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
  },
  // "Swipe for Workouts + Nutrition ->", under the button -- a tap goes there too.
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: minTouchTarget,
    marginTop: spacing.sm,
  },
  nextText: {
    ...typeScale.label,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  // Each dot a full touch target, though it's drawn small.
  dotHit: {
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.glassBorderStrong,
  },
});
