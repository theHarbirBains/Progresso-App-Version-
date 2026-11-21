import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import { useAppTheme } from '../theme/appThemeContext';
import { RankEmblem } from './RankEmblem';
import { DIVISIONS, TIERS } from './ranks';

interface Point {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
}

const POINTS: Point[] = [
  {
    icon: 'star',
    title: 'Earn Achievement Points',
    body: 'Every achievement pays Achievement Points (AP). Most have levels: each one takes more than the last and pays more. They come from finishing workouts, setting records, the weight you move for each muscle, the weeks you train and your friends -- and, with Nutrition in your membership, logging what you eat.',
  },
  {
    icon: 'trending-up',
    title: 'Climb nine ranks',
    body: `Your AP sets your rank, from Bronze to Legacy. Each rank has five divisions, from ${DIVISIONS[0]} up to ${DIVISIONS[DIVISIONS.length - 1]}, and Legacy keeps going past Legacy I.`,
  },
  {
    icon: 'shield',
    title: 'Earned from what you log',
    body: 'There are no seasons and nothing wears off, and a week you miss costs you nothing -- weeks trained count in total, not in a row. Your AP always matches what you’ve logged: delete a workout or fix one logged wrong, and any level it no longer reaches is taken back.',
  },
  {
    icon: 'eye',
    title: 'Show how far you’ve come',
    body: 'Anyone who opens your profile sees your rank, unless you hide it in Settings > Account & Security. Friends who follow you see the achievements behind it too.',
  },
];

/**
 * How Progresso's ranks work, plainly: Achievement Points from achievements, the nine ranks and
 * their divisions (each rank's emblem in a row, its name in its colour), that it's earned from
 * what's logged -- nothing wears off, but a level is taken back once what's logged no longer
 * reaches it -- and who sees it. Onboarding's own step, and the top of the Ranks page. Content only --
 * the caller gives it its frame.
 */
export function RankExplainer({ testID }: { testID?: string }) {
  const { accent } = useAppTheme();
  return (
    <View testID={testID} style={styles.root}>
      <View
        style={styles.emblems}
        accessible
        accessibilityLabel={`The nine ranks, lowest first: ${TIERS.map((tier) => tier.name).join(', ')}`}
      >
        {TIERS.map((tier, tierIndex) => (
          <RankEmblem
            key={tier.id}
            tierIndex={tierIndex}
            divisionIndex={0}
            size={30}
            showDivision={false}
          />
        ))}
      </View>
      <Text style={styles.ladder} accessible={false}>
        {TIERS.map((tier, index) => (
          <Fragment key={tier.id}>
            {index > 0 ? <Text style={styles.arrow}>{' › '}</Text> : null}
            <Text style={{ color: tier.palette.primary }}>{tier.name}</Text>
          </Fragment>
        ))}
      </Text>

      {POINTS.map((point) => (
        <View key={point.title} style={styles.point}>
          <Feather name={point.icon} size={18} color={accent.accent} style={styles.pointIcon} />
          <View style={styles.pointText}>
            <Text style={styles.pointTitle}>{point.title}</Text>
            <Text style={styles.pointBody}>{point.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.lg,
  },
  emblems: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ladder: {
    ...typeScale.label,
    textAlign: 'center',
    marginTop: -spacing.sm,
  },
  arrow: {
    color: colors.textMuted,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  pointIcon: {
    marginTop: 2,
  },
  pointText: {
    flex: 1,
    gap: spacing.xs,
  },
  pointTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  pointBody: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
  },
});
