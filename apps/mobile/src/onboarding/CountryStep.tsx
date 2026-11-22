import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { AppCard } from '../design/AppCard';
import { TextInput } from '../design/TextInput';
import { colors, radii, spacing, typeScale } from '../design/theme';
import { withAlpha } from '../theme/accentColor';
import { COUNTRIES, countryFlagEmoji, type Country } from './countries';
import { useAppTheme } from '../theme/appThemeContext';

interface Props {
  testID: string;
  value: string | null;
  onChange: (code: string) => void;
  /** The country the phone is in (Find your country), shown first in the list. */
  located?: string | null;
}

// A virtualized (FlatList) search-and-select country picker -- rendered in
// its own plain View by OnboardingScreen, not the outer ScrollView, same
// reasoning as the wheel-picker steps (a FlatList nested inside a
// same-orientation ScrollView trips React Native's own warning and its
// real windowing cost). ~195 countries, alphabetical, filtered by name as
// the user types; no image assets -- each flag is the two-letter code's
// own Unicode regional-indicator glyph (see countries.ts). The list is one
// widget; the country the phone is in, when Find your country found it,
// comes first, marked "Your location".
export function CountryStep({ testID, value, onChange, located = null }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = q ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(q)) : COUNTRIES;
    const here = located ? matching.find((c) => c.code === located) : undefined;
    return here ? [here, ...matching.filter((c) => c !== here)] : matching;
  }, [query, located]);

  const accent = useAppTheme().accent.accent;

  function renderItem({ item, index }: { item: Country; index: number }) {
    const selected = item.code === value;
    const isHere = item.code === located;
    return (
      <TouchableOpacity
        testID={`${testID}-option-${item.code}`}
        style={[
          styles.row,
          index > 0 && styles.divided,
          selected && { backgroundColor: withAlpha(accent, 0.14) },
        ]}
        onPress={() => onChange(item.code)}
        accessibilityRole="button"
        accessibilityLabel={isHere ? `${item.name}, your location` : item.name}
        accessibilityState={{ selected }}
      >
        <Text style={styles.flag}>{countryFlagEmoji(item.code)}</Text>
        <View style={styles.nameColumn}>
          <Text style={[styles.name, selected && { color: accent }]}>{item.name}</Text>
          {isHere ? (
            <View testID={`${testID}-located`} style={styles.here}>
              <Feather name="map-pin" size={11} color={accent} />
              <Text style={[styles.hereText, { color: accent }]}>Your location</Text>
            </View>
          ) : null}
        </View>
        {selected ? <Feather name="check" size={18} color={accent} /> : null}
      </TouchableOpacity>
    );
  }

  return (
    <View testID={testID} style={styles.container}>
      <TextInput
        testID={`${testID}-search`}
        placeholder="Search country..."
        value={query}
        onChangeText={setQuery}
        accessibilityLabel="Search country"
      />
      <AppCard style={styles.card}>
        <FlatList
          testID={`${testID}-list`}
          data={filtered}
          keyExtractor={(item) => item.code}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
        />
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    flex: 1,
    marginTop: spacing.md,
    padding: 0,
    overflow: 'hidden',
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
  },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  flag: {
    fontSize: 22,
  },
  nameColumn: {
    flex: 1,
  },
  name: {
    ...typeScale.callout,
    color: colors.textPrimary,
  },
  here: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  hereText: {
    ...typeScale.caption,
  },
});
