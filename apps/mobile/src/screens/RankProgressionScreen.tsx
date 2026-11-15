import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { Screen } from '../design/Screen';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { useAchievements } from '../achievements/achievementsContext';
import { RankEmblem } from '../achievements/RankEmblem';
import { DIVISIONS, TIERS, divisionFloor, rankForPoints } from '../achievements/ranks';
import { rankProgressionStyles as styles } from './rankProgressionStyles';

type Props = RootStackScreenProps<'RankProgression'>;

/**
 * Every rank, Bronze to Legacy, each with its emblem, its AP range and its five divisions from V
 * to I -- yours (or, opened from someone's profile, theirs) marked, the ranks reached in their
 * colours and the rest faded. Ranks are lifetime: they're never lost.
 */
export function RankProgressionScreen({ route, navigation }: Props) {
  const own = useAchievements();
  const points = route.params?.points ?? own.points;
  const whose = route.params?.name;
  const rank = rankForPoints(points);

  return (
    <Screen
      scrollTestID="rank-progression-scroll"
      contentContainerStyle={styles.content}
      header={<AppHeader title="Ranks" onBack={() => navigation.goBack()} />}
    >
      <Text testID="rank-intro" style={styles.intro}>
        {whose ? `${whose} is ` : "You're "}
        <Text style={{ color: rank.tier.palette.primary }}>{rank.label}</Text> with{' '}
        {points.toLocaleString('en-US')} AP. Every achievement adds to it, and a rank is never lost.
      </Text>
      {TIERS.map((tier, tierIndex) => {
        const reached = rank.tierIndex >= tierIndex;
        const current = rank.tierIndex === tierIndex;
        const last = tierIndex === TIERS.length - 1;
        const upTo = last ? null : TIERS[tierIndex + 1]!.floor - 1;
        return (
          <AppCard key={tier.id} testID={`rank-tier-${tier.id}`} hero={current}>
            <View style={styles.tierHead}>
              <RankEmblem
                tierIndex={tierIndex}
                divisionIndex={current ? rank.divisionIndex : DIVISIONS.length - 1}
                showDivision={current}
                size={52}
                dim={!reached}
              />
              <View style={styles.tierText}>
                <Text
                  style={[
                    styles.tierName,
                    { color: reached ? tier.palette.primary : colors.textSecondary },
                  ]}
                >
                  {tier.name}
                </Text>
                <Text style={styles.tierRange}>
                  {upTo === null
                    ? `${tier.floor.toLocaleString('en-US')}+ AP`
                    : `${tier.floor.toLocaleString('en-US')}–${upTo.toLocaleString('en-US')} AP`}
                </Text>
              </View>
              {current ? (
                <Text testID="rank-here" style={[styles.here, { color: tier.palette.primary }]}>
                  {whose ? `${whose} is here` : "You're here"}
                </Text>
              ) : reached ? (
                <Feather name="check" size={18} color={tier.palette.primary} />
              ) : null}
            </View>
            <View style={styles.divisions}>
              {DIVISIONS.map((division, divisionIndex) => {
                const floor = divisionFloor(tierIndex, divisionIndex);
                const hit = points >= floor;
                const here = current && rank.divisionIndex === divisionIndex;
                return (
                  <View
                    key={division}
                    testID={`rank-${tier.id}-${division}`}
                    style={[
                      styles.division,
                      { borderColor: hit ? tier.palette.primary : colors.glassBorderStrong },
                      here && { backgroundColor: tier.palette.deep },
                    ]}
                    accessible
                    accessibilityLabel={`${tier.name} ${division}: from ${floor.toLocaleString('en-US')} AP${
                      here ? ', current' : hit ? ', reached' : ''
                    }`}
                  >
                    <Text
                      style={[
                        styles.divisionName,
                        { color: hit ? tier.palette.primary : colors.textMuted },
                      ]}
                    >
                      {division}
                    </Text>
                    <Text style={styles.divisionFloor}>{floor.toLocaleString('en-US')}</Text>
                  </View>
                );
              })}
            </View>
            {last ? (
              <Text style={styles.legacyNote}>
                Past Legacy I, every 2,000 AP is another Legacy level.
              </Text>
            ) : null}
          </AppCard>
        );
      })}
    </Screen>
  );
}
