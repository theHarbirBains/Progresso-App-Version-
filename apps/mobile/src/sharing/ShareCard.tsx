import type { Ref } from 'react';
import { View, type ViewInstance } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Avatar } from '../design/Avatar';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import { fromKg, roundWeight } from '../lib/units';
import { withAlpha } from '../theme/accentColor';
import { formatCardioTime, formatKm } from '../cardio/cardioActivities';
import { formatSetValues } from '../workouts/setValues';
import type { ShareCardData, ShareCardio, ShareTopSet } from './shareCardData';
import { shareCardBodyStyles as card, shareCardStyles as styles } from './shareCardStyles';
import { CARD_WIDTH, STORY_CANVAS, STORY_SAFE_AREA, cardPt } from './storyLayout';
import { useAppTheme } from '../theme/appThemeContext';

export {
  CARD_MAX_HEIGHT,
  CARD_SCALE,
  CARD_WIDTH,
  STORY_CANVAS,
  STORY_CAPTURE,
  STORY_SAFE_AREA,
} from './storyLayout';

// The top-sets list fills the room left under the stats (design units): rows
// shrink a little for a longer workout, so up to MAX_ROWS exercises each get
// their own row. A long workout (COMPACT_FROM exercises or more) gets the compact
// card -- a shorter header and slimmer rows without pictures -- so up to
// COMPACT_MAX_ROWS still each get their own; past that, the last row says how
// many more there are.
const TOP_SETS_SPACE = 270;
const ROW_GAP = 5;
const MAX_ROW_HEIGHT = 46;
const MAX_ROWS = 7;
const COMPACT_FROM = 8;
const COMPACT_MAX_ROWS = 12;
const HERO_HEIGHT = 171;
const COMPACT_HERO_HEIGHT = 120;
const COMPACT_ROW_GAP = 3;
// With both top sets and cardio, the second section's label takes this much of the room.
const SECOND_SECTION_SPACE = 22;
// At most this many cardio rows (past it, the last says how many more); the top sets get the rest.
const MAX_CARDIO_ROWS = 3;

const STAT_ICON_SIZE = cardPt(18);
// The logo the app opens with (LaunchScreen's mark), cropped tight to the
// mark, in place of a written brand name.
const LOGO = require('../../assets/progresso-mark-share.png');
const LOGO_ASPECT = 360 / 289;
const LOGO_HEIGHT = cardPt(26);
const LOGO_STYLE = { width: LOGO_HEIGHT * LOGO_ASPECT, height: LOGO_HEIGHT } as const;

interface Props {
  data: ShareCardData;
  /** The user's own weight unit -- every weight on the card is shown in it. */
  weightUnit: 'kg' | 'lb';
  /** The accent -- used only for personal records. */
  accentColor: string;
}

// The date with no year ("Mon, Sep 20") -- specific enough to be theirs,
// without pinning the post to an exact day of the year.
function formatCardDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatVolume(kg: number, unit: 'kg' | 'lb'): string {
  return Math.round(roundWeight(fromKg(kg, unit))).toLocaleString();
}

function setValue(set: ShareTopSet, unit: 'kg' | 'lb'): string {
  return formatSetValues(set, unit);
}

function Stat({
  icon,
  value,
  label,
  first,
  testID,
}: {
  icon: 'clock' | 'list' | 'layers' | 'bar-chart-2' | 'activity' | 'map-pin';
  value: string;
  label: string;
  first?: boolean;
  testID: string;
}) {
  return (
    <View style={[card.stat, !first && card.statDivided]}>
      <Feather name={icon} size={STAT_ICON_SIZE} color={colors.textSecondary} />
      <Text testID={testID} style={card.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={card.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// An exercise's machine photo, or its initial -- static, since the card is a picture.
function Thumb({ set, size }: { set: ShareTopSet; size: number }) {
  return (
    <View style={[card.thumb, { width: size, height: size, borderRadius: size / 2 }]}>
      <Avatar
        uri={set.photoUrl}
        initial={set.exerciseName.trim().charAt(0).toUpperCase() || null}
        size={size}
        iconSize={Math.round(size * 0.5)}
        iconColor={colors.textSecondary}
        initialStyle={[card.thumbInitial, { fontSize: size * 0.4 }]}
      />
    </View>
  );
}

// A cardio activity's glyph in a round well of the accent -- the app's own mark for it.
function CardioThumb({
  entry,
  size,
  accentColor,
}: {
  entry: ShareCardio;
  size: number;
  accentColor: string;
}) {
  return (
    <View
      style={[
        card.thumb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: withAlpha(accentColor, 0.14),
        },
      ]}
    >
      <Feather name={entry.icon} size={Math.round(size * 0.5)} color={accentColor} />
    </View>
  );
}

// The shareable workout image: the card on a 9:16 story canvas of the app
// theme's own plain background colour -- no photo, no gradient -- so it looks
// like the app it came from. This whole canvas is what gets captured -- the
// preview IS the image.
export function ShareStory({ storyRef, ...cardProps }: Props & { storyRef?: Ref<ViewInstance> }) {
  const { theme } = useAppTheme();
  return (
    <View
      ref={storyRef}
      collapsable={false}
      testID="share-story"
      style={[styles.story, STORY_CANVAS, { backgroundColor: theme.background }]}
    >
      <View testID="share-story-safe-area" style={[styles.safeArea, STORY_SAFE_AREA_STYLE]}>
        <ShareCard {...cardProps} />
      </View>
    </View>
  );
}

const STORY_SAFE_AREA_STYLE = {
  top: STORY_SAFE_AREA.top,
  bottom: STORY_SAFE_AREA.bottom,
} as const;

// The card, plain: the brand mark, date and the workout's own name (nothing under it -- the name is the user's); then the session as
// four stats (duration -- or, with cardio, the active training -- exercises, sets, volume; cardio
// alone: its time, activities and distance), every exercise's top set in workout order, a personal
// record marked quietly in the accent, and its cardio, each activity its glyph, name and figures.
// Everything is real logged data in the user's unit (cardio in km, for everyone); nothing is
// estimated, and no account detail (name, email, id) is ever drawn.
// Nothing on it looks tappable (no chevrons, no "View All") -- it's a picture.
export function ShareCard({ data, weightUnit, accentColor }: Props) {
  const cardio = data.cardio ?? [];
  const cardioOverflow = cardio.length > MAX_CARDIO_ROWS;
  const shownCardio = cardioOverflow ? cardio.slice(0, MAX_CARDIO_ROWS - 1) : cardio;
  const cardioRowCount = shownCardio.length + (cardioOverflow ? 1 : 0);
  const compact = data.topSets.length + cardioRowCount >= COMPACT_FROM;
  const maxRows = (compact ? COMPACT_MAX_ROWS : MAX_ROWS) - cardioRowCount;
  const overflow = data.topSets.length > maxRows;
  const shown = overflow ? data.topSets.slice(0, maxRows - 1) : data.topSets;
  const hiddenCount = data.topSets.length - shown.length;
  const rowCount = shown.length + (overflow ? 1 : 0) + cardioRowCount;
  const bothSections = shown.length > 0 && cardioRowCount > 0;
  const cardioOnly = data.topSets.length === 0 && cardio.length > 0;
  // The compact card's shorter header gives its room to the list; a second section's label takes some.
  const space =
    TOP_SETS_SPACE +
    (compact ? HERO_HEIGHT - COMPACT_HERO_HEIGHT : 0) -
    (bothSections ? SECOND_SECTION_SPACE : 0);
  const gap = compact ? COMPACT_ROW_GAP : ROW_GAP;
  const rowHeight = Math.min(
    MAX_ROW_HEIGHT,
    (space - (rowCount - 1) * gap) / Math.max(rowCount, 1),
  );
  const thumbSize = cardPt(Math.min(32, rowHeight - 14));

  return (
    <View testID="share-card" style={[card.card, { width: cardPt(CARD_WIDTH) }]}>
      <View
        testID="share-card-hero"
        style={[card.hero, compact && { height: cardPt(COMPACT_HERO_HEIGHT) }]}
      >
        <View style={card.heroTop}>
          <Image
            testID="share-card-logo"
            source={LOGO}
            style={LOGO_STYLE}
            contentFit="contain"
            accessibilityLabel="Progresso"
          />
          <Text testID="share-card-date" style={card.date}>
            {formatCardDate(data.performedAt)}
          </Text>
        </View>
        <View>
          <Text
            testID="share-card-workout-name"
            style={card.workoutName}
            numberOfLines={compact ? 1 : 2}
            adjustsFontSizeToFit
            minimumFontScale={compact ? 0.6 : 0.7}
          >
            {data.workoutName}
          </Text>
        </View>
      </View>

      {cardioOnly ? (
        // Cardio alone has no exercises, sets or volume: its time, activities and distance.
        <View testID="share-card-stats" style={card.stats}>
          <Stat
            first
            icon="clock"
            value={formatCardioTime(data.cardioSeconds)}
            label="Time"
            testID="share-card-cardio-time"
          />
          <Stat
            icon="activity"
            value={String(cardio.length)}
            label={cardio.length === 1 ? 'Activity' : 'Activities'}
            testID="share-card-activities"
          />
          {data.cardioDistanceM !== null ? (
            <Stat
              icon="map-pin"
              value={formatKm(data.cardioDistanceM)}
              label="Distance"
              testID="share-card-distance"
            />
          ) : null}
        </View>
      ) : (
        <View testID="share-card-stats" style={card.stats}>
          {/* With cardio, the active training -- strength and cardio -- never the session's rests;
              logged with no duration (Log Past Workout's is optional), none shown. */}
          {data.activeMinutes != null ? (
            <Stat
              first
              icon="clock"
              value={`${data.activeMinutes} min`}
              label="Active"
              testID="share-card-active"
            />
          ) : data.durationMinutes !== null ? (
            <Stat
              first
              icon="clock"
              value={`${data.durationMinutes} min`}
              label="Duration"
              testID="share-card-duration"
            />
          ) : null}
          <Stat
            first={data.activeMinutes == null && data.durationMinutes === null}
            icon="list"
            value={String(data.exerciseCount)}
            label="Exercises"
            testID="share-card-exercises"
          />
          <Stat
            icon="layers"
            value={String(data.totalSets)}
            label="Sets"
            testID="share-card-sets"
          />
          <Stat
            icon="bar-chart-2"
            value={formatVolume(data.totalVolumeKg, weightUnit)}
            label={`Volume (${weightUnit})`}
            testID="share-card-volume"
          />
        </View>
      )}

      {shown.length > 0 ? (
        <View testID="share-card-top-sets" style={card.body}>
          <Text style={card.sectionLabel}>TOP SETS</Text>
          <View style={[card.rows, compact && { gap: cardPt(COMPACT_ROW_GAP) }]}>
            {shown.map((set, index) => {
              const isRecord = set.prLabel !== null;
              return (
                <View
                  key={`${set.exerciseName}-${index}`}
                  testID={`share-card-top-set-row-${index}`}
                  style={[card.row, compact && card.rowCompact, { height: cardPt(rowHeight) }]}
                >
                  {compact ? null : <Thumb set={set} size={thumbSize} />}
                  <Text style={[card.liftName, compact && card.liftNameCompact]} numberOfLines={1}>
                    {set.exerciseName}
                  </Text>
                  {/* A personal record: the same row, its value in the accent
                      with a small tag -- quiet, never a separate block. */}
                  {isRecord ? (
                    <View
                      testID={`share-card-top-set-${index}-pr`}
                      style={[card.prTag, { backgroundColor: withAlpha(accentColor, 0.14) }]}
                    >
                      <Text style={[card.prTagText, { color: accentColor }]}>
                        {set.prLabel === '1RM' ? '1RM' : 'PR'}
                      </Text>
                    </View>
                  ) : null}
                  <Text
                    testID={`share-card-top-set-${index}`}
                    style={[
                      card.liftValue,
                      compact && card.liftValueCompact,
                      isRecord && { color: accentColor },
                    ]}
                    numberOfLines={1}
                  >
                    {setValue(set, weightUnit)}
                  </Text>
                </View>
              );
            })}
            {overflow ? (
              <View style={[card.moreRow, { height: cardPt(rowHeight) }]}>
                <Text
                  testID="share-card-top-sets-more"
                  style={[card.more, compact && card.liftNameCompact]}
                >
                  {`+${hiddenCount} more`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {shownCardio.length > 0 ? (
        <View testID="share-card-cardio" style={[card.body, bothSections && card.bodyFollowing]}>
          <Text style={card.sectionLabel}>CARDIO</Text>
          <View style={[card.rows, compact && { gap: cardPt(COMPACT_ROW_GAP) }]}>
            {shownCardio.map((entry, index) => (
              <View
                key={`${entry.name}-${index}`}
                testID={`share-card-cardio-row-${index}`}
                style={[card.row, compact && card.rowCompact, { height: cardPt(rowHeight) }]}
              >
                {compact ? null : (
                  <CardioThumb entry={entry} size={thumbSize} accentColor={accentColor} />
                )}
                <Text style={[card.liftName, compact && card.liftNameCompact]} numberOfLines={1}>
                  {entry.name}
                </Text>
                <Text
                  testID={`share-card-cardio-${index}`}
                  style={[card.liftValue, compact && card.liftValueCompact]}
                  numberOfLines={1}
                >
                  {entry.figures}
                </Text>
              </View>
            ))}
            {cardioOverflow ? (
              <View style={[card.moreRow, { height: cardPt(rowHeight) }]}>
                <Text
                  testID="share-card-cardio-more"
                  style={[card.more, compact && card.liftNameCompact]}
                >
                  {`+${cardio.length - shownCardio.length} more`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}
