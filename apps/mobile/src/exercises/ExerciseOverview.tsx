import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { AppCard } from '../design/AppCard';
import { TextButton } from '../design/Button';
import { PhotoLightbox } from '../design/PhotoLightbox';
import { Text } from '../design/Text';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';
import { useBuiltinExtras } from './builtinExtras';
import { EQUIPMENT_LABELS } from './equipment';
import { ExercisePhoto } from './ExercisePhoto';
import type { ExerciseDetails } from './exerciseQueries';
import { hasIllustration, illustrationFor } from './illustrations/exerciseArt';
import { Frame, usePrefix } from './illustrations/ExerciseIllustration';
import { EXERCISE_RENDERS } from './illustrations/renders.generated';
import { ExerciseVideo } from './videos/ExerciseVideo';
import { exerciseVideoFor } from './videos/exerciseVideoSource';
import { LOAD_TYPE_LABELS, pulleyPositionText, pulleyText } from './machineLoad';
import {
  MOVEMENT_CATEGORY_LABELS,
  movementCategoryOf,
  movementPatternLabel,
} from './movementCategories';
import { MOVEMENT_TYPE_LABELS } from './movementTypes';
import { MUSCLE_GROUP_LABELS } from './muscleGroups';
import { changeOwnPhoto } from './ownPhotoActions';
import { canKeepOwnPhotos, useOwnPhoto } from './ownPhotos';

/** The tallest the picture at the top draws. */
const HERO_MAX = 300;

/**
 * The picture at the top of an exercise's page, as large as the card allows: the person's own
 * photo of the machine (a built-in) or the exercise's photo (their own exercise), else a
 * built-in's movement -- its 3D render's last frame, or its drawing's -- and nothing for one of
 * their own without a photo. A built-in's opens How to Do It; a photo opens full screen.
 */
function Hero({
  slug,
  photoUri,
  width,
  onOpenGuide,
  exerciseName,
  testID,
}: {
  slug: string | null;
  photoUri: string | null;
  width: number;
  onOpenGuide?: () => void;
  exerciseName: string;
  testID: string;
}) {
  const prefix = usePrefix();
  const [photoOpen, setPhotoOpen] = useState(false);
  const side = Math.min(Math.round(width * 0.8), HERO_MAX);
  if (photoUri) {
    return (
      <>
        <TouchableOpacity
          testID={`${testID}-photo`}
          onPress={() => setPhotoOpen(true)}
          activeOpacity={0.85}
          accessibilityRole="imagebutton"
          accessibilityLabel={`${exerciseName} photo. View full screen`}
          style={[styles.hero, { width, height: side }]}
        >
          <Image
            source={{ uri: photoUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            accessibilityIgnoresInvertColors
          />
        </TouchableOpacity>
        <PhotoLightbox
          testID={`${testID}-lightbox`}
          visible={photoOpen}
          uri={photoUri}
          onClose={() => setPhotoOpen(false)}
        />
      </>
    );
  }
  const rendered = slug ? EXERCISE_RENDERS[slug] : undefined;
  const drawn = rendered ? null : illustrationFor(slug);
  if (!rendered && !drawn) return null;
  let art: ReactNode;
  if (rendered) {
    art = (
      <Image
        testID={`${testID}-render`}
        source={rendered.frames[rendered.frames.length - 1]}
        style={{ width: side, height: side }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
    );
  } else if (drawn) {
    const vb = drawn.viewBox;
    const scale = Math.min(side / vb.width, side / vb.height);
    art = (
      <View testID={`${testID}-drawing`}>
        <Frame
          frame={drawn.frames[drawn.frames.length - 1]}
          viewBox={vb}
          width={Math.round(vb.width * scale)}
          height={Math.round(vb.height * scale)}
          prefix={prefix}
        />
      </View>
    );
  }
  return (
    <TouchableOpacity
      testID={`${testID}-hero`}
      onPress={onOpenGuide}
      disabled={!onOpenGuide}
      activeOpacity={0.85}
      accessibilityRole={onOpenGuide ? 'button' : 'image'}
      accessibilityLabel={`${exerciseName}${onOpenGuide ? '. How to Do It' : ''}`}
      style={[styles.hero, styles.heroArt, { width, height: side }]}
    >
      {art}
    </TouchableOpacity>
  );
}

/** One fact about it: a muted label over its value ("Attachment" over "V-Handle"). */
function Fact({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View testID={testID} style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

/**
 * The top of an exercise's own page (ProgressExerciseDetail's Summary), after Hevy's: the picture
 * across the card, its name, "Primary: Back" and "Secondary: Biceps, Shoulders", then what it's
 * done with, set out one fact at a time (equipment, grip, attachment, where its cable starts, how
 * it's loaded, its movement, one side at a time, its gym), and Add Your Machine Photo. A built-in's
 * picture opens How to Do It. Nothing until it's read: the page's figures are whole without it.
 */
export function ExerciseOverview({
  details,
  exerciseId,
  exerciseName,
  accentColor,
  onOpenGuide,
  testID = 'exercise-overview',
}: {
  details: ExerciseDetails | null;
  exerciseId: string;
  exerciseName: string;
  accentColor: string;
  /** Opens How to Do It (the page's How To tab); absent where the exercise has none. */
  onOpenGuide?: () => void;
  testID?: string;
}) {
  const extras = useBuiltinExtras(exerciseId);
  const own = useOwnPhoto(exerciseId);
  const { width: screenWidth } = useWindowDimensions();
  const [cardWidth, setCardWidth] = useState(Math.max(0, screenWidth - spacing.lg * 4));
  if (!details) return null;
  const builtin = !!extras;
  const slug = extras?.slug ?? null;
  const photoUri = own ?? details.photoUrl ?? null;
  // A built-in's demonstration video, where it has one and a provider's on (exerciseVideoSource).
  const video = exerciseVideoFor(slug);
  const hasHero = !!video || !!photoUri || (!!slug && hasIllustration(slug));
  const secondary = (extras?.secondaryMuscleGroups ?? []).filter(
    (group) => group !== details.muscleGroup,
  );
  const category = movementCategoryOf(extras?.movementPattern);
  const pattern = movementPatternLabel(extras?.movementPattern);
  const facts: { key: string; label: string; value: string }[] = [
    details.equipment
      ? { key: 'equipment', label: 'Equipment', value: EQUIPMENT_LABELS[details.equipment] }
      : null,
    details.grip ? { key: 'grip', label: 'Grip', value: details.grip } : null,
    details.attachment
      ? { key: 'attachment', label: 'Attachment', value: details.attachment }
      : null,
    details.pulleyPosition && pulleyPositionText(details.pulleyPosition)
      ? {
          key: 'pulley',
          label: 'Cable',
          value: pulleyPositionText(details.pulleyPosition) as string,
        }
      : null,
    details.loadType
      ? { key: 'load', label: 'Loading', value: LOAD_TYPE_LABELS[details.loadType] }
      : null,
    details.pulley
      ? { key: 'oldPulley', label: 'Pulley', value: pulleyText(details.pulley) }
      : null,
    pattern
      ? {
          key: 'movement',
          label: 'Movement',
          value: category ? `${pattern} · ${MOVEMENT_CATEGORY_LABELS[category]}` : pattern,
        }
      : null,
    details.movementType === 'unilateral'
      ? { key: 'sides', label: 'Sides', value: MOVEMENT_TYPE_LABELS.unilateral }
      : null,
    details.gym ? { key: 'gym', label: 'Gym', value: details.gym } : null,
  ].filter((fact): fact is { key: string; label: string; value: string } => fact !== null);

  return (
    <AppCard testID={testID}>
      <View
        style={styles.body}
        onLayout={(event) => setCardWidth(Math.round(event.nativeEvent.layout.width))}
      >
        {video ? (
          <ExerciseVideo
            testID={`${testID}-video`}
            urls={video}
            width={cardWidth}
            height={Math.min(Math.round(cardWidth * 0.8), 300)}
            accentColor={accentColor}
            exerciseName={exerciseName}
          />
        ) : hasHero ? (
          <Hero
            slug={slug}
            photoUri={photoUri}
            width={cardWidth}
            onOpenGuide={onOpenGuide}
            exerciseName={exerciseName}
            testID={testID}
          />
        ) : (
          <View style={styles.noHero}>
            <ExercisePhoto testID={`${testID}-initial`} uri={null} name={exerciseName} size={56} />
          </View>
        )}

        <View style={styles.block}>
          <Text testID={`${testID}-name`} style={styles.name} accessibilityRole="header">
            {exerciseName}
          </Text>
          <Text testID={`${testID}-muscles`} style={styles.muscleLine}>
            Primary: {MUSCLE_GROUP_LABELS[details.muscleGroup]}
          </Text>
          {secondary.length > 0 ? (
            <Text testID={`${testID}-secondary`} style={styles.muscleLine}>
              Secondary: {secondary.map((group) => MUSCLE_GROUP_LABELS[group]).join(', ')}
            </Text>
          ) : null}
        </View>

        {facts.length > 0 ? (
          <View testID={`${testID}-facts`} style={styles.facts}>
            {facts.map((fact) => (
              <Fact
                key={fact.key}
                testID={`${testID}-fact-${fact.key}`}
                label={fact.label}
                value={fact.value}
              />
            ))}
          </View>
        ) : null}

        {builtin && canKeepOwnPhotos() ? (
          <View style={styles.actions}>
            <TextButton
              testID={`${testID}-photo-action`}
              label={own ? 'Change Photo' : 'Add Your Machine Photo'}
              onPress={() => changeOwnPhoto({ exerciseId, hasPhoto: !!own })}
            />
          </View>
        ) : null}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.lg,
  },
  hero: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  heroArt: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noHero: {
    alignItems: 'flex-start',
  },
  block: {
    gap: spacing.xs,
  },
  name: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  muscleLine: {
    ...typeScale.callout,
    color: colors.textSecondary,
  },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.md,
  },
  fact: {
    width: '50%',
    paddingRight: spacing.md,
    gap: 2,
  },
  factLabel: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  factValue: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.lg,
  },
});
