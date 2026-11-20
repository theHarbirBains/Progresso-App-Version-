import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { ErrorState } from '../design/ErrorState';
import { IconButton } from '../design/IconButton';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { SkeletonRows } from '../design/Skeleton';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale } from '../design/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { photoSource } from '../profile/montage/montageMedia';
import {
  addToMontage,
  fetchOwnMontage,
  MONTAGE_LIMIT,
  MONTAGE_VIDEO_SECONDS,
  montageProblem,
  removeFromMontage,
  reorderMontage,
  type OwnMontageItem,
  type PickedMedia,
} from '../profile/montage/montageQueries';
import { ProfileMontage } from '../profile/montage/ProfileMontage';
import { settingsStyles } from '../settings/settingsStyles';
import { useAppTheme } from '../theme/appThemeContext';

type Props = RootStackScreenProps<'ProfileMontage'>;

/** "0:12" from 12.4 seconds. */
function clock(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/**
 * Your montage (from Edit Profile -- the profile itself only shows it): it as your profile shows it, then each photo
 * or video in its place -- moved earlier or later, or removed -- and Add Photos or Videos, up to
 * four in all. Every change saves as it's made, and your profile shows it the next time it's in
 * view. Read each time the page opens.
 */
export function ProfileMontageScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id;
  const { accent } = useAppTheme();
  const [items, setItems] = useState<OwnMontageItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** What's being saved ("Adding 1 of 2..."), while it is. */
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      setItems(await fetchOwnMontage(userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your montage');
    }
  }, [userId]);

  useEffect(() => navigation.addListener('focus', () => void load()), [navigation, load]);

  const count = items?.length ?? 0;
  const full = count >= MONTAGE_LIMIT;

  async function add() {
    if (!userId || full) return;
    setNotice(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setNotice('Allow Progresso to see your photos to add them to your montage.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: MONTAGE_LIMIT - count,
      orderedSelection: true,
      // Videos come as 720p MP4: quick to load, small to keep, and they play everywhere.
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
      videoMaxDuration: MONTAGE_VIDEO_SECONDS,
    });
    const picked: PickedMedia[] = result.canceled
      ? []
      : result.assets.slice(0, MONTAGE_LIMIT - count);
    if (picked.length === 0) return;
    const problems: string[] = [];
    for (const [index, media] of picked.entries()) {
      setWorking(picked.length > 1 ? `Adding ${index + 1} of ${picked.length}...` : 'Adding...');
      const problem = montageProblem(media);
      if (problem) {
        problems.push(problem);
        continue;
      }
      try {
        await addToMontage(userId, media);
      } catch (err) {
        problems.push(err instanceof Error ? err.message : 'That one could not be added.');
      }
    }
    setWorking(null);
    setNotice(problems.length ? [...new Set(problems)].join(' ') : null);
    await load();
  }

  async function move(index: number, by: -1 | 1) {
    if (!items) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(index + by, 0, moved!);
    setItems(next);
    try {
      await reorderMontage(next.map((item) => item.id));
    } catch (err) {
      setItems(items);
      Alert.alert('That did not save', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  function remove(item: OwnMontageItem) {
    Alert.alert(
      item.kind === 'video' ? 'Remove this video?' : 'Remove this photo?',
      'It comes off your montage and is deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setWorking('Removing...');
            void removeFromMontage(item)
              .catch((err) =>
                Alert.alert(
                  'That did not work',
                  err instanceof Error ? err.message : 'Please try again.',
                ),
              )
              .finally(() => {
                setWorking(null);
                void load();
              });
          },
        },
      ],
    );
  }

  return (
    <Screen
      testID="profile-montage-screen"
      scrollTestID="profile-montage-scroll"
      contentContainerStyle={settingsStyles.categoryGap}
      header={
        <AppHeader
          testID="profile-montage-header"
          title="Montage"
          onBack={() => navigation.goBack()}
        />
      }
    >
      {items === null && !error ? (
        <SkeletonRows testID="profile-montage-loading" count={3} />
      ) : items === null ? (
        <ErrorState testID="profile-montage-error" message={error!} onRetry={() => void load()} />
      ) : (
        <>
          {/* Just as your profile shows it. */}
          {count > 0 ? (
            <ProfileMontage
              testID="profile-montage-preview"
              items={items}
              accent={accent.accent}
              ownerName="Your"
              isOwn
            />
          ) : null}

          <Section title="Your Photos & Videos">
            <View>
              {count === 0 ? (
                <Text testID="profile-montage-empty" style={styles.empty}>
                  Add up to four photos or videos. They move across your profile, under its buttons.
                </Text>
              ) : (
                items.map((item, index) => {
                  const name = item.kind === 'video' ? 'Video' : 'Photo';
                  return (
                    <ListRow
                      key={item.id}
                      testID={`profile-montage-item-${index}`}
                      title={`${index + 1}. ${name}`}
                      subtitle={
                        item.kind === 'video' && item.durationSeconds
                          ? clock(item.durationSeconds)
                          : undefined
                      }
                      divider={index > 0}
                      leading={
                        item.kind === 'video' ? (
                          <View style={styles.thumb}>
                            <Feather name="video" size={18} color={accent.accent} />
                          </View>
                        ) : (
                          <Image
                            source={photoSource(item)}
                            style={styles.thumb}
                            contentFit="cover"
                            accessibilityIgnoresInvertColors
                          />
                        )
                      }
                      trailing={
                        <View style={styles.controls}>
                          <IconButton
                            testID={`profile-montage-earlier-${index}`}
                            icon="chevron-up"
                            onPress={() => void move(index, -1)}
                            disabled={index === 0 || working !== null}
                            accessibilityLabel={`Move ${name.toLowerCase()} ${index + 1} earlier`}
                          />
                          <IconButton
                            testID={`profile-montage-later-${index}`}
                            icon="chevron-down"
                            onPress={() => void move(index, 1)}
                            disabled={index === count - 1 || working !== null}
                            accessibilityLabel={`Move ${name.toLowerCase()} ${index + 1} later`}
                          />
                          <IconButton
                            testID={`profile-montage-remove-${index}`}
                            icon="trash-2"
                            color={colors.destructive}
                            onPress={() => remove(item)}
                            disabled={working !== null}
                            accessibilityLabel={`Remove ${name.toLowerCase()} ${index + 1}`}
                          />
                        </View>
                      }
                      accessibilityLabel={`${index + 1}. ${name}`}
                    />
                  );
                })
              )}
            </View>
          </Section>

          {notice ? (
            <Text testID="profile-montage-notice" style={styles.notice}>
              {notice}
            </Text>
          ) : null}

          <PrimaryButton
            testID="profile-montage-add"
            label={working ?? (full ? 'Montage Full' : 'Add Photos or Videos')}
            icon={full || working ? undefined : 'plus'}
            onPress={() => void add()}
            disabled={full || working !== null}
            loading={working !== null}
            accentColor={accent.accent}
            onAccentColor={accent.onAccent}
          />
          <Text testID="profile-montage-hint" style={styles.hint}>
            {count} of {MONTAGE_LIMIT}. Photos, and videos up to a minute, shown muted. You and the
            people whose follow you accepted see it.
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  empty: {
    ...typeScale.callout,
    color: colors.textSecondary,
    padding: spacing.lg,
  },
  notice: {
    ...typeScale.callout,
    color: colors.destructive,
  },
  hint: {
    ...typeScale.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
