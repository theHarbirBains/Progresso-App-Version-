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
import { shareCardStyles as styles } from './shareCardStyles';

/**
 * The whole story image, in points. It is always laid out at exactly this size
 * (the screen scales its preview to fit), so what is saved never depends on
 * the phone: 3x this is 1080x1920, a 9:16 story.
 */
export const STORY_CANVAS = { width: 360, height: 640 } as const;
export const STORY_CAPTURE = { width: 1080, height: 1920 } as const;
/**
 * Where Instagram's and TikTok's own controls sit over a story -- the account
 * row and progress bars along the top, the reply or caption bar along the
 * bottom, buttons down the sides -- in canvas points (about 250px top, 290px
 * bottom and 110px each side of the 1080x1920 image). The card stays inside
 * what's left, so nothing of it is ever covered.
 */
export const STORY_SAFE_AREA = { top: 84, bottom: 96, side: 36 } as const;
/** The card's own layout width, and its height at its tallest (two records, three exercises). */
export const CARD_WIDTH = 360;
export const CARD_MAX_HEIGHT = 600;
/** One scale for every workout, so the card's type is always the same size: the tallest card just fits the safe area. */
export const CARD_SCALE = Math.min(
  (STORY_CANVAS.width - 2 * STORY_SAFE_AREA.side) / CARD_WIDTH,
  (STORY_CANVAS.height - STORY_SAFE_AREA.top - STORY_SAFE_AREA.bottom) / CARD_MAX_HEIGHT,
);

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
const PHOTO_WIDTH = CARD_WIDTH * 1.4;
const PHOTO_STYLE = {
  position: 'absolute',
  left: 0,
  top: -120,
  width: PHOTO_WIDTH,
  height: PHOTO_WIDTH / BACKGROUND_ASPECT,
} as const;
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
    <View style={[styles.stat, !first && styles.statDivided]}>
      <Feather name={icon} size={18} color={colors.textSecondary} />
      <Text testID={testID} style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// An exercise's machine photo, or its initial -- static, since the card is a picture.
function Thumb({ set, size }: { set: ShareTopSet; size: number }) {
  return (
    <View style={[styles.thumb, { width: size, height: size, borderRadius: size / 2 }]}>
      <Avatar
        uri={set.photoUrl}
        initial={set.exerciseName.trim().charAt(0).toUpperCase() || null}
        size={size}
        iconSize={Math.round(size * 0.5)}
        iconColor={colors.textSecondary}
        initialStyle={[styles.thumbInitial, { fontSize: Math.round(size * 0.4) }]}
      />
    </View>
  );
}

// The shareable workout image: the card, inside its warm frame, on a 9:16
// story canvas. This whole canvas is what gets captured -- the preview IS the
// image.
export function ShareStory({ storyRef, ...card }: Props & { storyRef?: Ref<View> }) {
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
        <View testID="share-card-scale" style={{ transform: [{ scale: CARD_SCALE }] }}>
          <ShareCard {...card} />
        </View>
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
    <View testID="share-card" style={[styles.card, { width: CARD_WIDTH }]}>
      <View style={styles.hero}>
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

        <View style={styles.heroTop}>
          <Text style={styles.wordmark}>PROGRESSO</Text>
          <Text testID="share-card-date" style={styles.date}>
            {formatCardDate(data.performedAt)}
          </Text>
        </View>
        <View>
          <Text
            testID="share-card-workout-name"
            style={styles.workoutName}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {data.workoutName}
          </Text>
          {data.musclesTrained ? (
            <Text testID="share-card-muscles" style={styles.muscles} numberOfLines={1}>
              {data.musclesTrained}
            </Text>
          ) : null}
        </View>
      </View>

      <View testID="share-card-stats" style={styles.stats}>
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

      <View style={styles.body}>
        {records.length > 0 ? (
          <View testID="share-card-pr-section" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>PERSONAL RECORDS</Text>
              <Text testID="share-card-pr-count" style={[styles.prCount, { color: accentColor }]}>
                {allRecords.length === 1 ? '1 PR' : `${allRecords.length} PRs`}
              </Text>
            </View>
            {records.map((set, index) => (
              <View key={`${set.exerciseName}-pr-${index}`} style={[styles.row, styles.recordRow]}>
                <Thumb set={set} size={36} />
                <View style={styles.rowText}>
                  <Text style={styles.recordName} numberOfLines={1}>
                    {set.exerciseName}
                  </Text>
                  <Text style={styles.recordLabel} numberOfLines={1}>
                    {set.prLabel}
                  </Text>
                </View>
                <Text
                  testID={`share-card-pr-value-${index}`}
                  style={[styles.recordValue, { color: accentColor }]}
                  numberOfLines={1}
                >
                  {setValue(set, weightUnit)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {topExercises.length > 0 ? (
          <View testID="share-card-lifts" style={styles.section}>
            <Text style={styles.sectionLabel}>TOP EXERCISES</Text>
            {topExercises.map((set, index) => (
              <View key={`${set.exerciseName}-${index}`} style={[styles.row, styles.liftRow]}>
                <View style={styles.rank}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <Thumb set={set} size={30} />
                <Text style={styles.liftName} numberOfLines={1}>
                  {set.exerciseName}
                </Text>
                <Text
                  testID={`share-card-top-set-${index}`}
                  style={styles.liftValue}
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
