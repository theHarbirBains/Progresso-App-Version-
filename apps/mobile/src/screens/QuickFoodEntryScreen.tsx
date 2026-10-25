import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { Toggle } from '../design/Toggle';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { useFoodLog } from '../nutrition/FoodLogProvider';
import { dayLabel, isPastKey } from '../nutrition/logDay';
import { defaultMealTypeForTime } from '../nutrition/mealTypes';
import { useProgressTheme } from '../progress/useProgressTheme';

type Props = RootStackScreenProps<'QuickFoodEntry'>;

type Field = 'calories' | 'proteinG' | 'carbsG' | 'fatG';

const FIELDS: { key: Field; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'cal' },
  { key: 'proteinG', label: 'Protein', unit: 'g' },
  { key: 'carbsG', label: 'Carbs', unit: 'g' },
  { key: 'fatG', label: 'Fat', unit: 'g' },
];

/** A typed figure: a number, zero or more; blank means zero, except for calories, which are needed. */
function figure(text: string, field: Field): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return field === 'calories' ? null : 0;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Quick Macro Entry: logging something by the figures the person already knows -- a name and its
 * calories, protein, carbs and fat -- without finding or making a food first. Logged to the day
 * the Nutrition screen showed (today, or the past day in route.params.day), as their own figures,
 * never as checked food data. Kept in the Food Library only when they tick Save to Food Library.
 */
export function QuickFoodEntryScreen({ navigation, route }: Props) {
  const day = route.params?.day;
  const { nutritionTheme } = useProgressTheme();
  const { logQuickEntry } = useFoodLog();
  const [name, setName] = useState('');
  const [values, setValues] = useState<Record<Field, string>>({
    calories: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
  });
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Object.fromEntries(FIELDS.map((f) => [f.key, figure(values[f.key], f.key)])) as {
    [K in Field]: number | null;
  };
  const nameMissing = name.trim() === '';
  const invalid = FIELDS.filter((f) => parsed[f.key] === null);

  async function handleLog() {
    if (saving) return;
    if (nameMissing || invalid.length > 0) {
      setShowErrors(true);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await logQuickEntry(
        {
          name: name.trim(),
          calories: parsed.calories!,
          proteinG: parsed.proteinG!,
          carbsG: parsed.carbsG!,
          fatG: parsed.fatG!,
        },
        defaultMealTypeForTime(),
        { day, saveToLibrary },
      );
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log that');
      setSaving(false);
    }
  }

  return (
    <Screen
      keyboardAvoiding
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          testID="quick-entry-header"
          title="Quick Macro Entry"
          subtitle={day && isPastKey(day) ? `For ${dayLabel(day)}` : undefined}
          onBack={() => navigation.goBack()}
        />
      }
    >
      <Section title="What did you eat?">
        <TextInput
          testID="quick-entry-name"
          label="Name or description"
          placeholder="e.g. Team lunch, protein bar"
          value={name}
          onChangeText={setName}
          error={showErrors && nameMissing ? 'Give it a name' : undefined}
          errorTestID="quick-entry-name-error"
        />
      </Section>

      <Section title="Its figures">
        <View style={styles.grid}>
          {FIELDS.map((f) => (
            <View key={f.key} style={styles.cell}>
              <TextInput
                testID={`quick-entry-${f.key}`}
                label={`${f.label} (${f.unit})`}
                placeholder="0"
                keyboardType="decimal-pad"
                value={values[f.key]}
                onChangeText={(text) => setValues((prev) => ({ ...prev, [f.key]: text }))}
                error={
                  showErrors && parsed[f.key] === null
                    ? f.key === 'calories' && values[f.key].trim() === ''
                      ? 'Needed'
                      : 'A number, 0 or more'
                    : undefined
                }
                errorTestID={`quick-entry-${f.key}-error`}
              />
            </View>
          ))}
        </View>
        <Text testID="quick-entry-note" style={styles.note}>
          These are your own figures. Progresso logs them as you typed them and doesn&apos;t check
          them against any food data.
        </Text>
      </Section>

      <Section title="Food Library">
        <ListRow
          testID="quick-entry-save-row"
          title="Save to Food Library"
          subtitle="Keep it as one of your foods, marked as figures you entered."
          trailing={
            <Toggle
              testID="quick-entry-save"
              value={saveToLibrary}
              onValueChange={setSaveToLibrary}
              accentColor={nutritionTheme.accent}
              accessibilityLabel="Save to Food Library"
            />
          }
        />
      </Section>

      {error ? (
        <Text testID="quick-entry-error" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <PrimaryButton
        testID="quick-entry-log"
        label="Log It"
        loading={saving}
        onPress={() => void handleLog()}
        accentColor={nutritionTheme.accent}
        onAccentColor={nutritionTheme.onAccent}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: widgetGap,
    paddingBottom: spacing.xxl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cell: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  note: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
