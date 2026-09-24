import type { Ref } from 'react';
import { Image, View } from 'react-native';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import { formatWeightKg, fromKg, roundWeight } from '../lib/units';
import { withAlpha } from '../theme/accentColor';
import type { ShareCardData, ShareTopSet } from './shareCardData';
import { SHARE_FORMATS, type ShareFormat, type ShareOptions } from './shareCardOptions';
import { shareCardStyles as styles } from './shareCardStyles';

interface Props {
  data: ShareCardData;
  /** The user's own weight unit -- every weight on the card is shown in it. */
  weightUnit: 'kg' | 'lb';
  format: ShareFormat;
  options: ShareOptions;
  /** The user's Workout accent -- used only for personal records. */
  accentColor: string;
  /** A photo the user chose for this card only (a local file URI, never uploaded). */
  photoUri: string | null;
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
  return roundWeight(fromKg(kg, unit)).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function setValue(set: ShareTopSet, unit: 'kg' | 'lb'): string {
  return `${formatWeightKg(set.weightKg, unit)}${unit}×${set.reps}`;
}

// A row of the "session" block: a quiet label and a mono value.
function StatRow({
  label,
  testID,
  compact,
  children,
}: {
  label: string;
  testID?: string;
  compact: boolean;
  children: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text testID={testID} style={[styles.rowValue, compact && styles.rowValueCompact]}>
        {children}
      </Text>
    </View>
  );
}

// The shareable workout image, drawn as one minimal card: brand mark and date,
// the workout's name and muscles, then only the blocks the user left on --
// personal records (the one accented block), the session's duration / sets /
// volume as plain rows, and the top lifts. Everything is real logged data in
// the user's unit; nothing is estimated, and no account detail (name, email,
// id) is ever drawn. A photo the user picked sits behind it under a dark
// scrim.
export function ShareCard({
  data,
  weightUnit,
  format,
  options,
  accentColor,
  photoUri,
  cardRef,
}: Props) {
  const spec = SHARE_FORMATS[format];
  const compact = format === 'feed';
  const records = options.records
    ? data.topSets.filter((s) => s.prLabel !== null).slice(0, spec.maxRecords)
    : [];
  // A record is headlined above, so it is not repeated in the list of lifts.
  const lifts = options.lifts
    ? data.topSets.filter((s) => !options.records || s.prLabel === null).slice(0, spec.maxLifts)
    : [];
  const showDuration = options.duration && data.durationMinutes !== null;
  const showSession = showDuration || options.sets || options.volume;

  return (
    <View
      ref={cardRef}
      collapsable={false}
      testID="share-card"
      style={[styles.card, { aspectRatio: spec.aspectRatio }]}
    >
      {photoUri ? (
        <>
          <Image
            testID="share-card-photo"
            source={{ uri: photoUri }}
            style={styles.photo}
            resizeMode="cover"
          />
          <View
            testID="share-card-scrim"
            style={[styles.scrim, { backgroundColor: withAlpha(colors.background, 0.78) }]}
          />
        </>
      ) : null}

      <View style={[styles.body, compact && styles.bodyCompact]}>
        <View>
          <View style={styles.topRow}>
            <Text style={styles.wordmark}>PROGRESSO</Text>
            {options.date ? (
              <Text testID="share-card-date" style={styles.date}>
                {formatCardDate(data.performedAt)}
              </Text>
            ) : null}
          </View>
          <Text testID="share-card-workout-name" style={styles.workoutName} numberOfLines={2}>
            {data.workoutName}
          </Text>
          {data.musclesTrained ? (
            <Text testID="share-card-muscles" style={styles.muscles} numberOfLines={1}>
              {data.musclesTrained}
            </Text>
          ) : null}
        </View>

        <View style={compact ? styles.blocksCompact : styles.blocks}>
          {records.length > 0 ? (
            <View testID="share-card-pr-section" style={styles.section}>
              <Text style={styles.sectionLabel}>
                PERSONAL RECORD{records.length > 1 ? 'S' : ''}
              </Text>
              {records.map((set, index) => (
                <View key={`${set.exerciseName}-pr-${index}`}>
                  <Text style={styles.recordName} numberOfLines={1}>
                    {set.exerciseName} · {set.prLabel}
                  </Text>
                  <Text
                    testID={`share-card-pr-value-${index}`}
                    style={[
                      styles.recordValue,
                      compact && styles.recordValueCompact,
                      { color: accentColor },
                    ]}
                  >
                    {setValue(set, weightUnit)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {showSession ? (
            <View testID="share-card-session" style={styles.section}>
              <Text style={styles.sectionLabel}>SESSION</Text>
              {showDuration ? (
                <StatRow compact={compact} label="Duration" testID="share-card-duration">
                  {`${data.durationMinutes} min`}
                </StatRow>
              ) : null}
              {options.sets ? (
                <StatRow compact={compact} label="Sets" testID="share-card-sets">
                  {String(data.totalSets)}
                </StatRow>
              ) : null}
              {options.volume ? (
                <StatRow compact={compact} label="Volume" testID="share-card-volume">
                  {`${formatVolume(data.totalVolumeKg, weightUnit)} ${weightUnit}`}
                </StatRow>
              ) : null}
            </View>
          ) : null}

          {lifts.length > 0 ? (
            <View testID="share-card-lifts" style={styles.section}>
              <Text style={styles.sectionLabel}>TOP LIFTS</Text>
              {lifts.map((set, index) => (
                <View key={`${set.exerciseName}-${index}`} style={styles.row}>
                  <Text style={styles.liftName} numberOfLines={1}>
                    {set.exerciseName}
                  </Text>
                  <Text testID={`share-card-top-set-${index}`} style={styles.liftValue}>
                    {setValue(set, weightUnit)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
