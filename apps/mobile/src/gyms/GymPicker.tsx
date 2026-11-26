import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { SectionHeader } from '../design/SectionHeader';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, fonts, minTouchTarget, radii, spacing, typeScale } from '../design/theme';
import { withAlpha } from '../theme/accentColor';
import { phonePosition } from './gymLocation';
import {
  formatDistance,
  gymSearchAvailable,
  nearbyGyms,
  sameGym,
  searchGyms,
  type Coordinates,
  type GymPlace,
} from './gymSearch';
import { fetchRecentGyms } from './workoutGyms';

/** How long typing rests before Apple Maps is searched. */
const SEARCH_DEBOUNCE_MS = 350;

type NearbyState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'found'; gyms: GymPlace[] }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'failed' };

/** One gym to choose: its name, address and how far, ticked once chosen. */
function GymRow({
  gym,
  chosen,
  onPress,
  divider,
  accentColor,
  testID,
}: {
  gym: GymPlace;
  chosen: boolean;
  onPress: () => void;
  divider: boolean;
  accentColor: string;
  testID: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.row, divider && styles.rowDivider]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: chosen }}
      accessibilityLabel={`${gym.name}${gym.address ? `, ${gym.address}` : ''}${
        gym.distanceMeters !== undefined ? `, ${formatDistance(gym.distanceMeters)} away` : ''
      }${chosen ? ', chosen' : ''}`}
    >
      <View style={styles.rowWords}>
        <Text style={styles.rowName} numberOfLines={1}>
          {gym.name}
        </Text>
        {gym.address ? (
          <Text style={styles.rowAddress} numberOfLines={2}>
            {gym.address}
          </Text>
        ) : null}
      </View>
      {gym.distanceMeters !== undefined ? (
        <Text style={styles.distance}>{formatDistance(gym.distanceMeters)}</Text>
      ) : null}
      <Feather
        name={chosen ? 'check-circle' : 'circle'}
        size={22}
        color={chosen ? accentColor : colors.textMuted}
      />
    </TouchableOpacity>
  );
}

/**
 * Choosing the gym a workout is at, as a page of its own (an iPhone page sheet): a search field
 * -- by name or area, on Apple Maps, as it's typed -- Find Gyms Near Me (asking for the phone's
 * location only then), a map of what's found with the one chosen picked out, the gyms trained at
 * lately, and the results, each its name, address and distance. Nothing is ever chosen for them:
 * a gym is tapped, then Confirm Gym. Where Apple Maps can't be searched (off iPhone) or finds
 * nothing, what's typed can be used as the gym's name. Remove Gym takes one off.
 */
export function GymPicker({
  visible,
  userId,
  current,
  onClose,
  onConfirm,
  onRemove,
  accentColor,
  onAccentColor,
  testID = 'gym-picker',
}: {
  visible: boolean;
  userId: string;
  /** The gym chosen already, if any: ticked, with Remove Gym. */
  current: GymPlace | null;
  onClose: () => void;
  onConfirm: (gym: GymPlace) => void;
  onRemove?: () => void;
  accentColor: string;
  onAccentColor: string;
  testID?: string;
}) {
  const searchable = gymSearchAvailable();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GymPlace[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [nearby, setNearby] = useState<NearbyState>({ status: 'idle' });
  const [here, setHere] = useState<Coordinates | null>(null);
  const [recent, setRecent] = useState<GymPlace[]>([]);
  const [chosen, setChosen] = useState<GymPlace | null>(current);
  const latestSearch = useRef(0);

  // Fresh each time it opens: the gym chosen, and the gyms trained at lately.
  useEffect(() => {
    if (!visible) return;
    setChosen(current);
    setQuery('');
    setResults(null);
    let live = true;
    fetchRecentGyms(userId)
      .then((gyms) => {
        if (live) setRecent(gyms);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [visible, userId, current]);

  // Apple Maps, searched as it's typed -- only the latest search's answer kept.
  useEffect(() => {
    const typed = query.trim();
    if (!searchable || typed.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    const ticket = ++latestSearch.current;
    setSearching(true);
    const timer = setTimeout(() => {
      searchGyms(typed, here)
        .then((gyms) => {
          if (ticket !== latestSearch.current) return;
          setResults(gyms);
          setSearchFailed(false);
        })
        .catch(() => {
          if (ticket !== latestSearch.current) return;
          setResults([]);
          setSearchFailed(true);
        })
        .finally(() => {
          if (ticket === latestSearch.current) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, here, searchable]);

  async function findNearby() {
    setNearby({ status: 'locating' });
    const position = await phonePosition();
    if (position.status !== 'found') {
      setNearby({ status: position.status });
      return;
    }
    setHere(position.coordinates);
    try {
      setNearby({ status: 'found', gyms: await nearbyGyms(position.coordinates) });
    } catch {
      setNearby({ status: 'failed' });
    }
  }

  const typed = query.trim();
  const shown: { title: string; key: string; gyms: GymPlace[] }[] = [];
  if (typed.length >= 2 && results) {
    shown.push({ title: 'Results', key: 'results', gyms: results });
  } else {
    if (nearby.status === 'found' && nearby.gyms.length > 0) {
      shown.push({ title: 'Near You', key: 'nearby', gyms: nearby.gyms });
    }
    if (recent.length > 0) shown.push({ title: 'Recent', key: 'recent', gyms: recent });
  }
  // What's listed, on the map too: a dozen at most.
  const onMap = shown
    .flatMap((group) => group.gyms)
    .filter((gym) => gym.latitude !== null && gym.longitude !== null)
    .slice(0, 12);
  const focus = chosen && chosen.latitude !== null ? chosen : (onMap[0] ?? null);
  // What's typed, as the gym's own name: where Apple Maps isn't there, or has nothing for it.
  const typedGym: GymPlace | null =
    typed.length >= 2 && (!searchable || (results !== null && results.length === 0))
      ? { name: typed.slice(0, 120), address: '', latitude: null, longitude: null }
      : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View testID={testID} style={styles.page}>
        <AppHeader
          title="Choose Your Gym"
          safeArea={false}
          rightAction={{
            icon: 'x',
            onPress: onClose,
            accessibilityLabel: 'Close',
            testID: `${testID}-close`,
          }}
        />
        <ScrollView
          contentContainerStyle={styles.content}
          // Scrolling puts the keyboard away, so it never covers the gyms.
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            testID={`${testID}-search`}
            placeholder={searchable ? 'Search gyms by name or area' : "Your gym's name"}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="words"
            returnKeyType="search"
            leftAccessory={<Feather name="search" size={18} color={colors.textMuted} />}
            accessibilityLabel={searchable ? 'Search gyms' : "Your gym's name"}
          />

          {searchable && typed.length < 2 ? (
            <View style={styles.nearby}>
              {nearby.status === 'idle' || nearby.status === 'locating' ? (
                <SecondaryButton
                  testID={`${testID}-nearby`}
                  label="Find Gyms Near Me"
                  icon="navigation"
                  size="md"
                  loading={nearby.status === 'locating'}
                  onPress={() => void findNearby()}
                />
              ) : null}
              {nearby.status === 'denied' ? (
                <View testID={`${testID}-denied`} style={styles.notice}>
                  <Text style={styles.noticeText}>
                    Location is off for Progresso, so search for your gym by name -- or allow it in
                    iPhone Settings to find gyms near you.
                  </Text>
                  <TextButton
                    testID={`${testID}-settings`}
                    label="Open iPhone Settings"
                    onPress={() => void Linking.openSettings()}
                  />
                </View>
              ) : null}
              {nearby.status === 'unavailable' || nearby.status === 'failed' ? (
                <Text testID={`${testID}-nearby-failed`} style={styles.noticeText}>
                  {"Couldn't find where you are right now. Search for your gym by name instead."}
                </Text>
              ) : null}
              {nearby.status === 'found' && nearby.gyms.length === 0 ? (
                <Text testID={`${testID}-nearby-none`} style={styles.noticeText}>
                  No gyms found near you. Search for yours by name instead.
                </Text>
              ) : null}
            </View>
          ) : null}

          {!searchable ? (
            <Text testID={`${testID}-no-maps`} style={styles.noticeText}>
              Searching Apple Maps for gyms needs an iPhone. Type your gym&apos;s name to use it.
            </Text>
          ) : null}

          {onMap.length > 0 && focus && focus.latitude !== null && focus.longitude !== null ? (
            <View style={styles.mapWrap}>
              <MapView
                testID={`${testID}-map`}
                style={styles.map}
                region={{
                  latitude: focus.latitude,
                  longitude: focus.longitude,
                  latitudeDelta: 0.04,
                  longitudeDelta: 0.04,
                }}
                showsUserLocation={here !== null}
                pitchEnabled={false}
                rotateEnabled={false}
                accessibilityLabel="Map of the gyms found"
              >
                {onMap.map((gym, index) => (
                  <Marker
                    key={`${gym.name}-${index}`}
                    coordinate={{ latitude: gym.latitude!, longitude: gym.longitude! }}
                    title={gym.name}
                    description={gym.address}
                    pinColor={chosen && sameGym(chosen, gym) ? accentColor : colors.textMuted}
                    onPress={() => setChosen(gym)}
                  />
                ))}
              </MapView>
            </View>
          ) : null}

          {searching ? <ActivityIndicator style={styles.spinner} color={accentColor} /> : null}

          {shown.map((group) => (
            <View key={group.key} style={styles.group} testID={`${testID}-${group.key}`}>
              <SectionHeader label={group.title} />
              <AppCard style={styles.list}>
                {group.gyms.map((gym, index) => (
                  <GymRow
                    key={`${gym.name}-${gym.address}-${index}`}
                    testID={`${testID}-${group.key}-${index}`}
                    gym={gym}
                    chosen={chosen !== null && sameGym(chosen, gym)}
                    onPress={() => setChosen(gym)}
                    divider={index > 0}
                    accentColor={accentColor}
                  />
                ))}
              </AppCard>
            </View>
          ))}

          {typed.length >= 2 && results !== null && results.length === 0 && searchable ? (
            <Text testID={`${testID}-none`} style={styles.noticeText}>
              {searchFailed
                ? "Couldn't reach Apple Maps just now."
                : `No gyms found for "${typed}".`}
            </Text>
          ) : null}

          {typedGym ? (
            <AppCard style={styles.list}>
              <TouchableOpacity
                testID={`${testID}-typed`}
                style={styles.row}
                onPress={() => setChosen(typedGym)}
                accessibilityRole="button"
                accessibilityLabel={`Use ${typedGym.name} as your gym`}
              >
                <Feather name="edit-3" size={18} color={accentColor} />
                <View style={styles.rowWords}>
                  <Text style={styles.rowName}>{`Use "${typedGym.name}"`}</Text>
                  <Text style={styles.rowAddress}>Saved by its name</Text>
                </View>
                <Feather
                  name={chosen && sameGym(chosen, typedGym) ? 'check-circle' : 'circle'}
                  size={22}
                  color={chosen && sameGym(chosen, typedGym) ? accentColor : colors.textMuted}
                />
              </TouchableOpacity>
            </AppCard>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {chosen ? (
            <View
              testID={`${testID}-chosen`}
              style={[styles.chosen, { backgroundColor: withAlpha(accentColor, 0.1) }]}
            >
              <Feather name="map-pin" size={16} color={accentColor} />
              <Text style={styles.chosenText} numberOfLines={1}>
                {chosen.name}
              </Text>
            </View>
          ) : null}
          <PrimaryButton
            testID={`${testID}-confirm`}
            label="Confirm Gym"
            disabled={!chosen}
            onPress={() => chosen && onConfirm(chosen)}
            accentColor={accentColor}
            onAccentColor={onAccentColor}
          />
          {current && onRemove ? (
            <TextButton
              testID={`${testID}-remove`}
              label="Remove Gym"
              destructive
              onPress={onRemove}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.md,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  nearby: {
    gap: spacing.sm,
  },
  notice: {
    gap: spacing.xs,
  },
  noticeText: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  mapWrap: {
    height: 180,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  map: {
    flex: 1,
  },
  spinner: {
    marginVertical: spacing.sm,
  },
  group: {
    gap: spacing.xs,
  },
  list: {
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget + 8,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowWords: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowName: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  rowAddress: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  distance: {
    ...typeScale.caption,
    fontFamily: fonts.mono,
    color: colors.textSecondaryBright,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  chosen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chosenText: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    flex: 1,
  },
});
