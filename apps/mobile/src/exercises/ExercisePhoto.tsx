import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Avatar } from '../design/Avatar';
import { PhotoLightbox } from '../design/PhotoLightbox';
import { colors, typeScale } from '../design/theme';

interface Props {
  /** The machine/equipment photo, or null/undefined for most exercises (see exercises.photo_url). */
  uri?: string | null;
  /** The exercise's own name, for the initial-letter fallback. */
  name: string;
  size?: number;
  testID?: string;
  /** Set for an exercise the user owns: tapping the photo opens its editor (where the photo itself is added or changed) instead of the full-screen zoom. Built-ins pass nothing and keep the zoom. */
  onEdit?: () => void;
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
export function ExercisePhoto({ uri, name, size = 44, testID, onEdit }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const frame = { width: size, height: size, borderRadius: size / 2 };

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
    <>
      <TouchableOpacity
        testID={testID ? `${testID}-zoom` : undefined}
        onPress={() => setLightboxOpen(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel={`View ${name} photo`}
      >
        {photo}
      </TouchableOpacity>
      <PhotoLightbox
        testID={testID ? `${testID}-lightbox` : undefined}
        visible={lightboxOpen}
        uri={uri}
        onClose={() => setLightboxOpen(false)}
      />
    </>
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
