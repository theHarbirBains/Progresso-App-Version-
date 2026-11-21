import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
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
import { TopicHeader } from '../nutrition/micronutrients/TopicHeader';
import { useWeekLogs } from '../nutrition/micronutrients/useWeekLogs';
import { WeekBars } from '../nutrition/micronutrients/WeekBars';
import { nutrientWeekDays, weekOf, weekSummary } from '../nutrition/micronutrients/weekTracker';
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
/** Each kind's heading: its glyph and title. */
const CATEGORY_HEADINGS: Record<
  NutrientCategory,
  { icon: keyof typeof Feather.glyphMap; title: string }
> = {
  vitamin: { icon: 'sun', title: 'Vitamins' },
  mineral: { icon: 'hexagon', title: 'Minerals' },
  other: { icon: 'layers', title: 'Fibre & Fats' },
};
/** Every nutrient the week's tracker counts. */
const ALL_NUTRIENTS = [
  ...nutrientsIn('vitamin'),
  ...nutrientsIn('mineral'),
  ...nutrientsIn('other'),
];

function validDay(key: string | undefined): string {
  return key && /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : todayKey();
}

/**
 * Micronutrients (explicitly requested): the day's vitamins, minerals and the rest, each against
 * the reference value Health Canada sets for the person (referenceValues.ts), from the foods
 * logged that day -- or a week's averages over the days logged. Opened from the Nutrition screen
 * on the day it shows. The week's tracker says, for each day, how many nutrients reached their
 * reference value (a tap opens that day); each nutrient row opens its own page.
 *
 * Reads: the day's foods exactly as Nutrition does (today's from the shared food log, another
 * day's read for itself on every focus), and the week's for the tracker and Week (useWeekLogs).
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
  // Worked out once per profile and choice, so the week's tracker isn't counted again every render.
  const { person, missing } = useMemo(
    () => referencePersonFor(profile, reference.choices),
    [profile, reference.choices],
  );
  const sexFromProfile = profile?.gender === 'male' || profile?.gender === 'female';

  // The day's foods, as the Nutrition screen reads them.
  const isToday = isTodayKey(day);
  const todayLog = useFoodLog();
  const pastLog = useDayLogs(userId, isToday ? null : day, navigation);
  const pastReady = pastLog.day === day;
  const dayLogs = isToday ? todayLog.logs : pastReady ? pastLog.logs : null;
  const dayError = isToday ? todayLog.error : pastLog.error;
  const dayLoading = isToday ? todayLog.loading : !pastReady || pastLog.loading;

  // The week the day is in: its tracker, and Week's averages.
  const weekRead = useWeekLogs(userId, day, navigation);

  const step = (by: number) => setDay((current) => shiftDay(current, by));
  // Forward only as far as today: ahead of it is planning, which Nutrition shows on its own.
  const canStepForward = range === 'day' ? day < todayKey() : shiftDay(day, 7) <= todayKey();

  const loading =
    range === 'day' ? dayLoading || dayLogs === null : weekRead.logs === null && !weekRead.error;
  const error = range === 'day' ? dayError : weekRead.error;
  const nothingLogged =
    range === 'day' ? dayLogs?.length === 0 : weekRead.logs?.every((logs) => logs.length === 0);

  const referenceFor = (id: string) => referenceRowFor(id, person);
  const lines: NutrientLine[] = nutrientsIn(category).map((nutrient) => {
    const row = referenceFor(nutrient.id);
    if (range === 'week') return weekLine(nutrient, weekRead.logs ?? [], row);
    return dayLine(nutrient, dayLogs ?? [], row);
  });
  // The kind's heading says how many reached their reference value.
  const withTarget = lines.filter(
    (entry) => entry.reference?.value != null && !entry.nutrient.guidance,
  );
  const reachedCount = withTarget.filter((entry) => (entry.percent ?? 0) >= 100).length;

  // The tracker's week: the day shown (and today) as this page has them, the rest as read.
  const week = useMemo(() => {
    const read = weekOf(day, weekRead.days, weekRead.logs);
    return read.map((entry) =>
      entry.key === day && dayLogs
        ? { ...entry, logs: dayLogs }
        : isTodayKey(entry.key) && !todayLog.loading
          ? { ...entry, logs: todayLog.logs }
          : entry,
    );
  }, [day, weekRead.days, weekRead.logs, dayLogs, todayLog.logs, todayLog.loading]);
  const summary = useMemo(
    () => weekSummary(ALL_NUTRIENTS, week, (id) => referenceRowFor(id, person)),
    [week, person],
  );
  const tracked = summary[0]?.tracked ?? 0;

  const daysLogged = weekRead.logs?.filter((logs) => logs.length > 0).length ?? 0;
  const dateCaption = range === 'day' ? (isToday ? 'Today' : null) : 'Weekly average';
  const dateTitle =
    range === 'day' ? dayLabel(day) : weekOfLabel(shiftDay(day, -dayFromKey(day).getDay()));
  const coverage =
    range === 'day'
      ? dayLogs && dayLogs.length > 0
        ? `${dayLogs.length} ${dayLogs.length === 1 ? 'food' : 'foods'} logged`
        : null
      : weekRead.logs
        ? `${daysLogged} of ${weekRead.days.length} ${weekRead.days.length === 1 ? 'day' : 'days'} logged so far`
        : null;

  // Who the values are for, or what's needed to choose them.
  const groupLabel = referenceGroupLabel(person);
  const referenceRow = missing.includes('age') ? (
    <ListRow
      testID="micronutrients-reference-missing-age"
      icon="calendar"
      title="Add your birthday"
      subtitle="Targets depend on your age"
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
      icon="user"
      title={groupLabel ? `Recommendations for ${groupLabel}` : 'Your recommendations'}
      subtitle="Health Canada’s Dietary Reference Intakes"
      onPress={() => setSheetOpen(true)}
    />
  );

  const heading = CATEGORY_HEADINGS[category];

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

      {/* The week at a glance: each day, how many nutrients reached their target. */}
      <AppCard testID="micronutrients-week">
        <View style={styles.sectionGap}>
          <TopicHeader
            icon="calendar"
            title="This Week"
            detail={
              tracked > 0
                ? `Nutrients at target each day, of ${tracked}`
                : 'Add your details for targets'
            }
            accentColor={accent}
          />
          {weekRead.logs === null && !weekRead.error ? (
            <SkeletonRows testID="micronutrients-week-loading" count={1} />
          ) : (
            <WeekBars
              testID="micronutrients-week-bars"
              accentColor={accent}
              onPressDay={(key) => {
                setDay(key);
                setRange('day');
              }}
              days={summary.map((entry) => ({
                key: entry.key,
                letter: entry.letter,
                fraction: entry.logged && tracked > 0 ? entry.reached / tracked : null,
                label: entry.future ? null : entry.logged ? String(entry.reached) : '—',
                muted: entry.future,
                selected: range === 'day' && entry.key === day,
                accessibilityLabel: `${dayLabel(entry.key)}: ${
                  entry.future
                    ? 'ahead'
                    : entry.logged
                      ? `${entry.reached} of ${tracked} nutrients at target`
                      : 'nothing logged'
                }`,
              }))}
            />
          )}
        </View>
      </AppCard>

      <AppCard testID="micronutrients-reference-card">{referenceRow}</AppCard>

      <AppCard testID="micronutrients-list">
        <View style={styles.sectionGap}>
          <SegmentedControl
            testID="micronutrients-category"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={setCategory}
            accentColor={accent}
            onAccentColor={nutritionTheme.onAccent}
          />
          <TopicHeader
            testID="micronutrients-category-heading"
            icon={heading.icon}
            title={heading.title}
            detail={
              withTarget.length > 0 && !nothingLogged && !loading
                ? `${reachedCount} of ${withTarget.length} at target${range === 'week' ? ' on average' : ''}`
                : null
            }
            accentColor={accent}
          />
        </View>
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
                description="Log food and its vitamins and minerals add up here."
              />
            ) : null}
            {lines.map((entry, index) => (
              <NutrientRow
                key={entry.nutrient.id}
                entry={entry}
                week={
                  range === 'week'
                    ? nutrientWeekDays(entry.nutrient, week, entry.reference).map((d) => ({
                        key: d.key,
                        letter: d.letter,
                        fraction: d.fraction,
                        muted: d.future,
                        accessibilityLabel: `${dayLabel(d.key)}: ${d.percent === null ? 'no data' : `${d.percent}%`}`,
                      }))
                    : null
                }
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

      <Text testID="micronutrients-about" style={styles.footnote}>
        Health Canada’s reference values: a guide, not a diagnosis. Food data from USDA and Open
        Food Facts.
      </Text>

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
 * -- more isn't shown as a warning) -- in Week, the week's seven days as a slim strip -- then its
 * percentage and, when not every food had data, how many did. The whole row opens its page.
 */
function NutrientRow({
  entry,
  week,
  divider,
  accentColor,
  quiet,
  onPress,
}: {
  entry: NutrientLine;
  week: Parameters<typeof WeekBars>[0]['days'] | null;
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
      accessibilityLabel={[
        entry.name,
        entry.figure,
        quiet ? caption : entry.longCaption,
        entry.coverage,
      ]
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
      {week && !quiet && entry.fraction !== null ? (
        <WeekBars
          testID={`micronutrients-row-${id}-week`}
          days={week}
          height={14}
          compact
          accentColor={accentColor}
        />
      ) : entry.fraction !== null ? (
        <AnimatedBar
          testID={`micronutrients-row-${id}-bar`}
          fraction={entry.fraction}
          color={accentColor}
        />
      ) : null}
      <View style={styles.rowBottom}>
        <Text testID={`micronutrients-row-${id}-caption`} style={styles.rowCaption}>
          {caption}
        </Text>
        {entry.coverage && !quiet ? (
          <Text testID={`micronutrients-row-${id}-coverage`} style={styles.rowQuiet}>
            {entry.coverage}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
