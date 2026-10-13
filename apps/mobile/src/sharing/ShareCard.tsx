import type { Ref } from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BACKGROUND_IMAGE } from '../design/AppBackgroundLayer';
import { Avatar } from '../design/Avatar';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import { formatWeightKg, fromKg, roundWeight } from '../lib/units';
import { withAlpha } from '../theme/accentColor';
import type { ShareCardData, ShareTopSet } from './shareCardData';
import { shareCardStyles as styles } from './shareCardStyles';

/**
 * The card's own size, in points. It is always laid out at exactly this size
 * (the screen scales its preview to fit), so what is saved never depends on
 * the phone: 3x this is 1080x1920, a 9:16 story.
 */
export const STORY_CARD = { width: 360, height: 640 } as const;
export const STORY_CAPTURE = { width: 1080, height: 1920 } as const;

const MAX_RECORDS = 2;
const MAX_TOP_EXERCISES = 3;

// How the photo at the top is darkened so its text reads: a scrim heaviest on
// the left, where the text sits, then a fade into the card's own fill. Chosen
// by measurement over the photo's brightest pixels -- don't lighten it
// without re-measuring.
const SIDE_SCRIM = [
  withAlpha(colors.surface, 0.6),
  withAlpha(colors.surface, 0.35),
  withAlpha(colors.surface, 0.15),
] as const;
const FADE = [
  withAlpha(colors.surface, 0.4),
  withAlpha(colors.surface, 0.3),
  colors.surface,
] as const;

interface Props {
  data: ShareCardData;
  /** The user's own weight unit -- every weight on the card is shown in it. */
  weightUnit: 'kg' | 'lb';
  /** The accent -- used only for personal records. */
  accentColor: string;
  /** The view that gets captured to PNG -- the preview IS the image. */
  cardRef?: Ref<View>;
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

// The shareable workout image: a 9:16 story card. The warm gym photo sits
// behind the brand mark, date, workout name and muscles; then the session as
// four stats (duration, exercises, sets, volume), the personal records set
// this workout (the one accented block) and its first exercises, numbered.
// Everything is real logged data in the user's unit; nothing is estimated,
// and no account detail (name, email, id) is ever drawn. Nothing on it looks
// tappable (no chevrons, no "View All") -- it's a picture.
export function ShareCard({ data, weightUnit, accentColor, cardRef }: Props) {
  const allRecords = data.topSets.filter((s) => s.prLabel !== null);
  const records = allRecords.slice(0, MAX_RECORDS);
  const topExercises = data.topSets.slice(0, MAX_TOP_EXERCISES);

  return (
    <View ref={cardRef} collapsable={false} testID="share-card" style={[styles.card, STORY_CARD]}>
      <View style={styles.hero}>
        <Image
          testID="share-card-photo"
          source={BACKGROUND_IMAGE}
          style={styles.fill}
          contentFit="cover"
        />
        <LinearGradient
          colors={SIDE_SCRIM}
          locations={[0, 0.6, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fill}
        />
        <LinearGradient colors={FADE} locations={[0, 0.45, 1]} style={styles.fill} />

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
