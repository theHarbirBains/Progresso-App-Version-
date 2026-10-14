import type { Ref } from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BACKGROUND_ASPECT, BACKGROUND_IMAGE } from '../design/AppBackgroundLayer';
import { Avatar } from '../design/Avatar';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import { formatWeightKg, fromKg, roundWeight } from '../lib/units';
import { mixHex, withAlpha } from '../theme/accentColor';
import type { ShareCardData, ShareTopSet } from './shareCardData';
import { shareCardBodyStyles as card, shareCardStyles as styles } from './shareCardStyles';
import { CARD_WIDTH, STORY_CANVAS, STORY_SAFE_AREA, cardPt } from './storyLayout';

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
// their own row; past that, the last row says how many more there are.
const TOP_SETS_SPACE = 270;
const ROW_GAP = 5;
const MAX_ROW_HEIGHT = 46;
const MAX_ROWS = 7;

// The frame around the card: a warm sunset gradient from the app's own amber
// into its warm near-black, so the space Instagram or TikTok covers with its
// own controls is still on-brand colour, never empty.
export const STORY_FRAME = [
  mixHex(colors.accent, colors.background, 0.62),
  mixHex(colors.accent, colors.background, 0.84),
  colors.background,
] as const;

// The photo at the top of the card: the sunset photo, a little larger than the
// card and placed so the sun glows low on the right, clear of the date and the
// workout's name.
const PHOTO_WIDTH = cardPt(CARD_WIDTH * 1.4);
const PHOTO_STYLE = {
  position: 'absolute',
  left: 0,
  top: cardPt(-120),
  width: PHOTO_WIDTH,
  height: PHOTO_WIDTH / BACKGROUND_ASPECT,
} as const;
const STAT_ICON_SIZE = cardPt(18);
// The logo the app opens with (LaunchScreen's mark), cropped tight to the
// mark, in place of a written brand name.
const LOGO = require('../../assets/progresso-mark-share.png');
const LOGO_ASPECT = 360 / 289;
const LOGO_HEIGHT = cardPt(26);
const LOGO_STYLE = { width: LOGO_HEIGHT * LOGO_ASPECT, height: LOGO_HEIGHT } as const;
// How the photo is darkened so its text reads: a scrim heaviest on the left,
// where the text sits, then a fade into the card's own fill. Chosen by
// measurement over the photo's brightest pixels -- don't lighten it without
// re-measuring.
const SIDE_SCRIM = [
  withAlpha(colors.surface, 0.55),
  withAlpha(colors.surface, 0.35),
  withAlpha(colors.surface, 0.25),
] as const;
const FADE = [
  withAlpha(colors.surface, 0.5),
  withAlpha(colors.surface, 0.25),
  withAlpha(colors.surface, 0.3),
  colors.surface,
] as const;

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
  return `${formatWeightKg(set.weightKg, unit)} ${unit} × ${set.reps}`;
}

function Stat({
  icon,
  value,
  label,
  first,
  testID,
}: {
  icon: 'clock' | 'list' | 'layers' | 'bar-chart-2';
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

// The shareable workout image: the card, inside its warm frame, on a 9:16
// story canvas. This whole canvas is what gets captured -- the preview IS the
// image.
export function ShareStory({ storyRef, ...cardProps }: Props & { storyRef?: Ref<View> }) {
  return (
    <View
      ref={storyRef}
      collapsable={false}
      testID="share-story"
      style={[styles.story, STORY_CANVAS]}
    >
      <LinearGradient
        testID="share-story-frame"
        colors={STORY_FRAME}
        locations={[0, 0.5, 1]}
        style={styles.fill}
      />
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

// The card: the sunset photo behind the brand mark, date and the workout's
// own name (nothing under it -- the name is the user's); then the session as
// four stats (duration, exercises, sets, volume), and every exercise's top set
// in workout order, a personal record marked quietly in the accent. Everything is real logged data in the user's unit;
// nothing is estimated, and no account detail (name, email, id) is ever drawn.
// Nothing on it looks tappable (no chevrons, no "View All") -- it's a picture.
export function ShareCard({ data, weightUnit, accentColor }: Props) {
  const overflow = data.topSets.length > MAX_ROWS;
  const shown = overflow ? data.topSets.slice(0, MAX_ROWS - 1) : data.topSets;
  const hiddenCount = data.topSets.length - shown.length;
  const rowCount = shown.length + (overflow ? 1 : 0);
  const rowHeight = Math.min(
    MAX_ROW_HEIGHT,
    (TOP_SETS_SPACE - (rowCount - 1) * ROW_GAP) / Math.max(rowCount, 1),
  );
  const thumbSize = cardPt(Math.min(32, rowHeight - 14));

  return (
    <View testID="share-card" style={[card.card, { width: cardPt(CARD_WIDTH) }]}>
      <View style={card.hero}>
        <Image
          testID="share-card-photo"
          source={BACKGROUND_IMAGE}
          style={PHOTO_STYLE}
          contentFit="cover"
        />
        <LinearGradient
          colors={SIDE_SCRIM}
          locations={[0, 0.6, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fill}
        />
        <LinearGradient colors={FADE} locations={[0, 0.3, 0.6, 1]} style={styles.fill} />

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
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {data.workoutName}
          </Text>
        </View>
      </View>

      <View testID="share-card-stats" style={card.stats}>
        <Stat
          first
          icon="clock"
          value={data.durationMinutes !== null ? `${data.durationMinutes} min` : '—'}
          label="Duration"
          testID="share-card-duration"
        />
        <Stat
          icon="list"
          value={String(data.exerciseCount)}
          label="Exercises"
          testID="share-card-exercises"
        />
        <Stat icon="layers" value={String(data.totalSets)} label="Sets" testID="share-card-sets" />
        <Stat
          icon="bar-chart-2"
          value={formatVolume(data.totalVolumeKg, weightUnit)}
          label={`Volume (${weightUnit})`}
          testID="share-card-volume"
        />
      </View>

      {shown.length > 0 ? (
        <View testID="share-card-top-sets" style={card.body}>
          <Text style={card.sectionLabel}>TOP SETS</Text>
          <View style={card.rows}>
            {shown.map((set, index) => {
              const isRecord = set.prLabel !== null;
              return (
                <View
                  key={`${set.exerciseName}-${index}`}
                  testID={`share-card-top-set-row-${index}`}
                  style={[card.row, { height: cardPt(rowHeight) }]}
                >
                  <Thumb set={set} size={thumbSize} />
                  <Text style={card.liftName} numberOfLines={1}>
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
                    style={[card.liftValue, isRecord && { color: accentColor }]}
                    numberOfLines={1}
                  >
                    {setValue(set, weightUnit)}
                  </Text>
                </View>
              );
            })}
            {overflow ? (
              <View style={[card.moreRow, { height: cardPt(rowHeight) }]}>
                <Text testID="share-card-top-sets-more" style={card.more}>
                  {`+${hiddenCount} more`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}
