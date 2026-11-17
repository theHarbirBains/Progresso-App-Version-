import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Avatar } from '../design/Avatar';
import { ZoomablePhoto } from '../design/PhotoLightbox';
import { colors, typeScale } from '../design/theme';
import { useBuiltinExtras } from './builtinExtras';
import { ExerciseGuideSheet } from './ExerciseGuideSheet';
import { hasIllustration } from './illustrations/exerciseArt';
import { ExerciseThumbnail } from './illustrations/ExerciseIllustration';

interface Props {
  /** The machine/equipment photo, or null/undefined for most exercises (see exercises.photo_url). */
  uri?: string | null;
  /** The exercise's own name, for the initial-letter fallback. */
  name: string;
  size?: number;
  testID?: string;
  /** Set for an exercise the user owns: tapping the photo opens its editor (where the photo itself is added or changed) instead of the full-screen zoom. Built-ins pass nothing and keep the zoom. */
  onEdit?: () => void;
  /**
   * The exercise itself: a built-in with no photo shows its illustrated instructor instead of its
   * first letter, and tapping it opens how to do it (ExerciseGuideSheet).
   */
  exerciseId?: string | null;
  /** Its illustration's slug, when the caller already has it (a library row); otherwise looked up by id. */
  slug?: string | null;
}

// An exercise's optional machine photo, shown "like a contact photo" -- a
// circle with the real picture when one exists, otherwise the exercise
// name's first letter (Avatar's own existing fallback, reused as-is: the
// exact same "photo, else initial" convention already used for a person's
// profile picture elsewhere in this app). When there IS a real photo,
// tapping it opens a full-screen view (PhotoLightbox) instead of a plain
// initial, which has nothing worth seeing bigger -- this inner touch never
// also triggers the row it sits in (e.g. opening the exercise for editing),
// since RN only ever hands a touch to the innermost responder that claims it.
export function ExercisePhoto({ uri, name, size = 44, testID, onEdit, exerciseId, slug }: Props) {
  const frame = { width: size, height: size, borderRadius: size / 2 };
  const extras = useBuiltinExtras(!uri && !slug ? exerciseId : null);
  const artSlug = uri ? null : (slug ?? extras?.slug ?? null);
  const [guideOpen, setGuideOpen] = useState(false);

  if (hasIllustration(artSlug)) {
    const art = (
      <View testID={testID} style={[styles.frame, frame]}>
        <ExerciseThumbnail
          slug={artSlug}
          size={size}
          testID={testID ? `${testID}-illustration` : undefined}
        />
      </View>
    );
    if (onEdit || !exerciseId) {
      return onEdit ? (
        <TouchableOpacity
          testID={testID ? `${testID}-edit` : undefined}
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${name}`}
        >
          {art}
        </TouchableOpacity>
      ) : (
        art
      );
    }
    return (
      <>
        <TouchableOpacity
          testID={testID ? `${testID}-guide` : undefined}
          onPress={() => setGuideOpen(true)}
          accessibilityRole="imagebutton"
          accessibilityLabel={`How to do ${name}`}
        >
          {art}
        </TouchableOpacity>
        <ExerciseGuideSheet
          testID={testID ? `${testID}-guide-sheet` : undefined}
          visible={guideOpen}
          onClose={() => setGuideOpen(false)}
          exerciseId={exerciseId}
          exerciseName={name}
        />
      </>
    );
  }

  const photo = (
    <View testID={testID} style={[styles.frame, frame]}>
      <Avatar
        testID={testID ? `${testID}-inner` : undefined}
        uri={uri}
        initial={name.trim().charAt(0).toUpperCase() || null}
        size={size}
        iconSize={Math.round(size * 0.5)}
        iconColor={colors.textSecondary}
        initialStyle={[styles.initial, { fontSize: Math.round(size * 0.4) }]}
      />
    </View>
  );

  if (onEdit) {
    return (
      <TouchableOpacity
        testID={testID ? `${testID}-edit` : undefined}
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${name}`}
      >
        {photo}
      </TouchableOpacity>
    );
  }

  if (!uri) return photo;

  return (
    <ZoomablePhoto uri={uri} name={name} testID={testID}>
      {photo}
    </ZoomablePhoto>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  initial: {
    ...typeScale.cardTitle,
    color: colors.textSecondary,
  },
});
