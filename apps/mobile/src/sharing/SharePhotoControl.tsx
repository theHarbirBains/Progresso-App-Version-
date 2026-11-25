import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { BottomSheet } from '../design/BottomSheet';
import { GlyphWell } from '../design/GlyphWell';
import { ListRow } from '../design/ListRow';
import { Text } from '../design/Text';
import { Toggle } from '../design/Toggle';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';
import { photoRect, type SharePhoto } from './sharePhoto';
import type { SharePhotoState } from './useSharePhoto';

const THUMB = 40;
const CHOICE = 64;

/** A photo in a circle `size` across, covering it as the card draws it. */
function PhotoCircle({ photo, size }: { photo: SharePhoto; size: number }) {
  const rect = photoRect(size, photo);
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image
        source={photo.source}
        style={rect ? { position: 'absolute', ...rect } : { width: size, height: size }}
        contentFit="cover"
        cachePolicy="memory-disk"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

/** What the row says under "Your Photo". */
function statusLine(state: SharePhotoState): string {
  if (state.picking) return 'Adding your photo…';
  if (state.resolving && state.setting?.choice) return 'Finding your photo…';
  if (state.photo && state.onCard) return `${state.photo.label} · On the card`;
  if (state.photo) return 'Not on the card';
  return 'Add your photo to the card';
}

/**
 * Share Workout's photo control: one widget above Share -- the photo chosen (or a `user` glyph),
 * "Your Photo" and what's on the card, and a switch putting it on or taking it off (kept either
 * way). The widget opens the chooser: the profile picture and the montage's photos as circles
 * (the one chosen ringed in the accent), Choose From Photos, cropped square as it's picked, and
 * Remove Photo once there's one -- with a line that the photo stays on the phone.
 */
export function SharePhotoControl({
  state,
  accentColor,
  onAccentColor,
  disabled = false,
  testID = 'share-photo',
}: {
  state: SharePhotoState;
  accentColor: string;
  onAccentColor: string;
  disabled?: boolean;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const status = statusLine(state);
  const busy = disabled || state.picking || state.setting === null;

  function openChooser() {
    state.loadMontage();
    setOpen(true);
  }

  function onSwitch(on: boolean) {
    if (!on) state.setIncluded(false);
    else if (state.photo) state.setIncluded(true);
    else openChooser();
  }

  const chosenKey = state.photo?.key ?? null;

  return (
    <>
      <AppCard testID={testID} style={styles.card}>
        <View style={styles.row}>
          <TouchableOpacity
            testID={`${testID}-open`}
            style={styles.open}
            onPress={openChooser}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Your photo. ${status}. Choose a photo`}
          >
            {state.photo ? (
              <PhotoCircle photo={state.photo} size={THUMB} />
            ) : (
              <GlyphWell icon="user" accentColor={accentColor} size={THUMB} />
            )}
            <View style={styles.words}>
              <Text style={styles.title}>Your Photo</Text>
              <Text testID={`${testID}-status`} style={styles.status} numberOfLines={1}>
                {status}
              </Text>
            </View>
          </TouchableOpacity>
          {state.picking ? (
            <ActivityIndicator color={accentColor} />
          ) : (
            <Toggle
              testID={`${testID}-switch`}
              value={state.onCard}
              onValueChange={onSwitch}
              disabled={busy}
              accentColor={accentColor}
              onAccentColor={onAccentColor}
              accessibilityLabel="Show your photo on the card"
            />
          )}
        </View>
      </AppCard>

      <BottomSheet visible={open} onClose={() => setOpen(false)} testID={`${testID}-sheet`}>
        <Text style={styles.sheetTitle}>Your Photo on the Card</Text>
        <Text style={styles.sheetNote}>
          It stays on this phone, and is only in the image you share or save.
        </Text>

        <Text style={styles.kicker}>FROM YOUR PROFILE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.choices}
        >
          {state.profilePhotos.map((photo) => {
            const chosen = photo.key === chosenKey;
            return (
              <TouchableOpacity
                key={photo.key}
                testID={`${testID}-choice-${photo.key.split(':')[0]}${
                  photo.key.startsWith('montage:') ? `-${photo.key.slice(8)}` : ''
                }`}
                style={styles.choice}
                onPress={() => {
                  state.chooseProfilePhoto(photo.key);
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${photo.label}${chosen ? '. Chosen' : ''}`}
                accessibilityState={{ selected: chosen }}
              >
                <View style={[styles.choiceRing, chosen && { borderColor: accentColor }]}>
                  <PhotoCircle photo={photo} size={CHOICE} />
                </View>
                {chosen ? (
                  <View style={[styles.tick, { backgroundColor: accentColor }]}>
                    <Feather name="check" size={12} color={onAccentColor} />
                  </View>
                ) : null}
                <Text style={styles.choiceLabel} numberOfLines={1}>
                  {photo.key.startsWith('avatar:') ? 'Profile' : 'Montage'}
                </Text>
              </TouchableOpacity>
            );
          })}
          {state.montageLoading ? (
            <View style={styles.loadingChoice}>
              <ActivityIndicator color={accentColor} />
            </View>
          ) : null}
        </ScrollView>
        {state.profilePhotos.length === 0 && !state.montageLoading ? (
          <Text testID={`${testID}-none`} style={styles.sheetNote}>
            {state.montageFailed
              ? "Your montage couldn't be loaded. Try again, or choose one from your photos."
              : 'No profile picture or montage photos yet.'}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <ListRow
            testID={`${testID}-library`}
            icon="image"
            title="Choose From Photos"
            onPress={() => {
              setOpen(false);
              void state.chooseFromLibrary();
            }}
          />
          {state.setting?.choice ? (
            <ListRow
              testID={`${testID}-remove`}
              icon="trash-2"
              title="Remove Photo"
              destructive
              chevron={false}
              divider
              onPress={() => {
                state.remove();
                setOpen(false);
              }}
            />
          ) : null}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  open: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
  },
  circle: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  words: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  status: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  sheetTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  sheetNote: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  kicker: {
    ...typeScale.caption,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginTop: spacing.lg,
  },
  choices: {
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  choice: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  // The chosen photo's ring, in the accent; the rest keep a quiet one the same size, so nothing
  // moves when the choice does.
  choiceRing: {
    padding: 2,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.glassBorderStrong,
  },
  tick: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceLabel: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  loadingChoice: {
    width: CHOICE + 8,
    height: CHOICE + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    marginTop: spacing.sm,
  },
});
