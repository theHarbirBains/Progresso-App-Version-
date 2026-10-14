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

const MAX_RECORDS = 2;
const MAX_TOP_EXERCISES = 3;

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
const RECORD_THUMB_SIZE = cardPt(36);
const LIFT_THUMB_SIZE = cardPt(30);
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

// The card: the sunset photo behind the brand mark, date, workout name and
// muscles; then the session as four stats (duration, exercises, sets, volume),
// the personal records set this workout (the one accented block) and its first
// exercises, numbered. Everything is real logged data in the user's unit;
// nothing is estimated, and no account detail (name, email, id) is ever drawn.
// Nothing on it looks tappable (no chevrons, no "View All") -- it's a picture.
export function ShareCard({ data, weightUnit, accentColor }: Props) {
  const allRecords = data.topSets.filter((s) => s.prLabel !== null);
  const records = allRecords.slice(0, MAX_RECORDS);
  const topExercises = data.topSets.slice(0, MAX_TOP_EXERCISES);

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
          <Text style={card.wordmark}>PROGRESSO</Text>
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
          {data.musclesTrained ? (
            <Text testID="share-card-muscles" style={card.muscles} numberOfLines={1}>
              {data.musclesTrained}
            </Text>
          ) : null}
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

      <View style={card.body}>
        {records.length > 0 ? (
          <View testID="share-card-pr-section" style={card.section}>
            <View style={card.sectionHeader}>
              <Text style={card.sectionLabel}>PERSONAL RECORDS</Text>
              <Text testID="share-card-pr-count" style={[card.prCount, { color: accentColor }]}>
                {allRecords.length === 1 ? '1 PR' : `${allRecords.length} PRs`}
              </Text>
            </View>
            {records.map((set, index) => (
              <View key={`${set.exerciseName}-pr-${index}`} style={[card.row, card.recordRow]}>
                <Thumb set={set} size={RECORD_THUMB_SIZE} />
                <View style={card.rowText}>
                  <Text style={card.recordName} numberOfLines={1}>
                    {set.exerciseName}
                  </Text>
                  <Text style={card.recordLabel} numberOfLines={1}>
                    {set.prLabel}
                  </Text>
                </View>
                <Text
                  testID={`share-card-pr-value-${index}`}
                  style={[card.recordValue, { color: accentColor }]}
                  numberOfLines={1}
                >
                  {setValue(set, weightUnit)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {topExercises.length > 0 ? (
          <View testID="share-card-lifts" style={card.section}>
            <Text style={card.sectionLabel}>TOP EXERCISES</Text>
            {topExercises.map((set, index) => (
              <View key={`${set.exerciseName}-${index}`} style={[card.row, card.liftRow]}>
                <View style={card.rank}>
                  <Text style={card.rankText}>{index + 1}</Text>
                </View>
                <Thumb set={set} size={LIFT_THUMB_SIZE} />
                <Text style={card.liftName} numberOfLines={1}>
                  {set.exerciseName}
                </Text>
                <Text
                  testID={`share-card-top-set-${index}`}
                  style={card.liftValue}
                  numberOfLines={1}
                >
                  {setValue(set, weightUnit)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}
