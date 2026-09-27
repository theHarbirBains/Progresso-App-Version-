import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { TextInput } from '../design/TextInput';
import { colors, radii, spacing, typeScale } from '../design/theme';
import { COUNTRIES, countryFlagEmoji, type Country } from './countries';

interface Props {
  testID: string;
  value: string | null;
  onChange: (code: string) => void;
}

// A virtualized (FlatList) search-and-select country picker -- rendered in
// its own plain View by OnboardingScreen, not the outer ScrollView, same
// reasoning as the wheel-picker steps (a FlatList nested inside a
// same-orientation ScrollView trips React Native's own warning and its
// real windowing cost). ~195 countries, alphabetical, filtered by name as
// the user types; no image assets -- each flag is the two-letter code's
// own Unicode regional-indicator glyph (see countries.ts).
export function CountryStep({ testID, value, onChange }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [query]);

  function renderItem({ item }: { item: Country }) {
    const selected = item.code === value;
    return (
      <TouchableOpacity
        testID={`${testID}-option-${item.code}`}
        style={[styles.row, selected && { borderColor: colors.accent }]}
        onPress={() => onChange(item.code)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        <Text style={styles.flag}>{countryFlagEmoji(item.code)}</Text>
        <Text style={styles.name}>{item.name}</Text>
        {selected ? <Feather name="check" size={18} color={colors.accent} /> : null}
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
      <FlatList
        testID={`${testID}-list`}
        data={filtered}
        keyExtractor={(item) => item.code}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  flag: {
    fontSize: 22,
  },
  name: {
    ...typeScale.callout,
    color: colors.textPrimary,
    flex: 1,
  },
});
