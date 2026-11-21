import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AnimatedBar } from '../design/AnimatedBar';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { EmptyState } from '../design/EmptyState';
import { Screen } from '../design/Screen';
import { SkeletonRows } from '../design/Skeleton';
import { Text } from '../design/Text';
import type { RootStackParamList } from '../navigation/types';
import { useFoodLog } from '../nutrition/FoodLogProvider';
import { dayLabel, isTodayKey, shiftDay, weekOfLabel } from '../nutrition/logDay';
import { dayLine, overUpperLimit, weekLine } from '../nutrition/micronutrients/display';
import { MoreText } from '../nutrition/micronutrients/MoreText';
import {
  DRI_PAGES,
  DRI_SOURCE_KEY,
  NUTRIENT_SOURCES,
} from '../nutrition/micronutrients/nutrientCatalog.generated';
import {
  formatAmount,
  nutrientById,
  unitWithBasis,
  type NutrientId,
} from '../nutrition/micronutrients/nutrients';
import type {
  NutrientDefinition,
  NutrientExplanation,
} from '../nutrition/micronutrients/nutrientTypes';
import { useReferenceChoices } from '../nutrition/micronutrients/referenceSettings';
import {
  lifeStageLabel,
  notesFor,
  referencePersonFor,
  referenceRowFor,
  referenceTypeName,
  upperLimitNotes,
  valueNotes,
} from '../nutrition/micronutrients/referenceValues';
import { TopicHeader } from '../nutrition/micronutrients/TopicHeader';
import { useWeekLogs } from '../nutrition/micronutrients/useWeekLogs';
import { WeekBars } from '../nutrition/micronutrients/WeekBars';
import { nutrientWeekDays, weekOf } from '../nutrition/micronutrients/weekTracker';
import { useDayLogs } from '../nutrition/useDayLogs';
import { dayFromKey } from '../lib/dayKey';
import { useProfile } from '../profile/ProfileProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
import { micronutrientsStyles as styles } from './micronutrientsStyles';

type Props = NativeStackScreenProps<RootStackParamList, 'NutrientDetail'>;

/** Where food amounts come from, cited on every page. */
const FOOD_DATA_SOURCES = [
  {
    key: 'usda',
    publisher: 'U.S. Department of Agriculture',
    title: 'FoodData Central',
    url: 'https://fdc.nal.usda.gov/',
  },
  {
    key: 'off',
    publisher: 'Open Food Facts contributors (ODbL)',
    title: 'Open Food Facts',
    url: 'https://world.openfoodfacts.org/',
  },
];

/**
 * One nutrient's page (explicitly requested): the day's intake against the person's reference
 * value -- or the week's average -- the week day by day, and the foods it's from; then what it
 * does, what too little and too much can do, the recommendation for their life stage and the
 * upper limit apart from it, and every source, each a link. Each topic leads with its own heading
 * (TopicHeader) and says its first sentence, the rest a tap away (MoreText) -- nothing the source
 * says is cut. All of it comes from the catalogue (supabase/nutrients): a section with no source
 * that could be read says so instead of saying anything.
 */
export function NutrientDetailScreen({ navigation, route }: Props) {
  const { nutrientId, day, range } = route.params;
  const nutrient = nutrientById(nutrientId);
  const { user } = useAuth();
  const userId = user?.id;
  const { profile } = useProfile();
  const { nutritionTheme } = useProgressTheme();
  const accent = nutritionTheme.accent;
  const { choices } = useReferenceChoices(userId);
  const { person, missing } = referencePersonFor(profile, choices);

  const isToday = isTodayKey(day);
  const todayLog = useFoodLog();
  const pastLog = useDayLogs(userId, range === 'day' && !isToday ? day : null, navigation);
  const dayLogs = isToday ? todayLog.logs : pastLog.day === day ? pastLog.logs : null;
  // The week the day is in: its days, and Week's average.
  const weekRead = useWeekLogs(userId, day, navigation);

  const header = (
    <AppHeader
      title={nutrient?.name ?? 'Nutrient'}
      leftAction={{
        icon: 'arrow-left',
        onPress: () => navigation.goBack(),
        accessibilityLabel: 'Back',
        testID: 'nutrient-detail-back',
      }}
    />
  );
  if (!nutrient) {
    return (
      <Screen header={header}>
        <EmptyState testID="nutrient-detail-unknown" title="This nutrient isn’t tracked" />
      </Screen>
    );
  }

  const row = referenceRowFor(nutrient.id, person);
  const unit = unitWithBasis(nutrient);
  const ready = range === 'day' ? dayLogs !== null : weekRead.logs !== null;
  const entry =
    range === 'day'
      ? dayLine(nutrient, dayLogs ?? [], row)
      : weekLine(nutrient, weekRead.logs ?? [], row);
  const nothingLogged =
    range === 'day' ? dayLogs?.length === 0 : weekRead.logs?.every((logs) => logs.length === 0);
  const when =
    range === 'day'
      ? isToday
        ? 'Today'
        : dayLabel(day)
      : `${weekOfLabel(shiftDay(day, -dayFromKey(day).getDay()))} · daily average`;

  // The week day by day -- the day shown (and today) as this page has them, the rest as read.
  const week = weekOf(day, weekRead.days, weekRead.logs).map((weekDay) =>
    weekDay.key === day && dayLogs
      ? { ...weekDay, logs: dayLogs }
      : isTodayKey(weekDay.key) && !todayLog.loading
        ? { ...weekDay, logs: todayLog.logs }
        : weekDay,
  );
  const weekDays = nutrientWeekDays(nutrient, week, row);
  const hasTarget = row?.value != null && !nutrient.guidance;

  // The day's foods and their part in it: those with a figure, most first, then those without.
  const id = nutrient.id as NutrientId;
  const withData = (dayLogs ?? [])
    .filter((log) => log.micronutrients?.[id] !== undefined)
    .sort((a, b) => (b.micronutrients![id] ?? 0) - (a.micronutrients![id] ?? 0));
  const withoutData = (dayLogs ?? []).filter((log) => log.micronutrients?.[id] === undefined);

  const sourceKeys = new Set<string>([DRI_SOURCE_KEY[nutrient.driPage]]);
  for (const part of [nutrient.about.does, nutrient.about.low, nutrient.about.high]) {
    for (const key of part?.sources ?? []) sourceKeys.add(key);
  }
  const ulNotes = upperLimitNotes(nutrient);
  const over = range === 'day' && overUpperLimit(nutrient, row, entry.amount);

  return (
    <Screen
      scrollTestID="nutrient-detail-scroll"
      contentContainerStyle={styles.content}
      header={header}
    >
      {/* Today's intake (or the week's average) against the recommendation. */}
      <AppCard hero testID="nutrient-detail-intake">
        <View style={styles.sectionGap}>
          <Text style={styles.dateCaption}>{when}</Text>
          {!ready ? (
            <SkeletonRows testID="nutrient-detail-loading" count={1} />
          ) : (
            <>
              <View style={styles.figureRow}>
                <Text testID="nutrient-detail-amount" style={styles.figureValue}>
                  {nothingLogged || entry.amount === null ? '—' : formatAmount(entry.amount)}
                </Text>
                <Text style={styles.figureOf}>
                  {row?.value != null ? `of ${formatAmount(row.value)} ${unit}` : unit}
                </Text>
              </View>
              {entry.fraction !== null && !nothingLogged ? (
                <AnimatedBar
                  testID="nutrient-detail-bar"
                  fraction={entry.fraction}
                  color={accent}
                  height={8}
                />
              ) : null}
              <Text testID="nutrient-detail-caption" style={styles.rowCaption}>
                {nothingLogged
                  ? range === 'day'
                    ? 'Nothing logged on this day'
                    : 'Nothing logged this week yet'
                  : entry.longCaption}
              </Text>
              {entry.coverage && !nothingLogged ? (
                <Text testID="nutrient-detail-coverage" style={styles.rowQuiet}>
                  From {entry.coverage}
                </Text>
              ) : null}
              {nutrient.note ? <Text style={styles.quiet}>{nutrient.note}</Text> : null}
            </>
          )}
        </View>
      </AppCard>

      {/* The week, day by day, against the target. */}
      {hasTarget ? (
        <AppCard testID="nutrient-detail-week">
          <View style={styles.sectionGap}>
            <TopicHeader
              icon="calendar"
              title="This Week"
              detail={`Each day against ${formatAmount(row!.value!)} ${unit}`}
              accentColor={accent}
            />
            {weekRead.logs === null && !weekRead.error ? (
              <SkeletonRows testID="nutrient-detail-week-loading" count={1} />
            ) : (
              <WeekBars
                testID="nutrient-detail-week-bars"
                height={72}
                accentColor={accent}
                days={weekDays.map((weekDay) => ({
                  key: weekDay.key,
                  letter: weekDay.letter,
                  fraction: weekDay.fraction,
                  label: weekDay.future
                    ? null
                    : weekDay.percent !== null
                      ? `${weekDay.percent}%`
                      : '—',
                  muted: weekDay.future,
                  selected: weekDay.key === day,
                  accessibilityLabel: `${dayLabel(weekDay.key)}: ${
                    weekDay.future
                      ? 'ahead'
                      : weekDay.percent !== null
                        ? `${weekDay.percent}%`
                        : weekDay.logged
                          ? 'no data'
                          : 'nothing logged'
                  }`,
                }))}
              />
            )}
          </View>
        </AppCard>
      ) : null}

      {range === 'day' && (withData.length > 0 || withoutData.length > 0) ? (
        <AppCard testID="nutrient-detail-foods">
          <View style={styles.sectionGap}>
            <TopicHeader icon="list" title="From Your Foods" accentColor={accent} />
            <View>
              {withData.map((log) => (
                <View key={log.id} style={styles.foodRow}>
                  <Text style={styles.foodName} numberOfLines={1}>
                    {log.foodNameSnapshot}
                  </Text>
                  <Text style={styles.foodAmount}>
                    {formatAmount(log.micronutrients![id]!)} {unit}
                  </Text>
                </View>
              ))}
            </View>
            {withoutData.length > 0 ? (
              <Text testID="nutrient-detail-foods-missing" style={styles.quiet}>
                No data, so not counted: {withoutData.map((log) => log.foodNameSnapshot).join(', ')}
              </Text>
            ) : null}
          </View>
        </AppCard>
      ) : null}

      {/* What it does, and what too little and too much can do. */}
      <Explanation
        testID="nutrient-detail-does"
        icon="zap"
        title="What It Does"
        part={nutrient.about.does}
        accentColor={accent}
      />
      <Explanation
        testID="nutrient-detail-low"
        icon="arrow-down-circle"
        title="Too Little"
        part={nutrient.about.low}
        footer="A low day isn’t a deficiency — only a health care provider can say."
        accentColor={accent}
      />
      <Explanation
        testID="nutrient-detail-high"
        icon="arrow-up-circle"
        title="Too Much"
        part={nutrient.about.high}
        fallback={row && row.ul === null ? ulNotes : undefined}
        accentColor={accent}
      />

      {/* The recommendation for their life stage. */}
      <AppCard testID="nutrient-detail-recommendation">
        <View style={styles.sectionGap}>
          <TopicHeader icon="target" title="Your Daily Target" accentColor={accent} />
          <Recommendation nutrient={nutrient} row={row} missing={missing} />
        </View>
      </AppCard>

      {/* The upper limit, apart from it. */}
      {nutrient.guidance ? null : (
        <AppCard testID="nutrient-detail-upper-limit">
          <View style={styles.sectionGap}>
            <TopicHeader icon="shield" title="Upper Limit" accentColor={accent} />
            {row === null ? (
              <Text style={styles.body}>Shown once your target can be.</Text>
            ) : row.ul !== null ? (
              <>
                <Text testID="nutrient-detail-ul" style={styles.limitValue}>
                  {formatAmount(row.ul)} {unit} per day
                  {row.ulIu != null ? ` (${formatAmount(row.ulIu)} IU)` : ''}
                </Text>
                <Text style={styles.body}>
                  {nutrient.ulOnlySupplements
                    ? 'A safety limit for supplements, not food — never a daily goal.'
                    : 'A safety limit, not a daily goal.'}
                </Text>
                {over ? (
                  <Text testID="nutrient-detail-over" style={styles.body}>
                    Today’s logged total is above this level.
                  </Text>
                ) : null}
                <MoreText
                  testID="nutrient-detail-ul-notes"
                  paragraphs={notesFor(nutrient.footnotes.ul)}
                  style={styles.quiet}
                  label="Health Canada’s notes"
                />
              </>
            ) : (
              <>
                <Text testID="nutrient-detail-ul" style={styles.body}>
                  Health Canada hasn’t set an upper limit.
                </Text>
                <MoreText
                  testID="nutrient-detail-ul-notes"
                  paragraphs={ulNotes}
                  style={styles.quiet}
                  label="Health Canada’s notes"
                />
              </>
            )}
            {row?.cdrr != null ? (
              <>
                <Text testID="nutrient-detail-cdrr" style={styles.limitValue}>
                  {formatAmount(row.cdrr)} {unit} per day
                </Text>
                <Text style={styles.body}>Chronic Disease Risk Reduction intake</Text>
                <MoreText
                  testID="nutrient-detail-cdrr-notes"
                  paragraphs={notesFor(nutrient.footnotes.cdrr)}
                  style={styles.quiet}
                  label="Health Canada’s notes"
                />
              </>
            ) : null}
          </View>
        </AppCard>
      )}

      {/* Every source, each a link. */}
      <AppCard testID="nutrient-detail-sources">
        <View style={styles.sectionGap}>
          <TopicHeader icon="book-open" title="Sources" accentColor={accent} />
          {[...sourceKeys].map((key) => {
            const source = NUTRIENT_SOURCES[key];
            if (!source) return null;
            const page = Object.values(DRI_PAGES).find((p) => p.url === source.url);
            const meta = page
              ? `${source.publisher} · updated ${page.dateModified}`
              : source.reviewed
                ? `${source.publisher} · reviewed ${source.reviewed}`
                : source.publisher;
            return (
              <SourceLink
                key={key}
                testID={`nutrient-detail-source-${key}`}
                title={source.title}
                meta={meta}
                url={source.url}
              />
            );
          })}
          {FOOD_DATA_SOURCES.map((source) => (
            <SourceLink
              key={source.key}
              testID={`nutrient-detail-source-${source.key}`}
              title={source.title}
              meta={`${source.publisher} · food amounts`}
              url={source.url}
            />
          ))}
          <Text style={styles.quiet}>A guide for healthy people — not medical advice.</Text>
        </View>
      </AppCard>
    </Screen>
  );
}

/** One of What It Does / Too Little / Too Much: its words and their sources, or that there are none. */
function Explanation({
  title,
  icon,
  part,
  fallback,
  footer,
  accentColor,
  testID,
}: {
  title: string;
  icon: Parameters<typeof TopicHeader>[0]['icon'];
  part: NutrientExplanation | null;
  /** Health Canada's own words to show when there's no explanation (why there's no upper limit). */
  fallback?: string[];
  footer?: string;
  accentColor: string;
  testID: string;
}) {
  return (
    <AppCard testID={testID}>
      <View style={styles.sectionGap}>
        <TopicHeader icon={icon} title={title} accentColor={accentColor} />
        {part ? (
          <MoreText testID={`${testID}-text`} paragraphs={[part.text]} style={styles.body} />
        ) : fallback && fallback.length > 0 ? (
          <MoreText testID={`${testID}-text`} paragraphs={fallback} style={styles.body} />
        ) : (
          <Text testID={`${testID}-unavailable`} style={styles.quiet}>
            No reliable source to explain this yet, so we won’t guess.
          </Text>
        )}
        {part && footer ? <Text style={styles.quiet}>{footer}</Text> : null}
      </View>
    </AppCard>
  );
}

/** The person's recommendation: the value, what kind it is, who it's for, and Health Canada's notes. */
function Recommendation({
  nutrient,
  row,
  missing,
}: {
  nutrient: NutrientDefinition;
  row: ReturnType<typeof referenceRowFor>;
  missing: string[];
}) {
  if (nutrient.guidance) {
    return (
      <>
        <Text testID="nutrient-detail-guidance" style={styles.limitValue}>
          {nutrient.guidance}
        </Text>
        <Text style={styles.quiet}>Health Canada’s guidance — there’s no daily amount.</Text>
      </>
    );
  }
  if (row === null || row.value === null || row.type === null) {
    return (
      <Text testID="nutrient-detail-no-recommendation" style={styles.body}>
        {missing.includes('age')
          ? 'Add your birthday to your profile to see your target.'
          : missing.includes('sex')
            ? 'Choose your reference values on the Micronutrients page to see your target.'
            : 'Health Canada hasn’t set a value for this life stage.'}
      </Text>
    );
  }
  const unit = unitWithBasis(nutrient);
  return (
    <>
      <Text testID="nutrient-detail-recommended" style={styles.limitValue}>
        {formatAmount(row.value)} {unit} per day
        {row.valueIu != null ? ` (${formatAmount(row.valueIu)} IU)` : ''}
      </Text>
      <Text style={styles.body}>
        {referenceTypeName(row.type)} for {lifeStageLabel(row)}
      </Text>
      <MoreText
        testID="nutrient-detail-value-notes"
        paragraphs={valueNotes(nutrient, row)}
        style={styles.quiet}
        label="Health Canada’s notes"
      />
    </>
  );
}

function SourceLink({
  title,
  meta,
  url,
  testID,
}: {
  title: string;
  meta: string;
  url: string;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={`${title}, ${meta}. Opens the source.`}
      onPress={() => void WebBrowser.openBrowserAsync(url)}
      style={styles.source}
    >
      <Text style={styles.sourceTitle}>{title}</Text>
      <Text style={styles.sourceMeta}>{meta}</Text>
    </Pressable>
  );
}
