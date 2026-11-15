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
import { MEMBERSHIP_AREAS, MEMBERSHIP_OPTIONS } from './membershipTiers';

interface Props {
  testID: string;
  /** The membership chosen, or none yet. */
  value: MembershipTier | null;
  onChoose: (tier: MembershipTier) => void;
  /** The one being saved, to show it busy. */
  saving?: MembershipTier | null;
}

/**
 * The three memberships as large cards side by side, one to a page: swipe left for the next.
 * Each lists everything it includes, part by part (Workouts, Nutrition, Trainer Mode -- a part it
 * leaves out says so), and ends with a button to choose it. Opens on the one chosen. Onboarding's
 * membership step and Settings > Membership.
 */
export function MembershipCards({ testID, value, onChoose, saving = null }: Props) {
  const { accent } = useAppTheme();
  const [width, setWidth] = useState(0);
  const startIndex = Math.max(
    0,
    MEMBERSHIP_OPTIONS.findIndex((option) => option.tier === value),
  );
  const [page, setPage] = useState(startIndex);
  const scroller = useRef<ScrollViewInstance>(null);

  // Once its width is known, open on the one chosen.
  useEffect(() => {
    if (width > 0 && startIndex > 0) {
      scroller.current?.scrollTo({ x: startIndex * width, animated: false });
    }
    // Only as it's first laid out: a choice made here leaves the page where it is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  function onLayout(event: LayoutChangeEvent) {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next !== width) setWidth(next);
  }

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width <= 0) return;
    setPage(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  function goTo(index: number) {
    setPage(index);
    scroller.current?.scrollTo({ x: index * width, animated: true });
  }

  return (
    <View testID={testID} onLayout={onLayout}>
      <ScrollView
        ref={scroller}
        testID={`${testID}-pager`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        contentOffset={width > 0 ? { x: startIndex * width, y: 0 } : undefined}
      >
        {MEMBERSHIP_OPTIONS.map((option) => {
          const chosen = value === option.tier;
          return (
            <View
              key={option.tier}
              style={[styles.page, width > 0 ? { width } : styles.unmeasured]}
              testID={`${testID}-card-${option.tier}`}
            >
              <AppCard hero={chosen}>
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

                {MEMBERSHIP_AREAS.map((area) => {
                  const included = option.areas.includes(area.area);
                  return (
                    <View
                      key={area.area}
                      testID={`${testID}-${option.tier}-${area.area}`}
                      style={styles.area}
                    >
                      <View style={styles.areaHead}>
                        <Feather
                          name={area.icon}
                          size={16}
                          color={included ? accent.accent : colors.textMuted}
                        />
                        <Text style={[styles.areaTitle, !included && styles.areaTitleOff]}>
                          {area.title}
                        </Text>
                      </View>
                      {included ? (
                        area.features.map((feature) => (
                          <View key={feature} style={styles.feature}>
                            <View style={[styles.bullet, { backgroundColor: accent.accent }]} />
                            <Text style={styles.featureText}>{feature}</Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.notIncluded}>Not included</Text>
                      )}
                    </View>
                  );
                })}

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
      <Text style={styles.hint}>Swipe to see each membership</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Each page is the pager's full width; the card keeps a little room either side while it moves.
  page: {
    paddingHorizontal: spacing.xs,
  },
  unmeasured: {
    width: 320,
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
  areaTitleOff: {
    color: colors.textMuted,
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
  notIncluded: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  action: {
    marginTop: spacing.xl,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
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
  hint: {
    ...typeScale.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
