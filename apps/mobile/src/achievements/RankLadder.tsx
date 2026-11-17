import { StyleSheet, View } from 'react-native';
import { RiseIn, RiseInGroup } from '../design/RiseIn';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import { RankEmblem } from './RankEmblem';
import { TIERS } from './ranks';

// Each rung's height, and its emblem's size within it.
const RUNG_HEIGHT = 44;
const EMBLEM_SIZE = 32;
// The rail between emblems, faint so the emblems carry the colour.
const RAIL_WIDTH = 2;
const RAIL_OPACITY = 0.35;

/**
 * The nine ranks as a ladder to climb: Bronze at its foot ("You start here"), Legacy at its top,
 * each rung the tier's emblem (no division numeral), its name in its own colour and the
 * Achievement Points it starts at. A thin rail joins the emblems, each half in its tier's colour,
 * so the colours run up the ladder. The rungs rise in from the foot up, like every page's
 * widgets (RiseIn -- they simply appear under Reduce Motion). One element to VoiceOver, read
 * lowest first. Onboarding's How ranks work step.
 */
export function RankLadder({ testID }: { testID?: string }) {
  const last = TIERS.length - 1;
  return (
    <View
      testID={testID}
      style={styles.ladder}
      accessible
      accessibilityLabel={`The nine ranks, from where you start: ${TIERS.map(
        (tier) => `${tier.name}, from ${tier.floor.toLocaleString('en-US')} AP`,
      ).join('; ')}.`}
    >
      {/* Bronze first, at the foot: the column runs bottom up, so the rungs rise in that order too. */}
      <RiseInGroup>
        {TIERS.map((tier, index) => (
          <RiseIn key={tier.id}>
            <View testID={testID ? `${testID}-${tier.id}` : undefined} style={styles.rung}>
              <View style={styles.emblemColumn}>
                {index < last ? (
                  <View
                    style={[styles.rail, styles.railUp, { backgroundColor: tier.palette.primary }]}
                  />
                ) : null}
                {index > 0 ? (
                  <View
                    style={[
                      styles.rail,
                      styles.railDown,
                      { backgroundColor: tier.palette.primary },
                    ]}
                  />
                ) : null}
                <RankEmblem tierIndex={index} size={EMBLEM_SIZE} showDivision={false} />
              </View>
              <View style={styles.nameColumn}>
                <Text style={[styles.name, { color: tier.palette.primary }]}>{tier.name}</Text>
                {index === 0 ? <Text style={styles.start}>You start here</Text> : null}
              </View>
              <Text style={styles.points}>
                {index === 0 ? '0 AP' : `${tier.floor.toLocaleString('en-US')} AP`}
              </Text>
            </View>
          </RiseIn>
        ))}
      </RiseInGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  ladder: {
    flexDirection: 'column-reverse',
    marginVertical: spacing.lg,
  },
  rung: {
    height: RUNG_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emblemColumn: {
    width: EMBLEM_SIZE,
    height: RUNG_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rail: {
    position: 'absolute',
    left: (EMBLEM_SIZE - RAIL_WIDTH) / 2,
    width: RAIL_WIDTH,
    height: (RUNG_HEIGHT - EMBLEM_SIZE) / 2 + 2,
    opacity: RAIL_OPACITY,
  },
  railUp: {
    top: 0,
  },
  railDown: {
    bottom: 0,
  },
  nameColumn: {
    flex: 1,
  },
  name: {
    ...typeScale.cardTitle,
  },
  start: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  points: {
    ...typeScale.statSmall,
    color: colors.textSecondary,
  },
});
