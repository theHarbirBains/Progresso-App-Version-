import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AnimatedBar } from '../design/AnimatedBar';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { EmptyState } from '../design/EmptyState';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { SkeletonRows } from '../design/Skeleton';
import { Text } from '../design/Text';
import type { RootStackParamList } from '../navigation/types';
import { useFoodLog } from '../nutrition/FoodLogProvider';
import { dayLabel, isTodayKey, shiftDay, weekOfLabel } from '../nutrition/logDay';
import { dayLine, overUpperLimit, weekLine } from '../nutrition/micronutrients/display';
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
import { useWeekLogs } from '../nutrition/micronutrients/useWeekLogs';
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
 * value -- or the week's average -- and the foods it's from; then what it does, what too little and
 * too much can do, the recommendation for their life stage and the upper limit apart from it, and
 * every source, each a link. All of it comes from the catalogue (supabase/nutrients): a section
 * with no source that could be read says so instead of saying anything.
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
  const week = useWeekLogs(userId, range === 'week' ? day : null, navigation);

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
  const ready = range === 'day' ? dayLogs !== null : week.logs !== null;
  const entry =
    range === 'day'
      ? dayLine(nutrient, dayLogs ?? [], row)
      : weekLine(nutrient, week.logs ?? [], row);
  const nothingLogged =
    range === 'day' ? dayLogs?.length === 0 : week.logs?.every((logs) => logs.length === 0);
  const when =
    range === 'day'
      ? isToday
        ? 'Today'
        : dayLabel(day)
      : `${weekOfLabel(shiftDay(day, -dayFromKey(day).getDay()))} · daily average`;

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
      {/* A. Today's intake (or the week's average) against the recommendation. */}
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
                  : entry.caption}
              </Text>
              {entry.coverage && !nothingLogged ? (
                <Text testID="nutrient-detail-coverage" style={styles.rowQuiet}>
                  {entry.coverage}
                </Text>
              ) : null}
              {nutrient.note ? <Text style={styles.quiet}>{nutrient.note}</Text> : null}
            </>
          )}
        </View>
      </AppCard>

      {range === 'day' && (withData.length > 0 || withoutData.length > 0) ? (
        <AppCard testID="nutrient-detail-foods">
          <SectionHeader label="From your foods" />
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
          {withoutData.length > 0 ? (
            <Text testID="nutrient-detail-foods-missing" style={[styles.quiet, styles.spacedTop]}>
              No {nutrient.name.toLowerCase()} data for{' '}
              {withoutData.map((log) => log.foodNameSnapshot).join(', ')} — not counted, rather than
              counted as none.
            </Text>
          ) : null}
        </AppCard>
      ) : null}

      {/* B, C and D: what it does, and what too little and too much can do. */}
      <Explanation testID="nutrient-detail-does" title="What it does" part={nutrient.about.does} />
      <Explanation
        testID="nutrient-detail-low"
        title="When intake is too low"
        part={nutrient.about.low}
        footer="A day below the recommendation doesn’t mean a deficiency — only a health care provider can tell you that."
      />
      <Explanation
        testID="nutrient-detail-high"
        title="When intake is too high"
        part={nutrient.about.high}
        fallback={row && row.ul === null ? ulNotes : undefined}
      />

      {/* E. The recommendation for their life stage. */}
      <AppCard testID="nutrient-detail-recommendation">
        <View style={styles.sectionGap}>
          <SectionHeader label="Recommended intake" />
          <Recommendation nutrient={nutrient} row={row} missing={missing} />
        </View>
      </AppCard>

      {/* F. The upper limit, apart from it. */}
      {nutrient.guidance ? null : (
        <AppCard testID="nutrient-detail-upper-limit">
          <View style={styles.sectionGap}>
            <SectionHeader label="Upper limit" />
            {row === null ? (
              <Text style={styles.body}>Shown once your recommendation can be.</Text>
            ) : row.ul !== null ? (
              <>
                <Text testID="nutrient-detail-ul" style={styles.limitValue}>
                  {formatAmount(row.ul)} {unit} per day
                  {row.ulIu != null ? ` (${formatAmount(row.ulIu)} IU)` : ''}
                </Text>
                <Text style={styles.body}>This is a safety limit, not a daily goal.</Text>
                {notesFor(nutrient.footnotes.ul).map((note) => (
                  <Text key={note} style={styles.quiet}>
                    {note}
                  </Text>
                ))}
                {over ? (
                  <Text testID="nutrient-detail-over" style={styles.body}>
                    Today’s logged total is above this level.
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Text testID="nutrient-detail-ul" style={styles.body}>
                  Health Canada hasn’t set an upper limit.
                </Text>
                {ulNotes.map((note) => (
                  <Text key={note} style={styles.quiet}>
                    {note}
                  </Text>
                ))}
              </>
            )}
            {row?.cdrr != null ? (
              <>
                <Text testID="nutrient-detail-cdrr" style={styles.limitValue}>
                  {formatAmount(row.cdrr)} {unit} per day
                </Text>
                <Text style={styles.body}>Chronic Disease Risk Reduction intake</Text>
                {notesFor(nutrient.footnotes.cdrr).map((note) => (
                  <Text key={note} style={styles.quiet}>
                    {note}
                  </Text>
                ))}
              </>
            ) : null}
          </View>
        </AppCard>
      )}

      {/* G. Every source, each a link. */}
      <AppCard testID="nutrient-detail-sources">
        <View style={styles.sectionGap}>
          <SectionHeader label="Sources" />
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
        </View>
      </AppCard>
    </Screen>
  );
}

/** One of What it does / Too low / Too high: the words and their sources, or that there are none. */
function Explanation({
  title,
  part,
  fallback,
  footer,
  testID,
}: {
  title: string;
  part: NutrientExplanation | null;
  /** Health Canada's own words to show when there's no explanation (why there's no upper limit). */
  fallback?: string[];
  footer?: string;
  testID: string;
}) {
  return (
    <AppCard testID={testID}>
      <View style={styles.sectionGap}>
        <SectionHeader label={title} />
        {part ? (
          <Text style={styles.body}>{part.text}</Text>
        ) : fallback && fallback.length > 0 ? (
          fallback.map((note) => (
            <Text key={note} style={styles.body}>
              {note}
            </Text>
          ))
        ) : (
          <Text testID={`${testID}-unavailable`} style={styles.quiet}>
            We couldn’t find a reliable source to explain this yet, so we’d rather not guess.
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
        <Text style={styles.quiet}>
          Health Canada sets no daily amount for it — this is its guidance for everyone.
        </Text>
      </>
    );
  }
  if (row === null || row.value === null || row.type === null) {
    return (
      <Text testID="nutrient-detail-no-recommendation" style={styles.body}>
        {missing.includes('age')
          ? 'Add your birthday to your profile to see the recommendation for your age.'
          : missing.includes('sex')
            ? 'Choose your reference values on the Micronutrients page to see your recommendation.'
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
      {valueNotes(nutrient, row).map((note) => (
        <Text key={note} style={styles.quiet}>
          {note}
        </Text>
      ))}
      <Text style={styles.quiet}>
        A reference for healthy people, not a medical prescription. Health conditions and medicines
        can change what you need.
      </Text>
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
