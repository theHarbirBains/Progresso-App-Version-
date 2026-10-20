import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import type { FoodInput } from './foodQueries';

interface Props {
  /** The food AI Food Search worked out, with its figures and where they came from. */
  input: FoodInput;
  busy: boolean;
  error: string | null;
  accentColor: string;
  onAccentColor: string;
  /** With the figures as they now are, and whether the person changed any of them. */
  onContinue: (input: FoodInput, adjusted: boolean) => void;
  onBack: () => void;
}

const FIGURES = [
  { key: 'calories', label: 'Calories', testID: 'ai-adjust-calories' },
  { key: 'proteinG', label: 'Protein (g)', testID: 'ai-adjust-protein' },
  { key: 'carbsG', label: 'Carbs (g)', testID: 'ai-adjust-carbs' },
  { key: 'fatG', label: 'Fat (g)', testID: 'ai-adjust-fat' },
] as const;

type FigureKey = (typeof FIGURES)[number]['key'];

function sourceText(input: FoodInput): string {
  switch (input.provenance?.confidence) {
    case 'verified':
      return 'From Progresso food data (verified).';
    case 'calculated':
      return 'Worked out from Progresso food data (calculated).';
    case 'ai_estimate':
      return 'Includes an AI estimate, not verified. Check the numbers against the label if you have it.';
    default:
      return '';
  }
}

/**
 * The step between AI Food Search's result and the diary: the food's name and its calories,
 * protein, carbs and fat for the amount described, each editable before anything is saved.
 * Where the figures came from is said above them; once one is changed, they're the person's
 * own ("Adjusted by you") and saved that way. The amount itself is set on the next step, the
 * same log step every other way of logging uses.
 */
export function AiFoodAdjustStep({
  input,
  busy,
  error,
  accentColor,
  onAccentColor,
  onContinue,
  onBack,
}: Props) {
  const [name, setName] = useState(input.name);
  const [figures, setFigures] = useState<Record<FigureKey, string>>({
    calories: String(Math.round(input.calories)),
    proteinG: String(Math.round(input.proteinG * 10) / 10),
    carbsG: String(Math.round(input.carbsG * 10) / 10),
    fatG: String(Math.round(input.fatG * 10) / 10),
  });

  const parsed = Object.fromEntries(
    FIGURES.map(({ key }) => [key, Number(figures[key])]),
  ) as Record<FigureKey, number>;
  const invalid = FIGURES.filter(
    ({ key }) => figures[key].trim() === '' || !Number.isFinite(parsed[key]) || parsed[key] < 0,
  ).map(({ key }) => key);
  const adjusted = FIGURES.some(
    ({ key }) =>
      Math.abs(parsed[key] - (key === 'calories' ? Math.round(input[key]) : input[key])) > 0.05,
  );
  const canContinue = name.trim().length > 0 && invalid.length === 0 && !busy;

  return (
    <Screen
      keyboardAvoiding
      contentContainerStyle={styles.content}
      header={<AppHeader title="Check the Numbers" onBack={onBack} testID="ai-adjust-header" />}
    >
      <AppCard>
        <Section title="Food">
          <View style={styles.group}>
            <TextInput testID="ai-adjust-name" label="Name" value={name} onChangeText={setName} />
            <Text testID="ai-adjust-serving" style={styles.serving}>
              For {input.servingSize} {input.servingUnit}. You set how much you had next.
            </Text>
          </View>
        </Section>
      </AppCard>

      <AppCard>
        <Section title="Nutrition">
          <View style={styles.group}>
            <Text testID="ai-adjust-source" style={styles.source}>
              {adjusted ? 'Adjusted by you.' : sourceText(input)}
            </Text>
            {FIGURES.map(({ key, label, testID }) => (
              <TextInput
                key={key}
                testID={testID}
                label={label}
                keyboardType="decimal-pad"
                value={figures[key]}
                onChangeText={(text) => setFigures((prev) => ({ ...prev, [key]: text }))}
                error={invalid.includes(key) ? 'Enter a number, 0 or more' : undefined}
              />
            ))}
          </View>
        </Section>
      </AppCard>

      {error ? (
        <Text testID="ai-adjust-error" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <PrimaryButton
        testID="ai-adjust-continue"
        label="Continue"
        loading={busy}
        disabled={!canContinue && !busy}
        onPress={() =>
          onContinue(
            {
              ...input,
              name: name.trim(),
              calories: parsed.calories,
              proteinG: parsed.proteinG,
              carbsG: parsed.carbsG,
              fatG: parsed.fatG,
            },
            adjusted,
          )
        }
        accentColor={accentColor}
        onAccentColor={onAccentColor}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: widgetGap,
  },
  group: {
    gap: spacing.lg,
  },
  serving: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  source: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
