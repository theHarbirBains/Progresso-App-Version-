import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { EmptyState } from '../design/EmptyState';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { Text } from '../design/Text';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';
import { UnderlineTabs } from '../design/UnderlineTabs';
import { BUILTIN_GUIDES } from '../exercises/illustrations/builtinGuides.generated';
import { ExercisePhases, MuscleFigures } from '../exercises/illustrations/ExerciseIllustration';
import type { RootStackScreenProps } from '../navigation/types';
import { CheckLine, ExerciseThumb, programPartStyles } from '../programs/ProgramParts';
import {
  exerciseInfo,
  prescription,
  programById,
  restLabel,
  variationById,
} from '../programs/programs';
import type { ProgramExercise } from '../programs/programTypes';
import { withAlpha } from '../theme/accentColor';
import { useAppTheme } from '../theme/appThemeContext';

type Props = RootStackScreenProps<'ProgramExercise'>;
type Tab = 'instructions' | 'alternatives' | 'tips';

/**
 * A built-in exercise as a program shows it, all from the app's own catalogue (it works before
 * there's an account): its three phases, its name, the muscles it works and its equipment; from a
 * program's day, the sets and reps planned, the rest and the program's note; then **Instructions**
 * (its setup, the movement and the way back, numbered, and the muscles on the anatomy figure),
 * **Alternatives** (the program's stand-ins, each opening its own page) and **Tips** (the
 * program's own, then the exercise's Key Tips).
 */
export function ProgramExerciseScreen({ navigation, route }: Props) {
  const { accent } = useAppTheme();
  const { slug, programId, variationId, dayIndex, exerciseIndex } = route.params;
  const info = exerciseInfo(slug);
  const guide = BUILTIN_GUIDES[slug];
  const program = programById(programId);
  const planned: ProgramExercise | undefined =
    program && dayIndex !== undefined && exerciseIndex !== undefined
      ? variationById(program, variationId).days[dayIndex]?.exercises[exerciseIndex]
      : undefined;
  const alternatives = planned?.alternatives ?? [];
  const [tab, setTab] = useState<Tab>('instructions');

  if (!info) {
    return (
      <Screen header={<AppHeader title="Exercise" onBack={() => navigation.goBack()} />}>
        <EmptyState
          testID="program-exercise-missing"
          title="This exercise isn't here"
          description="It may have been taken out of the library."
        />
      </Screen>
    );
  }

  const tabs: { key: Tab; label: string; icon: 'list' | 'repeat' | 'star' }[] = [
    { key: 'instructions', label: 'Instructions', icon: 'list' },
    ...(planned
      ? [{ key: 'alternatives' as const, label: 'Alternatives', icon: 'repeat' as const }]
      : []),
    { key: 'tips', label: 'Tips', icon: 'star' },
  ];
  const programTips = planned?.tips ?? [];

  return (
    <Screen
      testID="program-exercise"
      header={<AppHeader title={info.name} onBack={() => navigation.goBack()} />}
    >
      <AppCard hero>
        <View style={[styles.phases, { backgroundColor: withAlpha(accent.accent, 0.06) }]}>
          <ExercisePhases slug={slug} accent={accent.accent} testID="program-exercise-phases" />
        </View>
        <Text style={styles.name}>{info.name}</Text>
        <View style={styles.chips}>
          {[info.muscle, ...info.alsoWorks, info.equipment].map((chip, i) => (
            <View key={`${chip}-${i}`} style={programPartStyles.tag}>
              <Text style={programPartStyles.tagText}>{chip}</Text>
            </View>
          ))}
        </View>
      </AppCard>

      {planned ? (
        <AppCard testID="program-exercise-plan" style={styles.rows}>
          <ListRow icon="layers" title="Planned" subtitle={prescription(planned)} />
          {planned.restSeconds ? (
            <ListRow
              icon="clock"
              title="Rest"
              subtitle={restLabel(planned.restSeconds).replace('Rest ', '')}
              divider
            />
          ) : null}
          {planned.note ? (
            <ListRow icon="edit-3" title="Note" subtitle={planned.note} divider />
          ) : null}
        </AppCard>
      ) : null}

      <UnderlineTabs
        testID="program-exercise-tabs"
        categories={tabs}
        active={tab}
        onSelect={setTab}
        accentColor={accent.accent}
      />

      {tab === 'instructions' ? (
        <>
          {guide ? (
            <View style={styles.steps}>
              {guide.rows.map((row, i) => (
                <AppCard key={i} testID={`program-exercise-step-${i}`}>
                  <View style={styles.step}>
                    <View style={[styles.stepNumber, { borderColor: accent.accent }]}>
                      <Text style={[styles.stepNumberText, { color: accent.accent }]}>{i + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{row}</Text>
                  </View>
                </AppCard>
              ))}
            </View>
          ) : null}
          <SectionHeader label="Muscles Worked" />
          <AppCard>
            <MuscleFigures slug={slug} testID="program-exercise-muscles" />
          </AppCard>
        </>
      ) : null}

      {tab === 'alternatives' ? (
        alternatives.length > 0 ? (
          <AppCard style={styles.rows}>
            {alternatives.map((alternative, i) => {
              const alt = exerciseInfo(alternative);
              return (
                <ListRow
                  key={alternative}
                  testID={`program-exercise-alternative-${alternative}`}
                  leading={<ExerciseThumb slug={alternative} />}
                  title={alt?.name ?? alternative}
                  subtitle={alt ? `${alt.muscle} · ${alt.equipment}` : undefined}
                  divider={i > 0}
                  onPress={() => navigation.push('ProgramExercise', { slug: alternative })}
                />
              );
            })}
          </AppCard>
        ) : (
          <EmptyState
            testID="program-exercise-no-alternatives"
            title="No alternatives listed"
            description="This program keeps this exercise as it is."
          />
        )
      ) : null}

      {tab === 'tips' ? (
        <>
          {programTips.length > 0 ? (
            <>
              <SectionHeader label="From the Program" />
              <AppCard testID="program-exercise-program-tips" style={styles.tips}>
                {programTips.map((tip) => (
                  <CheckLine key={tip} text={tip} />
                ))}
              </AppCard>
            </>
          ) : null}
          {guide && guide.tips.length > 0 ? (
            <>
              <SectionHeader label="Key Tips" />
              <AppCard testID="program-exercise-key-tips" style={styles.tips}>
                {guide.tips.map((tip) => (
                  <CheckLine key={tip} text={tip} />
                ))}
              </AppCard>
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  phases: {
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.lg,
  },
  name: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  rows: {
    paddingVertical: spacing.xs,
  },
  steps: {
    gap: spacing.sm,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    ...typeScale.label,
    fontFamily: fonts.monoBold,
  },
  stepText: {
    ...typeScale.callout,
    color: colors.textSecondaryBright,
    flex: 1,
  },
  tips: {
    gap: spacing.md,
  },
});
