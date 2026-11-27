import { Feather } from '@expo/vector-icons';
import { useState, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppCard } from '../../design/AppCard';
import { SecondaryButton } from '../../design/Button';
import { SegmentedControl } from '../../design/SegmentedControl';
import { Text } from '../../design/Text';
import { colors, fonts, radii, spacing, typeScale, widgetGap } from '../../design/theme';
import { withAlpha } from '../../theme/accentColor';
import { Columns, Ring } from '../preview/healthCharts';
import { SampleNote } from '../preview/healthParts';
import {
  METRIC_INFO,
  PERIOD_CAPTION,
  sampleFigures,
  STEADINESS_LEVELS,
  STEADINESS_UPDATED,
  steadinessLevel,
  type Change,
  type HealthPeriod,
  type IPhonePreviewState,
  type MetricKey,
  type PeriodFigures,
} from './iphoneHealthSample';

// iPhone-only Health -- a UI PROTOTYPE (Harbir's brief, 2026-11-27): what an iPhone measures by
// itself, with no watch or ring, at a glance. Activity (steps, walking and running distance,
// flights climbed) and Mobility (walking speed, steadiness, asymmetry, double support time), each
// in its own widget with a large figure, a compact chart and how it compares -- for today, the
// last 7 days or the last 30. Sample data only; nothing is read. No sleep and no heart: an
// iPhone alone can't measure them reliably. A figure that isn't there says why, never 0.

type FeatherName = ComponentProps<typeof Feather>['name'];

const PERIODS: { label: string; value: HealthPeriod }[] = [
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
];

const PREVIEW_STATES: { label: string; value: IPhonePreviewState }[] = [
  { label: 'All data', value: 'all' },
  { label: 'Some missing', value: 'someMissing' },
  { label: 'Nothing yet', value: 'nothing' },
];

/** Steps against their usual -- the ring's fill and its words, per period. */
const STEPS_AGAINST: Record<HealthPeriod, { ratio: number; label: string }> = {
  day: { ratio: 8412 / 7772, label: 'of your usual' },
  week: { ratio: 1.04, label: 'of the week before' },
  month: { ratio: 0.98, label: 'of the month before' },
};

function formatValue(metric: MetricKey, value: number): string {
  const { digits } = METRIC_INFO[metric];
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** How it compares: an arrow and a few words, never coloured as good or bad. */
function ChangeLine({ change, testID }: { change: Change; testID?: string }) {
  const icon: FeatherName =
    change.direction === 'up'
      ? 'arrow-up-right'
      : change.direction === 'down'
        ? 'arrow-down-right'
        : 'minus';
  return (
    <View testID={testID} style={styles.change}>
      <Feather name={icon} size={12} color={colors.textSecondary} />
      <Text style={styles.changeText} numberOfLines={1}>
        {change.text}
      </Text>
    </View>
  );
}

/** A chart's start, middle and end, under it. */
function Axis({ labels }: { labels: [string, string, string] }) {
  return (
    <View style={styles.axis}>
      {labels.map((label, i) => (
        <Text
          key={i}
          style={[styles.axisLabel, i === 1 && styles.axisMiddle, i === 2 && styles.axisEnd]}
          numberOfLines={1}
        >
          {label}
        </Text>
      ))}
    </View>
  );
}

function WidgetHead({ metric, accent }: { metric: MetricKey; accent: string }) {
  const info = METRIC_INFO[metric];
  return (
    <View style={styles.head}>
      <View style={[styles.headIcon, { backgroundColor: withAlpha(accent, 0.14) }]}>
        <Feather name={info.icon} size={13} color={accent} />
      </View>
      <Text style={styles.headName} numberOfLines={1}>
        {info.name}
      </Text>
    </View>
  );
}

/** Where a figure isn't: a dash and why -- never a 0. */
function NotMeasured({ reason, testID }: { reason: string; testID?: string }) {
  return (
    <View testID={testID} style={styles.notMeasured}>
      <Text style={styles.dash}>—</Text>
      <View style={styles.notMeasuredLine}>
        <Feather name="clock" size={12} color={colors.textMuted} />
        <Text style={styles.notMeasuredText} numberOfLines={3}>
          {reason}
        </Text>
      </View>
    </View>
  );
}

// --- Activity ---------------------------------------------------------------------------------

/** Steps: the one hero -- the figure, a ring against their usual, and the period's columns. */
function StepsHero({
  period,
  state,
  accent,
}: {
  period: HealthPeriod;
  state: IPhonePreviewState;
  accent: string;
}) {
  const figures = sampleFigures('steps', period, state);
  const against = STEPS_AGAINST[period];
  const percent = Math.round(against.ratio * 100);
  return (
    <AppCard hero testID="iphone-health-steps">
      <View style={styles.heroBody}>
        <View style={styles.heroTop}>
          <View style={styles.flex}>
            <WidgetHead metric="steps" accent={accent} />
            {figures.value === null ? (
              <NotMeasured reason={figures.missing ?? 'Not measured yet'} />
            ) : (
              <>
                <Text
                  testID="iphone-health-steps-value"
                  style={styles.heroValue}
                  accessibilityLabel={`${formatValue('steps', figures.value)} steps${period === 'day' ? ' today' : ' a day'}`}
                >
                  {formatValue('steps', figures.value)}
                </Text>
                <Text style={styles.unit}>
                  {period === 'day' ? 'steps today' : 'steps a day'}
                  {figures.total !== undefined
                    ? ` · ${figures.total.toLocaleString('en-US')} in all`
                    : ''}
                </Text>
              </>
            )}
          </View>
          {figures.value !== null ? (
            <Ring
              testID="iphone-health-steps-ring"
              size={84}
              stroke={8}
              progress={Math.min(1, against.ratio)}
              color={accent}
            >
              <Text style={styles.ringValue}>{percent}%</Text>
            </Ring>
          ) : null}
        </View>
        {figures.value !== null ? (
          <>
            <Text style={styles.ringCaption}>
              {percent}% {against.label}
            </Text>
            <Columns
              testID="iphone-health-steps-chart"
              values={figures.chart}
              highlight={figures.chart.length - 1}
              height={64}
              color={accent}
              gap={period === 'month' ? 2 : period === 'day' ? 3 : 8}
            />
            <Axis labels={figures.axis} />
            {figures.change ? (
              <ChangeLine change={figures.change} testID="iphone-health-steps-change" />
            ) : null}
          </>
        ) : null}
      </View>
    </AppCard>
  );
}

/** Distance and flights: half a row each -- the figure, mini columns and the comparison. */
function ActivityTile({
  metric,
  period,
  state,
  accent,
}: {
  metric: 'distance' | 'flights';
  period: HealthPeriod;
  state: IPhonePreviewState;
  accent: string;
}) {
  const info = METRIC_INFO[metric];
  const figures = sampleFigures(metric, period, state);
  return (
    <AppCard testID={`iphone-health-${metric}`} style={styles.half}>
      <View style={styles.tileBody}>
        <WidgetHead metric={metric} accent={accent} />
        {figures.value === null ? (
          <NotMeasured reason={figures.missing ?? 'Not measured yet'} />
        ) : (
          <>
            <Text testID={`iphone-health-${metric}-value`} style={styles.tileValue}>
              {formatValue(metric, figures.value)}
              <Text style={styles.tileUnit}> {info.unit}</Text>
            </Text>
            <Columns
              values={figures.chart}
              highlight={figures.chart.length - 1}
              height={30}
              color={accent}
              gap={period === 'week' ? 4 : 1}
            />
            {figures.change ? <ChangeLine change={figures.change} /> : null}
          </>
        )}
      </View>
    </AppCard>
  );
}

// --- Mobility ---------------------------------------------------------------------------------

/** Today against their own usual range: a track, the range in a soft accent, the day as a dot. */
function UsualRange({
  value,
  usual,
  accent,
  digits,
  unit,
}: {
  value: number;
  usual: [number, number];
  accent: string;
  digits: number;
  unit: string;
}) {
  // A scale with room either side of their usual.
  const spread = usual[1] - usual[0];
  const low = usual[0] - spread;
  const high = usual[1] + spread;
  const at = (v: number) => `${Math.max(0, Math.min(100, ((v - low) / (high - low)) * 100))}%`;
  const fixed = (v: number) => v.toFixed(digits);
  return (
    <View
      style={styles.range}
      accessible
      accessibilityLabel={`Your usual is ${fixed(usual[0])} to ${fixed(usual[1])}${unit ? ` ${unit}` : ''}`}
    >
      <View style={styles.rangeTrack}>
        <View
          style={[
            styles.rangeUsual,
            {
              left: at(usual[0]) as `${number}%`,
              width: `${((usual[1] - usual[0]) / (high - low)) * 100}%`,
              backgroundColor: withAlpha(accent, 0.28),
            },
          ]}
        />
        <View
          style={[styles.rangeDot, { left: at(value) as `${number}%`, backgroundColor: accent }]}
        />
      </View>
      <Text style={styles.rangeCaption} numberOfLines={1}>
        Your usual {fixed(usual[0])}–{fixed(usual[1])}
        {unit === '%' ? '%' : unit ? ` ${unit}` : ''}
      </Text>
    </View>
  );
}

/** Walking speed, asymmetry, double support: the figure, then today's place in their usual, or the period's columns. */
function MobilityTile({
  metric,
  period,
  state,
  accent,
}: {
  metric: 'walkingSpeed' | 'asymmetry' | 'doubleSupport';
  period: HealthPeriod;
  state: IPhonePreviewState;
  accent: string;
}) {
  const info = METRIC_INFO[metric];
  const figures = sampleFigures(metric, period, state);
  return (
    <AppCard testID={`iphone-health-${metric}`} style={styles.half}>
      <View style={styles.tileBody}>
        <WidgetHead metric={metric} accent={accent} />
        <Text style={styles.what} numberOfLines={1}>
          {info.what}
        </Text>
        {figures.value === null ? (
          <NotMeasured
            reason={figures.missing ?? 'Not measured yet'}
            testID={`iphone-health-${metric}-missing`}
          />
        ) : (
          <>
            <Text testID={`iphone-health-${metric}-value`} style={styles.tileValue}>
              {formatValue(metric, figures.value)}
              <Text style={styles.tileUnit}>{info.unit === '%' ? '%' : ` ${info.unit}`}</Text>
            </Text>
            {period === 'day' && figures.usual ? (
              <UsualRange
                value={figures.value}
                usual={figures.usual}
                accent={accent}
                digits={info.digits}
                unit={info.unit}
              />
            ) : (
              <Columns
                values={figures.chart}
                highlight={figures.chart.length - 1}
                band={figures.usual}
                height={30}
                color={accent}
                gap={4}
              />
            )}
            {figures.change ? <ChangeLine change={figures.change} /> : null}
          </>
        )}
      </View>
    </AppCard>
  );
}

/** Walking steadiness: Apple's own level, and where it sits on its three. */
function SteadinessTile({
  period,
  state,
  accent,
}: {
  period: HealthPeriod;
  state: IPhonePreviewState;
  accent: string;
}) {
  const info = METRIC_INFO.steadiness;
  const figures = sampleFigures('steadiness', period, state);
  const level = figures.value === null ? null : steadinessLevel(figures.value);
  return (
    <AppCard testID="iphone-health-steadiness" style={styles.half}>
      <View style={styles.tileBody}>
        <WidgetHead metric="steadiness" accent={accent} />
        <Text style={styles.what} numberOfLines={1}>
          {info.what}
        </Text>
        {figures.value === null || level === null ? (
          <NotMeasured
            reason={figures.missing ?? 'Not measured yet'}
            testID="iphone-health-steadiness-missing"
          />
        ) : (
          <>
            <Text testID="iphone-health-steadiness-value" style={styles.tileValue}>
              {level}
            </Text>
            <View
              style={styles.levels}
              accessible
              accessibilityLabel={`Walking steadiness ${level}, of Very Low, Low and OK`}
            >
              {STEADINESS_LEVELS.map((name, i) => (
                <View key={name} style={styles.level}>
                  <View
                    style={[
                      styles.levelBar,
                      {
                        backgroundColor:
                          name === level ? accent : withAlpha(accent, 0.18 + i * 0.06),
                      },
                    ]}
                  />
                  <Text
                    style={[styles.levelName, name === level && styles.levelNameOn]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.change}>
              <Feather name="calendar" size={12} color={colors.textSecondary} />
              <Text style={styles.changeText} numberOfLines={1}>
                {STEADINESS_UPDATED}
              </Text>
            </View>
          </>
        )}
      </View>
    </AppCard>
  );
}

// --- The page ---------------------------------------------------------------------------------

function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
    </View>
  );
}

/** Nothing yet: one card saying what an iPhone already counts -- not a page of empty widgets. */
function NothingYet({ accent, onConnect }: { accent: string; onConnect: () => void }) {
  return (
    <AppCard hero testID="iphone-health-nothing">
      <View style={styles.nothing}>
        <View style={[styles.nothingIcon, { backgroundColor: withAlpha(accent, 0.14) }]}>
          <Feather name="smartphone" size={22} color={accent} />
        </View>
        <Text style={styles.nothingTitle}>Your iPhone already counts your steps</Text>
        <Text style={styles.nothingBody}>
          Connect Apple Health to see your activity and how you walk, with no watch needed.
        </Text>
        <SecondaryButton
          testID="iphone-health-connect"
          label="Connect Apple Health"
          icon="heart"
          size="md"
          onPress={onConnect}
        />
      </View>
    </AppCard>
  );
}

export function IPhoneHealth({ accent }: { accent: string }) {
  const [period, setPeriod] = useState<HealthPeriod>('day');
  const [state, setState] = useState<IPhonePreviewState>('all');

  return (
    <View testID="iphone-health" style={styles.page}>
      {/* The prototype's own control: what it pretends Apple Health has. */}
      <View style={styles.preview}>
        <SampleNote testID="iphone-health-sample-note" />
        <SegmentedControl
          testID="iphone-health-preview"
          options={PREVIEW_STATES}
          value={state}
          onChange={setState}
          accentColor={accent}
          stretch
        />
      </View>

      {state === 'nothing' ? (
        // In the prototype, connecting shows what's there once it's connected.
        <NothingYet accent={accent} onConnect={() => setState('all')} />
      ) : (
        <>
          <View style={styles.periods}>
            <SegmentedControl
              testID="iphone-health-period"
              options={PERIODS}
              value={period}
              onChange={setPeriod}
              accentColor={accent}
              stretch
            />
            <Text testID="iphone-health-period-caption" style={styles.periodCaption}>
              {PERIOD_CAPTION[period]}
            </Text>
          </View>

          <SectionTitle title="Activity" />
          <StepsHero period={period} state={state} accent={accent} />
          <View style={styles.row}>
            <ActivityTile metric="distance" period={period} state={state} accent={accent} />
            <ActivityTile metric="flights" period={period} state={state} accent={accent} />
          </View>

          <SectionTitle title="Mobility" note="From how you walk with your iPhone in a pocket" />
          <View style={styles.row}>
            <MobilityTile metric="walkingSpeed" period={period} state={state} accent={accent} />
            <SteadinessTile period={period} state={state} accent={accent} />
          </View>
          <View style={styles.row}>
            <MobilityTile metric="asymmetry" period={period} state={state} accent={accent} />
            <MobilityTile metric="doubleSupport" period={period} state={state} accent={accent} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.md,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  preview: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  periods: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  periodCaption: {
    ...typeScale.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  section: {
    gap: 2,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  sectionTitle: {
    ...typeScale.sectionHeading,
    color: colors.textSecondary,
  },
  sectionNote: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    gap: widgetGap,
  },
  half: {
    flex: 1,
    minWidth: 0,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headIcon: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headName: {
    ...typeScale.label,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  what: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: -spacing.xs,
  },
  heroBody: {
    gap: spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroValue: {
    fontFamily: fonts.monoBold,
    fontSize: 44,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  unit: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  ringValue: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
  },
  ringCaption: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: -spacing.sm,
  },
  tileBody: {
    gap: spacing.sm,
  },
  tileValue: {
    ...typeScale.statLarge,
    fontSize: 28,
    color: colors.textPrimary,
  },
  tileUnit: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  change: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeText: {
    ...typeScale.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  axis: {
    flexDirection: 'row',
    marginTop: -spacing.xs,
  },
  axisLabel: {
    ...typeScale.caption,
    color: colors.textMuted,
    flex: 1,
  },
  axisMiddle: {
    textAlign: 'center',
  },
  axisEnd: {
    textAlign: 'right',
  },
  range: {
    gap: spacing.xs,
  },
  rangeTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
  },
  rangeUsual: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: radii.pill,
  },
  rangeDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    marginLeft: -6,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.background,
  },
  rangeCaption: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  levels: {
    flexDirection: 'row',
    gap: 3,
  },
  level: {
    flex: 1,
    gap: 4,
  },
  levelBar: {
    height: 8,
    borderRadius: radii.pill,
  },
  levelName: {
    ...typeScale.caption,
    fontSize: 10,
    color: colors.textMuted,
  },
  levelNameOn: {
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
  },
  notMeasured: {
    gap: spacing.xs,
  },
  dash: {
    ...typeScale.statLarge,
    fontSize: 28,
    color: colors.textMuted,
  },
  notMeasuredLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  notMeasuredText: {
    ...typeScale.caption,
    color: colors.textMuted,
    flexShrink: 1,
  },
  nothing: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  nothingIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  nothingTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  nothingBody: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
