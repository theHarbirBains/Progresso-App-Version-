import { Feather } from '@expo/vector-icons';
import { useState, type ComponentProps, type Ref } from 'react';
import { View, type LayoutChangeEvent, type ViewInstance } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { BackgroundPattern } from '../design/BackgroundPattern';
import { HolidayLights, SantaHat } from '../design/HolidayDecorations';
import { Text } from '../design/Text';
import { formatCardioTime } from '../cardio/cardioActivities';
import { formatWeightKg, fromKg, roundWeight } from '../lib/units';
import { withAlpha } from '../theme/accentColor';
import { formatSetValues } from '../workouts/setValues';
import { formatCardDuration } from '../workouts/workoutFormat';
import type { ShareCardData, ShareTopSet } from './shareCardData';
import {
  DENSITIES,
  DENSITY,
  STORY_PALETTE,
  shareCardStyles,
  storyStyles,
  wordsBottom,
  type StoryDensity,
} from './shareCardStyles';
import { STORY_CANVAS } from './storyLayout';

export { STORY_CANVAS, STORY_CAPTURE, STORY_CLEAR } from './storyLayout';

const GOLD = STORY_PALETTE.gold;

/** The card's words, at their own size whatever the phone's text size: the image never depends on the phone. */
function CardText(props: ComponentProps<typeof Text>) {
  return <Text allowFontScaling={false} {...props} />;
}

interface Props {
  data: ShareCardData;
  /** The user's own weight unit -- every weight on the card is shown in it. */
  weightUnit: 'kg' | 'lb';
  /** Through the holidays (Settings > Appearance > Holiday Decorations): lights, a hat, pines and a deer. */
  festive: boolean;
  storyRef?: Ref<ViewInstance>;
}

// The date with no year ("Thu, Nov 12") -- specific enough to be theirs, without pinning the
// post to an exact day of the year.
function formatCardDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** "115lb × 7" -- the reference's own compact wording; "12 reps", "1:30" otherwise. */
function topSetValue(set: ShareTopSet, unit: 'kg' | 'lb'): string {
  if (set.measurementType === 'weight_reps') {
    return `${formatWeightKg(set.weightKg ?? 0, unit)}${unit} × ${set.reps ?? 0}`;
  }
  return formatSetValues(set, unit);
}

function formatVolume(kg: number, unit: 'kg' | 'lb'): string {
  return `${Math.round(roundWeight(fromKg(kg, unit))).toLocaleString()} ${unit}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * How roomy a workout's card can start: by its rows, a long name counting for half another
 * (it may wrap). The card then measures itself and tightens until it fits (ShareStory).
 */
export function startingDensity(data: ShareCardData): StoryDensity {
  const longNames = data.topSets.filter((set) => set.displayName.length > 24).length;
  const rows = data.topSets.length + data.cardio.length * 1.3 + longNames * 0.5;
  return rows <= 6.5 ? 'roomy' : rows <= 10 ? 'snug' : 'tight';
}

/** A small dumbbell, the card's mark for a lift (Feather has none). */
function Dumbbell({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G
        transform="rotate(-35 12 12)"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      >
        <Path d="M2.5 10v4M5.5 7v10M18.5 7v10M21.5 10v4M5.5 12h13" />
      </G>
    </Svg>
  );
}

/** A pine, its foot at (x, foot), `h` tall: three tiers and a trunk. */
function pine(x: number, foot: number, h: number): string {
  const tier = (top: number, bottom: number, half: number) =>
    `M${x} ${foot - h * top}L${x + h * half} ${foot - h * bottom}L${x - h * half} ${foot - h * bottom}Z`;
  return [
    tier(1, 0.6, 0.2),
    tier(0.78, 0.32, 0.3),
    tier(0.52, 0.08, 0.4),
    `M${x - h * 0.05} ${foot - h * 0.1}h${h * 0.1}v${h * 0.1}h${-h * 0.1}Z`,
  ].join('');
}

/** A deer facing left, standing on (x, foot), `s` tall. */
function deer(x: number, foot: number, s: number) {
  const k = s / 30;
  return (
    <G transform={`translate(${x} ${foot - s}) scale(${k})`}>
      <Path
        d="M8 13C8 11 10 10 14 10.5C18 11 23 11 24 13.5C24.5 16 23 18 20 18.5L11 18.5C9 18.2 8 15.5 8 13Z"
        fill={withAlpha(GOLD, 0.55)}
      />
      <Path
        d="M10 13L7 6.5M7 6.5C6 6.2 4.6 6.4 4 7.2C4.4 7.9 5.6 8 6.7 7.6M24 13.4L26 12.2M10.5 18.5L10 30M12.5 18.6L13 30M20 18.6L20 30M22.2 18L23.2 30M6.7 6.4L5.4 2M5.9 4.1L3.6 2.8M7.2 6.2L9.2 2.2M8.3 4.2L10.6 3.4"
        stroke={withAlpha(GOLD, 0.55)}
        strokeWidth={1.3}
        strokeLinecap="round"
        fill="none"
      />
    </G>
  );
}

/**
 * The foot of the image: soft hills in the gold, darkening into the night -- and through the
 * holidays two pines on the left, one on the right and a deer on the far hill. Drawn to its own
 * height, so a tighter card keeps the same scene, shorter.
 */
function Landscape({ height: h, festive }: { height: number; festive: boolean }) {
  const w = STORY_CANVAS.width;
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Path
        d={`M0 ${h * 0.55}C90 ${h * 0.3} 170 ${h * 0.62} 260 ${h * 0.42}C300 ${h * 0.34} 335 ${h * 0.4} ${w} ${h * 0.36}L${w} ${h}L0 ${h}Z`}
        fill={withAlpha(GOLD, 0.08)}
      />
      {festive ? (
        <>
          <Path d={pine(22, h * 0.86, h * 0.72)} fill={withAlpha(GOLD, 0.42)} />
          <Path d={pine(54, h * 0.9, h * 0.5)} fill={withAlpha(GOLD, 0.32)} />
          <Path d={pine(338, h * 0.74, h * 0.58)} fill={withAlpha(GOLD, 0.38)} />
          {deer(282, h * 0.62, h * 0.3)}
        </>
      ) : null}
      <Path
        d={`M0 ${h * 0.8}C80 ${h * 0.6} 160 ${h * 0.86} 250 ${h * 0.7}C300 ${h * 0.62} 340 ${h * 0.7} ${w} ${h * 0.66}L${w} ${h}L0 ${h}Z`}
        fill={withAlpha(GOLD, 0.16)}
      />
      <Path
        d={`M0 ${h * 0.94}C100 ${h * 0.84} 210 ${h * 0.98} ${w} ${h * 0.86}L${w} ${h}L0 ${h}Z`}
        fill={withAlpha(GOLD, 0.24)}
      />
    </Svg>
  );
}

/**
 * The shareable workout image, after Harbir's reference: a 9:16 story (360x640pt, captured at
 * 1080x1920) on Holiday Gym's deep green, gold sparkles across it -- and through the holidays a
 * string of lights along the top, a Santa hat on the brand and pines and a deer on the hills at
 * its foot. Then the brand, WORKOUT COMPLETE, the workout's name and date; its four figures
 * (duration -- start to finish, its cardio in it once -- sets, volume in the user's unit and
 * records held); every exercise's top set in the order done -- its name, which wraps rather than
 * shrinking, "Top Set" under it and the figure in a gold pill in its own column; its cardio,
 * each activity with its figures; and one line on what it was. Everything is real logged data in
 * the user's unit; nothing is estimated, and no name, email or id is drawn.
 *
 * It fits any workout: it starts as roomy as the workout allows (startingDensity), measures its
 * words and tightens -- snug, then tight -- until they sit above the landscape; and when even
 * tight can't hold every exercise readably, the last rows give way to "+N more exercises", said
 * on the card, never dropped silently. The whole canvas is what gets captured.
 */
export function ShareStory({ data, weightUnit, festive, storyRef }: Props) {
  const [fit, setFit] = useState<{ density: StoryDensity; limit: number }>(() => ({
    density: startingDensity(data),
    limit: Infinity,
  }));
  const { density, limit } = fit;
  const s = storyStyles[density];
  const d = DENSITY[density];

  const cardioOnly = data.topSets.length === 0 && data.cardio.length > 0;
  const overflow = data.topSets.length > limit;
  const shown = overflow ? data.topSets.slice(0, Math.max(1, limit - 1)) : data.topSets;
  const hidden = data.topSets.length - shown.length;

  // Too tall for the image at this density: tighten, or at the tightest, give a row way.
  function measure(event: LayoutChangeEvent) {
    const bottom = d.top + event.nativeEvent.layout.height;
    if (bottom <= wordsBottom(density)) return;
    const next = DENSITIES[DENSITIES.indexOf(density) + 1];
    // The exercise rows there are now, "+N more" included: one fewer.
    const rows = overflow ? limit : data.topSets.length;
    if (next) setFit({ density: next, limit });
    else if (rows > 2) setFit({ density, limit: rows - 1 });
  }

  const duration = data.durationMinutes !== null ? formatCardDuration(data.durationMinutes) : '—';
  const stats = cardioOnly
    ? [
        { key: 'duration', icon: 'clock' as const, value: duration, label: 'Duration' },
        {
          key: 'activities',
          icon: 'activity' as const,
          value: String(data.cardio.length),
          label: data.cardio.length === 1 ? 'Activity' : 'Activities',
        },
        {
          key: 'cardio-time',
          icon: 'trending-up' as const,
          value: formatCardioTime(data.cardioSeconds),
          label: 'Cardio',
        },
      ]
    : [
        { key: 'duration', icon: 'clock' as const, value: duration, label: 'Duration' },
        { key: 'sets', icon: 'layers' as const, value: String(data.totalSets), label: 'Sets' },
        {
          key: 'volume',
          icon: null,
          value: formatVolume(data.totalVolumeKg, weightUnit),
          label: 'Volume',
        },
        {
          key: 'records',
          icon: 'award' as const,
          value: String(data.recordCount),
          label: data.recordCount === 1 ? 'Record' : 'Records',
        },
      ];

  const summaryParts = [
    data.exerciseCount > 0 ? plural(data.exerciseCount, 'Exercise', 'Exercises') : null,
    data.cardio.length > 0
      ? `${formatCardioTime(data.cardioSeconds)} Cardio`
      : data.exerciseCount > 0
        ? 'Strength Training'
        : null,
  ].filter((part): part is string => part !== null);
  // A picture to VoiceOver: what's on it, in one label.
  const accessibilityLabel = [
    `${data.title}, ${formatCardDate(data.performedAt)}`,
    ...stats.map((stat) => `${stat.label} ${stat.value}`),
    ...data.topSets.map((set) => `${set.displayName}: ${topSetValue(set, weightUnit)}`),
    ...data.cardio.map((entry) => `${entry.name}: ${entry.figures}`),
  ].join('. ');

  return (
    <View
      ref={storyRef}
      collapsable={false}
      testID="share-story"
      style={shareCardStyles.story}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <BackgroundPattern
        pattern="sparkles"
        color={GOLD}
        background={STORY_PALETTE.background}
        fade={false}
        testID="share-story-stars"
      />
      {festive ? (
        <HolidayLights testID="share-story-lights" width={STORY_CANVAS.width} style={{ top: 0 }} />
      ) : null}
      <View testID="share-story-landscape" style={s.landscape} pointerEvents="none">
        <Landscape height={d.landscape} festive={festive} />
      </View>

      <View testID="share-card" style={s.words} onLayout={measure}>
        <View testID="share-card-header" style={s.header}>
          <View style={s.brandWrap}>
            <CardText testID="share-card-brand" style={s.brand}>
              Progresso
            </CardText>
            {festive ? (
              <SantaHat testID="share-card-hat" size={d.brand * 0.8} style={s.hat} />
            ) : null}
          </View>
          <View style={s.kickerRow}>
            <View style={s.kickerRule} />
            <CardText style={s.kicker}>WORKOUT COMPLETE</CardText>
            <View style={s.kickerRule} />
          </View>
          <CardText
            testID="share-card-workout-name"
            style={s.title}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {data.title}
          </CardText>
          <CardText testID="share-card-date" style={s.date}>
            {formatCardDate(data.performedAt)}
          </CardText>
        </View>

        <View testID="share-card-stats" style={[s.panel, s.stats]}>
          {stats.map((stat, index) => (
            <View key={stat.key} style={[s.stat, index > 0 && s.statDivided]}>
              {stat.icon ? (
                <Feather name={stat.icon} size={d.statValue} color={GOLD} />
              ) : (
                <Dumbbell size={d.statValue + 2} color={GOLD} />
              )}
              <CardText
                testID={`share-card-${stat.key}`}
                style={s.statValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {stat.value}
              </CardText>
              <CardText style={s.statLabel} numberOfLines={1}>
                {stat.label}
              </CardText>
            </View>
          ))}
        </View>

        {shown.length > 0 ? (
          <View testID="share-card-top-sets" style={[s.panel, s.rows]}>
            {density === 'tight' ? <CardText style={s.sectionLabel}>TOP SETS</CardText> : null}
            {shown.map((set, index) => (
              <View
                key={`${set.exerciseName}-${index}`}
                testID={`share-card-top-set-row-${index}`}
                style={[s.row, index > 0 && s.rowDivided]}
              >
                <View style={s.iconRound}>
                  <Dumbbell size={d.icon * 0.55} color={GOLD} />
                </View>
                <View style={s.rowText}>
                  <CardText
                    testID={`share-card-top-set-name-${index}`}
                    style={s.name}
                    numberOfLines={3}
                  >
                    {set.displayName}
                  </CardText>
                  {density === 'tight' ? null : <CardText style={s.label}>{set.label}</CardText>}
                </View>
                <View testID={`share-card-top-set-pill-${index}`} style={s.pill}>
                  <CardText
                    testID={`share-card-top-set-${index}`}
                    style={s.value}
                    numberOfLines={1}
                  >
                    {topSetValue(set, weightUnit)}
                  </CardText>
                </View>
              </View>
            ))}
            {hidden > 0 ? (
              <CardText testID="share-card-top-sets-more" style={[s.more, s.rowDivided]}>
                {`+${hidden} more ${hidden === 1 ? 'exercise' : 'exercises'}`}
              </CardText>
            ) : null}
          </View>
        ) : null}

        {data.cardio.length > 0 ? (
          <View testID="share-card-cardio" style={[s.panel, s.rows]}>
            {data.cardio.map((entry, index) => (
              <View
                key={`${entry.name}-${index}`}
                testID={`share-card-cardio-row-${index}`}
                style={[s.row, index > 0 && s.rowDivided]}
              >
                <View style={s.iconSquare}>
                  <Feather name={entry.icon} size={d.cardioIcon * 0.48} color={GOLD} />
                </View>
                <View style={s.iconDivider} />
                <View style={s.rowText}>
                  <CardText style={s.name} numberOfLines={2}>
                    {entry.name}
                  </CardText>
                  <CardText
                    testID={`share-card-cardio-${index}`}
                    style={s.figures}
                    numberOfLines={2}
                  >
                    {entry.figures}
                  </CardText>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {summaryParts.length > 0 ? (
          <CardText testID="share-card-summary" style={s.summary}>
            {summaryParts.map((part, index) => (
              <CardText key={part}>
                {index > 0 ? <CardText style={s.summaryBar}>{'   |   '}</CardText> : null}
                {part}
              </CardText>
            ))}
          </CardText>
        ) : null}
      </View>
    </View>
  );
}
