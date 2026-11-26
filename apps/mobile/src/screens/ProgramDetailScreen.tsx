import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { FilterChips } from '../design/FilterChips';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { SegmentedControl } from '../design/SegmentedControl';
import { Text } from '../design/Text';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';
import { UnderlineTabs } from '../design/UnderlineTabs';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgramHost } from '../programs/programHost';
import { meets, needLabel, variationNeeds } from '../programs/homeEquipment';
import { ProgramFigure } from '../programs/ProgramFigure';
import {
  Badge,
  CheckLine,
  InfoNote,
  ProgramExerciseList,
  programPartStyles,
} from '../programs/ProgramParts';
import {
  daysLabel,
  equipmentLabel,
  focusSummary,
  GUIDANCE_TOPICS,
  levelsLabel,
  musclesText,
  programById,
  schedulesOf,
  styleLabel,
  variationById,
  variationLabel,
  variationMuscles,
  variationsOn,
} from '../programs/programs';
import { withAlpha } from '../theme/accentColor';
import { useAppTheme } from '../theme/appThemeContext';

type Props = RootStackScreenProps<'ProgramDetail'>;
type Tab = 'overview' | 'schedule' | 'workouts' | 'guidance';

const TABS: { key: Tab; label: string; icon: 'info' | 'calendar' | 'list' | 'compass' }[] = [
  { key: 'overview', label: 'Overview', icon: 'info' },
  { key: 'schedule', label: 'Schedule', icon: 'calendar' },
  { key: 'workouts', label: 'Workouts', icon: 'list' },
  { key: 'guidance', label: 'Guidance', icon: 'compass' },
];

/**
 * One program, as four tabs under its name: **Overview** (its figure, badge, name, days and style,
 * tags and Use Program; what it is; how often and who for; the muscles each day trains; why choose
 * it), **Schedule** (its schedules to switch between, the variation on it, each day to open, and
 * its note), **Workouts** (each day's exercises, a day at a time) and **Guidance** (progression,
 * volume and recovery, exercise selection, and its variations). The variation shown is the
 * route's, so it holds when coming back; Use Program uses that one.
 */
export function ProgramDetailScreen({ navigation, route }: Props) {
  const host = useProgramHost();
  const { accent } = useAppTheme();
  const program = programById(route.params.programId);
  const [tab, setTab] = useState<Tab>(route.params.tab ?? 'overview');
  const [dayIndex, setDayIndex] = useState(0);
  const [using, setUsing] = useState(false);

  if (!program) {
    return (
      <Screen header={<AppHeader title="Program" onBack={() => navigation.goBack()} />}>
        <EmptyState
          testID="program-detail-missing"
          title="This program isn't here"
          description="It may have been taken out of the library."
        />
      </Screen>
    );
  }

  const variation = variationById(program, route.params.variationId);
  const schedules = schedulesOf(program);
  const onSchedule = variationsOn(program, variation.schedule);
  const day = variation.days[Math.min(dayIndex, variation.days.length - 1)]!;
  const chosen = host.chosen?.programId === program.id && host.chosen.variationId === variation.id;
  // A home program: the equipment its exercises need, and which of it they haven't said they have.
  const home = program.setting === 'home';
  const owned = host.preferences.homeEquipment;
  const needs = home ? variationNeeds(variation) : [];
  const lacking = owned.length > 0 ? needs.filter((need) => !meets(need, owned)) : [];

  function showVariation(variationId: string) {
    navigation.setParams({ variationId });
    setDayIndex(0);
  }

  async function applyProgram() {
    setUsing(true);
    try {
      const splitId = await host.use({ programId: program!.id, variationId: variation.id });
      navigation.navigate('ProgramAdded', {
        programId: program!.id,
        variationId: variation.id,
        splitId,
      });
    } catch (err) {
      Alert.alert(
        "The program couldn't be added",
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setUsing(false);
    }
  }

  function confirmUse() {
    if (host.mode === 'onboarding') {
      void applyProgram();
      return;
    }
    Alert.alert(
      `Use ${program!.name}?`,
      'It becomes a split of your own and your active split. Your other splits, workouts and records stay as they are.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Use Program', onPress: () => void applyProgram() },
      ],
    );
  }

  const useButton = chosen ? (
    <SecondaryButton
      testID="program-detail-chosen"
      label="Chosen"
      icon="check"
      onPress={() => host.finish?.()}
    />
  ) : (
    <PrimaryButton
      testID="program-detail-use"
      label="Use Program"
      icon="plus-circle"
      loading={using}
      onPress={confirmUse}
      accentColor={accent.accent}
      onAccentColor={accent.onAccent}
    />
  );

  const openDay = (index: number) =>
    navigation.navigate('ProgramDay', {
      programId: program.id,
      variationId: variation.id,
      dayIndex: index,
    });

  return (
    <Screen
      testID="program-detail"
      header={<AppHeader title={program.name} onBack={() => navigation.goBack()} />}
    >
      <UnderlineTabs
        testID="program-detail-tabs"
        categories={TABS}
        active={tab}
        onSelect={setTab}
        accentColor={accent.accent}
      />

      {tab === 'overview' ? (
        <>
          <AppCard hero testID="program-detail-hero">
            <View style={[styles.heroFigure, { backgroundColor: withAlpha(accent.accent, 0.08) }]}>
              <ProgramFigure groups={variationMuscles(variation)} height={150} />
            </View>
            {program.badge ? <Badge label={program.badge} /> : null}
            <Text style={styles.name}>{program.name}</Text>
            <Text style={styles.meta}>
              {[variation.schedule, variation.focus, styleLabel(variation)]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {program.tags && program.tags.length > 0 ? (
              <View style={styles.tags}>
                {program.tags.map((tag) => (
                  <View key={tag} style={programPartStyles.tag}>
                    <Text style={programPartStyles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.heroAction}>{useButton}</View>
          </AppCard>

          <SectionHeader label="Overview" />
          {program.description ? (
            <AppCard>
              <Text style={styles.body}>{program.description}</Text>
            </AppCard>
          ) : null}
          <AppCard style={styles.rows}>
            <ListRow
              icon="calendar"
              title="Frequency"
              subtitle={`${daysLabel(program)} per week`}
            />
            <ListRow
              icon="bar-chart-2"
              title="Experience"
              subtitle={levelsLabel(variation.levels)}
              divider
            />
            <ListRow
              testID="program-detail-equipment"
              icon="tool"
              title={home ? 'Equipment Needed' : 'Equipment'}
              subtitle={
                home
                  ? needs.length > 0
                    ? needs.map((need) => needLabel(need)).join(', ')
                    : 'No equipment'
                  : equipmentLabel(variation.equipment)
              }
              divider
            />
            {lacking.length > 0 ? (
              <ListRow
                testID="program-detail-equipment-missing"
                icon="alert-circle"
                title="You Don't Have"
                subtitle={`${lacking.map((need) => needLabel(need)).join(', ')} -- its exercises that need it are marked.`}
                divider
              />
            ) : null}
            {focusSummary(variation) ? (
              <ListRow
                testID="program-detail-focus"
                icon="crosshair"
                title="Focus"
                subtitle={focusSummary(variation)!}
                divider
              />
            ) : null}
          </AppCard>

          <SectionHeader label="Muscle Group Targets" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.targets}
          >
            {variation.days.map((target, i) => (
              <AppCard key={`${target.name}-${i}`} style={styles.target}>
                <ProgramFigure groups={target.muscleGroups} height={92} />
                <Text style={styles.targetName}>{target.name}</Text>
                <Text style={styles.targetMuscles}>{musclesText(target.muscleGroups)}</Text>
              </AppCard>
            ))}
          </ScrollView>

          {program.benefits && program.benefits.length > 0 ? (
            <>
              <SectionHeader label="Why Choose This Split?" />
              <AppCard style={styles.benefits}>
                {program.benefits.map((benefit) => (
                  <CheckLine key={benefit} text={benefit} />
                ))}
              </AppCard>
            </>
          ) : null}
        </>
      ) : null}

      {tab === 'schedule' ? (
        <>
          <SectionHeader label="Weekly Schedule" />
          {schedules.length > 1 ? (
            <SegmentedControl
              testID="program-detail-schedule"
              options={schedules.map((s) => ({
                value: s.schedule,
                label: s.note ? `${s.schedule} (${s.note})` : s.schedule,
              }))}
              value={variation.schedule}
              onChange={(schedule) => showVariation(variationsOn(program, schedule)[0]!.id)}
              accentColor={accent.accent}
              onAccentColor={accent.onAccent}
            />
          ) : null}
          {onSchedule.length > 1 ? (
            <AppCard style={styles.rows}>
              <ListRow
                testID="program-detail-variation"
                icon="sliders"
                title="Variation"
                value={variationLabel(variation)}
                onPress={() =>
                  navigation.navigate('ProgramVariations', {
                    programId: program.id,
                    variationId: variation.id,
                  })
                }
              />
            </AppCard>
          ) : null}
          {variation.days.map((scheduled, i) => (
            <AppCard
              key={`${scheduled.name}-${i}`}
              testID={`program-detail-day-${i}`}
              onPress={() => openDay(i)}
              accessibilityLabel={`Day ${i + 1}, ${scheduled.name}: ${musclesText(scheduled.muscleGroups)}`}
            >
              <View style={styles.dayRow}>
                <View
                  style={[styles.dayFigure, { backgroundColor: withAlpha(accent.accent, 0.08) }]}
                >
                  <ProgramFigure groups={scheduled.muscleGroups} height={58} sides="front" />
                </View>
                <View style={styles.dayText}>
                  <Text style={styles.dayNumber}>Day {i + 1}</Text>
                  <Text style={styles.dayName}>{scheduled.name}</Text>
                  <Text style={styles.dayMuscles}>{musclesText(scheduled.muscleGroups)}</Text>
                </View>
                <Text style={styles.dayCount}>
                  {scheduled.exercises.length}{' '}
                  {scheduled.exercises.length === 1 ? 'exercise' : 'exercises'}
                </Text>
              </View>
            </AppCard>
          ))}
          {variation.note ? <InfoNote testID="program-detail-note" text={variation.note} /> : null}
          {useButton}
        </>
      ) : null}

      {tab === 'workouts' ? (
        <>
          <FilterChips
            testID="program-detail-day"
            options={variation.days.map((d, i) => ({
              value: String(i),
              label: `Day ${i + 1} · ${d.name}`,
            }))}
            value={String(Math.min(dayIndex, variation.days.length - 1))}
            onChange={(value) => setDayIndex(Number(value))}
            accentColor={accent.accent}
            onAccentColor={accent.onAccent}
          />
          <View>
            <Text style={styles.workoutTitle}>
              Day {Math.min(dayIndex, variation.days.length - 1) + 1} — {day.name}
            </Text>
            <Text style={styles.workoutMuscles}>{musclesText(day.muscleGroups)}</Text>
          </View>
          <ProgramExerciseList
            testID="program-detail-exercise"
            day={day}
            owned={home ? owned : null}
            onOpen={(exerciseIndex) =>
              navigation.navigate('ProgramExercise', {
                slug: day.exercises[exerciseIndex]!.slug,
                programId: program.id,
                variationId: variation.id,
                dayIndex: Math.min(dayIndex, variation.days.length - 1),
                exerciseIndex,
              })
            }
          />
        </>
      ) : null}

      {tab === 'guidance' ? (
        <AppCard style={styles.rows}>
          {GUIDANCE_TOPICS.map((topic, i) => (
            <ListRow
              key={topic.topic}
              testID={`program-detail-guidance-${topic.topic}`}
              icon={topic.icon}
              title={topic.title}
              subtitle={topic.summary}
              divider={i > 0}
              onPress={() =>
                navigation.navigate('ProgramGuidance', {
                  programId: program.id,
                  topic: topic.topic,
                })
              }
            />
          ))}
          {program.variations.length > 1 ? (
            <ListRow
              testID="program-detail-guidance-variations"
              icon="git-branch"
              title="Program Variations"
              subtitle="Its schedules and focuses, and who each suits."
              divider
              onPress={() =>
                navigation.navigate('ProgramVariations', {
                  programId: program.id,
                  variationId: variation.id,
                })
              }
            />
          ) : null}
        </AppCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroFigure: {
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  name: {
    ...typeScale.display,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  meta: {
    ...typeScale.callout,
    color: colors.textSecondaryBright,
    marginTop: spacing.xs,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  heroAction: {
    marginTop: spacing.lg,
  },
  body: {
    ...typeScale.callout,
    color: colors.textSecondaryBright,
  },
  rows: {
    paddingVertical: spacing.xs,
  },
  targets: {
    gap: spacing.sm,
  },
  target: {
    width: 132,
    alignItems: 'center',
    gap: spacing.xs,
  },
  targetName: {
    ...typeScale.label,
    fontFamily: fonts.display,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  targetMuscles: {
    ...typeScale.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  benefits: {
    gap: spacing.md,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dayFigure: {
    width: 56,
    height: 68,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dayText: {
    flex: 1,
    gap: 2,
  },
  dayNumber: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  dayName: {
    ...typeScale.cardTitle,
    fontFamily: fonts.displayHeavy,
    color: colors.textPrimary,
  },
  dayMuscles: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
  },
  dayCount: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  workoutTitle: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  workoutMuscles: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
