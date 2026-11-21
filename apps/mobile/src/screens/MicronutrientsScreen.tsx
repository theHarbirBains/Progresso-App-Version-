import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AnimatedBar } from '../design/AnimatedBar';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { EmptyState } from '../design/EmptyState';
import { IconButton } from '../design/IconButton';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { SegmentedControl } from '../design/SegmentedControl';
import { SkeletonRows } from '../design/Skeleton';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import type { RootStackParamList } from '../navigation/types';
import { useFoodLog } from '../nutrition/FoodLogProvider';
import { dayLabel, isTodayKey, shiftDay, todayKey, weekOfLabel } from '../nutrition/logDay';
import { dayLine, weekLine, type NutrientLine } from '../nutrition/micronutrients/display';
import { nutrientsIn } from '../nutrition/micronutrients/nutrients';
import type { NutrientCategory } from '../nutrition/micronutrients/nutrientTypes';
import { ReferenceSheet } from '../nutrition/micronutrients/ReferenceSheet';
import { useReferenceChoices } from '../nutrition/micronutrients/referenceSettings';
import {
  referenceGroupLabel,
  referencePersonFor,
  referenceRowFor,
} from '../nutrition/micronutrients/referenceValues';
import { useWeekLogs } from '../nutrition/micronutrients/useWeekLogs';
import { useDayLogs } from '../nutrition/useDayLogs';
import { useProfile } from '../profile/ProfileProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
import { dayFromKey } from '../lib/dayKey';
import { micronutrientsStyles as styles } from './micronutrientsStyles';

type Props = NativeStackScreenProps<RootStackParamList, 'Micronutrients'>;

type Range = 'day' | 'week';

const RANGE_OPTIONS: { label: string; value: Range }[] = [
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
];
const CATEGORY_OPTIONS: { label: string; value: NutrientCategory }[] = [
  { label: 'Vitamins', value: 'vitamin' },
  { label: 'Minerals', value: 'mineral' },
  { label: 'Other', value: 'other' },
];

function validDay(key: string | undefined): string {
  return key && /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : todayKey();
}

/**
 * Micronutrients (explicitly requested): the day's vitamins, minerals and the rest, each against
 * the reference value Health Canada sets for the person (referenceValues.ts), from the foods
 * logged that day -- or a week's averages over the days logged. Opened from the Nutrition screen
 * on the day it shows. Each row opens its nutrient's page.
 *
 * Reads: the day's foods exactly as Nutrition does (today's from the shared food log, another
 * day's read for itself on every focus), and a week's when Week is chosen (useWeekLogs).
 */
export function MicronutrientsScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const userId = user?.id;
  const { profile } = useProfile();
  const { nutritionTheme } = useProgressTheme();
  const accent = nutritionTheme.accent;
  const [day, setDay] = useState(() => validDay(route.params?.day));
  const [range, setRange] = useState<Range>('day');
  const [category, setCategory] = useState<NutrientCategory>('vitamin');
  const [sheetOpen, setSheetOpen] = useState(false);

  const reference = useReferenceChoices(userId);
  const { person, missing } = referencePersonFor(profile, reference.choices);
  const sexFromProfile = profile?.gender === 'male' || profile?.gender === 'female';

  // The day's foods, as the Nutrition screen reads them.
  const isToday = isTodayKey(day);
  const todayLog = useFoodLog();
  const pastLog = useDayLogs(userId, isToday ? null : day, navigation);
  const pastReady = pastLog.day === day;
  const dayLogs = isToday ? todayLog.logs : pastReady ? pastLog.logs : null;
  const dayError = isToday ? todayLog.error : pastLog.error;
  const dayLoading = isToday ? todayLog.loading : !pastReady || pastLog.loading;

  const week = useWeekLogs(userId, range === 'week' ? day : null, navigation);

  const step = (by: number) => setDay((current) => shiftDay(current, by));
  // Forward only as far as today: ahead of it is planning, which Nutrition shows on its own.
  const canStepForward = range === 'day' ? day < todayKey() : shiftDay(day, 7) <= todayKey();

  const loading =
    range === 'day' ? dayLoading || dayLogs === null : week.logs === null && !week.error;
  const error = range === 'day' ? dayError : week.error;
  const nothingLogged =
    range === 'day' ? dayLogs?.length === 0 : week.logs?.every((logs) => logs.length === 0);

  const lines: NutrientLine[] = nutrientsIn(category).map((nutrient) => {
    const row = referenceRowFor(nutrient.id, person);
    if (range === 'week') return weekLine(nutrient, week.logs ?? [], row);
    return dayLine(nutrient, dayLogs ?? [], row);
  });

  const daysLogged = week.logs?.filter((logs) => logs.length > 0).length ?? 0;
  const dateCaption = range === 'day' ? (isToday ? 'Today' : null) : 'Weekly average';
  const dateTitle =
    range === 'day' ? dayLabel(day) : weekOfLabel(shiftDay(day, -dayFromKey(day).getDay()));
  const coverage =
    range === 'day'
      ? dayLogs && dayLogs.length > 0
        ? `${dayLogs.length} ${dayLogs.length === 1 ? 'food' : 'foods'} logged`
        : null
      : week.logs
        ? `${daysLogged} of ${week.days.length} ${week.days.length === 1 ? 'day' : 'days'} logged so far`
        : null;

  // Who the values are for, or what's needed to choose them.
  const groupLabel = referenceGroupLabel(person);
  const referenceRow = missing.includes('age') ? (
    <ListRow
      testID="micronutrients-reference-missing-age"
      icon="calendar"
      title="Add your birthday"
      subtitle="Recommendations depend on your age"
      onPress={() => navigation.navigate('SettingsPersonalInfo')}
    />
  ) : missing.includes('sex') ? (
    <ListRow
      testID="micronutrients-reference-missing-sex"
      icon="user"
      title="Choose your reference values"
      subtitle="Health Canada sets female and male values"
      onPress={() => setSheetOpen(true)}
    />
  ) : (
    <ListRow
      testID="micronutrients-reference"
      icon="info"
      title={groupLabel ? `Recommendations for ${groupLabel}` : 'Your recommendations'}
      subtitle="Health Canada’s Dietary Reference Intakes"
      onPress={() => setSheetOpen(true)}
    />
  );

  return (
    <Screen
      scrollTestID="micronutrients-scroll"
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          title="Micronutrients"
          leftAction={{
            icon: 'arrow-left',
            onPress: () => navigation.goBack(),
            accessibilityLabel: 'Back',
            testID: 'micronutrients-back',
          }}
        />
      }
    >
      <AppCard testID="micronutrients-when">
        <SegmentedControl
          testID="micronutrients-range"
          options={RANGE_OPTIONS}
          value={range}
          onChange={setRange}
          accentColor={accent}
          onAccentColor={nutritionTheme.onAccent}
        />
        <View style={styles.dateRow}>
          <IconButton
            testID="micronutrients-previous"
            icon="chevron-left"
            onPress={() => step(range === 'day' ? -1 : -7)}
            accessibilityLabel={range === 'day' ? 'Previous day' : 'Previous week'}
          />
          <View style={styles.dateText}>
            {dateCaption ? <Text style={styles.dateCaption}>{dateCaption}</Text> : null}
            <Text testID="micronutrients-date" style={styles.dateTitle}>
              {dateTitle}
            </Text>
            {coverage ? (
              <Text testID="micronutrients-coverage" style={styles.coverage}>
                {coverage}
              </Text>
            ) : null}
          </View>
          <IconButton
            testID="micronutrients-next"
            icon="chevron-right"
            onPress={() => step(range === 'day' ? 1 : 7)}
            disabled={!canStepForward}
            accessibilityLabel={range === 'day' ? 'Next day' : 'Next week'}
          />
        </View>
      </AppCard>

      <AppCard testID="micronutrients-reference-card">{referenceRow}</AppCard>

      <AppCard testID="micronutrients-list">
        <SegmentedControl
          testID="micronutrients-category"
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={setCategory}
          accentColor={accent}
          onAccentColor={nutritionTheme.onAccent}
        />
        {error ? (
          <Text testID="micronutrients-error" style={styles.errorText}>
            {error}
          </Text>
        ) : loading ? (
          <SkeletonRows testID="micronutrients-loading" count={5} />
        ) : (
          <>
            {nothingLogged ? (
              <EmptyState
                testID="micronutrients-empty"
                icon={<Feather name="droplet" size={22} color={colors.textMuted} />}
                title={
                  range === 'day' ? 'Nothing logged on this day' : 'Nothing logged this week yet'
                }
                description="Log food on the Nutrition page and its vitamins and minerals add up here."
              />
            ) : null}
            {lines.map((entry, index) => (
              <NutrientRow
                key={entry.nutrient.id}
                entry={entry}
                divider={index > 0}
                accentColor={accent}
                quiet={nothingLogged === true}
                onPress={() =>
                  navigation.navigate('NutrientDetail', {
                    nutrientId: entry.nutrient.id,
                    day,
                    range,
                  })
                }
              />
            ))}
          </>
        )}
      </AppCard>

      <AppCard testID="micronutrients-about">
        <View style={styles.sectionGap}>
          <Text style={styles.quiet}>
            These are Health Canada’s reference values for healthy people — a guide for a
            population, not a prescription. A day below one doesn’t mean a deficiency, and one above
            isn’t too much: the upper limit is on each nutrient’s page. Your log can be missing
            foods or nutrient data, and health conditions and medicines can change what you need.
          </Text>
          <Text style={styles.quiet}>
            Food data from USDA FoodData Central and product labels via Open Food Facts.
          </Text>
        </View>
      </AppCard>

      <ReferenceSheet
        visible={sheetOpen}
        person={person}
        sexFromProfile={sexFromProfile}
        choices={reference.choices}
        onChange={(next) => void reference.save(next)}
        onEditProfile={() => {
          setSheetOpen(false);
          navigation.navigate('SettingsPersonalInfo');
        }}
        onClose={() => setSheetOpen(false)}
        accentColor={accent}
        onAccentColor={nutritionTheme.onAccent}
      />
    </Screen>
  );
}

/**
 * One nutrient: its name and figures, a bar of the way to its reference value (stopping at full
 * -- more isn't shown as a warning), what that's a percentage of, and what part of the day's
 * foods it's from when not all of them. The whole row opens its page.
 */
function NutrientRow({
  entry,
  divider,
  accentColor,
  quiet,
  onPress,
}: {
  entry: NutrientLine;
  divider: boolean;
  accentColor: string;
  quiet: boolean;
  onPress: () => void;
}) {
  const id = entry.nutrient.id;
  const caption = quiet ? 'Nothing logged' : entry.caption;
  return (
    <Pressable
      testID={`micronutrients-row-${id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[entry.name, entry.figure, caption, entry.coverage]
        .filter(Boolean)
        .join(', ')}
      style={[styles.row, divider && styles.rowDivider]}
    >
      <View style={styles.rowTop}>
        <Text style={styles.rowName}>{entry.name}</Text>
        <View style={styles.rowRight}>
          <Text testID={`micronutrients-row-${id}-figure`} style={styles.rowFigure}>
            {entry.figure}
          </Text>
          <Feather name="chevron-right" size={16} color={colors.textMuted} />
        </View>
      </View>
      {entry.fraction !== null ? (
        <AnimatedBar
          testID={`micronutrients-row-${id}-bar`}
          fraction={entry.fraction}
          color={accentColor}
        />
      ) : null}
      <Text testID={`micronutrients-row-${id}-caption`} style={styles.rowCaption}>
        {caption}
      </Text>
      {entry.coverage && !quiet ? (
        <Text testID={`micronutrients-row-${id}-coverage`} style={styles.rowQuiet}>
          {entry.coverage}
        </Text>
      ) : null}
    </Pressable>
  );
}
