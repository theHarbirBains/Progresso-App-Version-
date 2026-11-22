import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Polyline, Stop } from 'react-native-svg';
import { AppCard } from '../design/AppCard';
import { GlyphWell } from '../design/GlyphWell';
import { RiseIn } from '../design/RiseIn';
import { Text } from '../design/Text';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';
import { withAlpha } from '../theme/accentColor';
import { useAppTheme } from '../theme/appThemeContext';
import { RankEmblem } from './RankEmblem';
import { TIERS } from './ranks';

// The climb: nine emblems rising left to right, Legacy the largest at the top.
const CLIMB_HEIGHT = 112;
const EMBLEM = 28;
const TOP_EMBLEM = 40;
const RISE = 8;
const EDGE = TOP_EMBLEM / 2;

const EARN: { icon: keyof typeof Feather.glyphMap; title: string; line: string }[] = [
  { icon: 'zap', title: 'Train and log', line: 'Workouts, sets and cardio count' },
  { icon: 'award', title: 'Earn achievements', line: 'Every level gives you AP' },
  { icon: 'trending-up', title: 'Climb the ranks', line: 'No seasons, no decay' },
];

/**
 * Onboarding's How ranks work, as widgets: where everyone starts -- Bronze V's emblem, "0 AP" and
 * how far Silver is -- then the nine ranks as a climb (each tier's emblem rising left to right
 * along a line that runs from Bronze's colour to Legacy's, Legacy largest at the top, the two
 * ends named with the AP they start at), then three tiles on how points are earned. VoiceOver
 * reads the climb as one line, lowest first.
 */
export function RankClimb({ testID }: { testID?: string }) {
  const accent = useAppTheme().accent.accent;
  const [width, setWidth] = useState(0);
  const bronze = TIERS[0]!;
  const silver = TIERS[1]!;
  const legacy = TIERS[TIERS.length - 1]!;
  const last = TIERS.length - 1;

  function onLayout(event: LayoutChangeEvent) {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next !== width) setWidth(next);
  }
  // Each emblem's centre on the climb.
  const points = TIERS.map((_, i) => ({
    x: EDGE + ((width - EDGE * 2) * i) / last,
    y: CLIMB_HEIGHT - EDGE - i * RISE,
  }));

  return (
    <View testID={testID} style={styles.root}>
      <RiseIn>
        <AppCard hero testID={testID ? `${testID}-start` : undefined}>
          <View style={styles.start}>
            <View style={styles.startEmblem}>
              <View
                style={[styles.glow, { backgroundColor: withAlpha(bronze.palette.primary, 0.16) }]}
              />
              <RankEmblem tierIndex={0} divisionIndex={0} size={64} />
            </View>
            <View style={styles.startText}>
              <Text style={styles.kicker}>YOUR STARTING RANK</Text>
              <Text style={[styles.startName, { color: bronze.palette.primary }]}>Bronze V</Text>
              <Text style={styles.startLine}>
                0 AP · Silver at {silver.floor.toLocaleString('en-US')} AP
              </Text>
            </View>
          </View>
        </AppCard>
      </RiseIn>

      <RiseIn>
        <AppCard>
          <View style={styles.climbHead}>
            <Text style={styles.cardTitle}>Nine ranks to climb</Text>
            <Text style={styles.caption}>For life</Text>
          </View>
          <View
            testID={testID ? `${testID}-ladder` : undefined}
            style={styles.climb}
            onLayout={onLayout}
            accessible
            accessibilityLabel={`The nine ranks, from where you start: ${TIERS.map(
              (tier) => `${tier.name}, from ${tier.floor.toLocaleString('en-US')} AP`,
            ).join('; ')}.`}
          >
            {width > 0 ? (
              <Svg width={width} height={CLIMB_HEIGHT} style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id="climb" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={bronze.palette.primary} />
                    <Stop offset="1" stopColor={legacy.palette.primary} />
                  </LinearGradient>
                </Defs>
                <Polyline
                  points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="url(#climb)"
                  strokeWidth={2}
                  strokeOpacity={0.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            ) : null}
            {width > 0
              ? TIERS.map((tier, i) => {
                  const size = i === last ? TOP_EMBLEM : EMBLEM;
                  return (
                    <View
                      key={tier.id}
                      testID={testID ? `${testID}-ladder-${tier.id}` : undefined}
                      style={[
                        styles.rung,
                        { left: points[i]!.x - size / 2, top: points[i]!.y - size / 2 },
                      ]}
                    >
                      <RankEmblem tierIndex={i} size={size} showDivision={false} />
                    </View>
                  );
                })
              : null}
          </View>
          <View style={styles.ends}>
            <View>
              <Text style={[styles.endName, { color: bronze.palette.primary }]}>{bronze.name}</Text>
              <Text style={styles.caption}>You start here</Text>
            </View>
            <View style={styles.endRight}>
              <Text style={[styles.endName, { color: legacy.palette.primary }]}>{legacy.name}</Text>
              <Text style={styles.caption}>{legacy.floor.toLocaleString('en-US')} AP</Text>
            </View>
          </View>
        </AppCard>
      </RiseIn>

      <RiseIn>
        <View style={styles.earnRow}>
          {EARN.map((item) => (
            <AppCard key={item.title} style={styles.earn}>
              <GlyphWell icon={item.icon} accentColor={accent} size={32} />
              <Text style={styles.earnTitle}>{item.title}</Text>
              <Text style={styles.earnLine}>{item.line}</Text>
            </AppCard>
          ))}
        </View>
      </RiseIn>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  start: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  startEmblem: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: radii.pill,
  },
  startText: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    ...typeScale.caption,
    letterSpacing: 1.5,
    color: colors.textSecondary,
  },
  startName: {
    ...typeScale.screenTitle,
  },
  startLine: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
  },
  climbHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  cardTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  caption: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  climb: {
    height: CLIMB_HEIGHT,
    marginTop: spacing.sm,
  },
  rung: {
    position: 'absolute',
  },
  ends: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  endRight: {
    alignItems: 'flex-end',
  },
  endName: {
    ...typeScale.label,
    fontFamily: fonts.display,
  },
  earnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  earn: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  earnTitle: {
    ...typeScale.label,
    fontFamily: fonts.display,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  earnLine: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
});
