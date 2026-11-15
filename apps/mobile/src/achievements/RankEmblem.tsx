import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from '../design/Text';
import { fonts } from '../design/theme';
import { DIVISIONS, TIERS, type TierId } from './ranks';

// Every tier's emblem in a 100 x 100 box: its own silhouette, so a rank reads by shape as well
// as colour -- Bronze a round medal, Silver a shield, Gold a hexagon, Platinum an octagon,
// Diamond a diamond, Vanguard a chevron, Titan a heavy notched shield, Sovereign a crowned
// shield, Legacy an eight-pointed star.

function polygon(points: [number, number][]): string {
  return `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`;
}

function regular(sides: number, radius: number, rotate: number): string {
  return polygon(
    Array.from({ length: sides }, (_, i) => {
      const a = ((rotate + (360 / sides) * i) * Math.PI) / 180;
      return [50 + radius * Math.cos(a), 50 + radius * Math.sin(a)] as [number, number];
    }),
  );
}

function star(points: number, outer: number, inner: number): string {
  return polygon(
    Array.from({ length: points * 2 }, (_, i) => {
      const r = i % 2 === 0 ? outer : inner;
      const a = ((-90 + (180 / points) * i) * Math.PI) / 180;
      return [50 + r * Math.cos(a), 50 + r * Math.sin(a)] as [number, number];
    }),
  );
}

/** The tier's silhouette, `inset` in from the box's edge. */
function shape(id: TierId, inset: number): string {
  const k = (n: number) => 50 + (n - 50) * ((50 - inset) / 46);
  switch (id) {
    case 'bronze': {
      const r = 46 - inset;
      return `M50 ${50 - r}A${r} ${r} 0 1 1 49.99 ${50 - r}Z`;
    }
    case 'silver':
      return `M${k(14)} ${k(10)}L${k(86)} ${k(10)}L${k(86)} ${k(52)}Q${k(86)} ${k(80)} ${k(50)} ${k(94)}Q${k(14)} ${k(80)} ${k(14)} ${k(52)}Z`;
    case 'gold':
      return regular(6, 46 - inset, -90);
    case 'platinum':
      return regular(8, 46 - inset, -67.5);
    case 'diamond':
      return polygon([
        [50, k(4)],
        [k(90), 50],
        [50, k(96)],
        [k(10), 50],
      ]);
    case 'vanguard':
      return polygon([
        [50, k(4)],
        [k(90), k(22)],
        [k(90), k(62)],
        [50, k(96)],
        [k(10), k(62)],
        [k(10), k(22)],
      ]);
    case 'titan':
      return polygon([
        [k(22), k(6)],
        [k(78), k(6)],
        [k(92), k(20)],
        [k(92), k(58)],
        [50, k(96)],
        [k(8), k(58)],
        [k(8), k(20)],
      ]);
    case 'sovereign':
      return polygon([
        [k(10), k(6)],
        [k(30), k(22)],
        [50, k(4)],
        [k(70), k(22)],
        [k(90), k(6)],
        [k(90), k(58)],
        [50, k(96)],
        [k(10), k(58)],
      ]);
    case 'legacy':
      return star(8, 48 - inset, 36 - inset * 0.8);
  }
}

/**
 * A rank's emblem: the tier's silhouette in its deep colour, outlined in its primary with a
 * finer inner outline, the division's numeral at its heart. Flat colour, no gradient or glow.
 * `dim` shows a rank not yet reached.
 */
export function RankEmblem({
  tierIndex,
  divisionIndex,
  size = 64,
  dim = false,
  showDivision = true,
  testID,
}: {
  tierIndex: number;
  divisionIndex?: number;
  size?: number;
  dim?: boolean;
  showDivision?: boolean;
  testID?: string;
}) {
  const tier = TIERS[Math.max(0, Math.min(TIERS.length - 1, tierIndex))]!;
  const division = divisionIndex === undefined ? null : DIVISIONS[divisionIndex];
  return (
    <View
      testID={testID}
      style={[styles.emblem, { width: size, height: size }, dim && styles.dim]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Path
          d={shape(tier.id, 2)}
          fill={tier.palette.deep}
          stroke={tier.palette.primary}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <Path
          d={shape(tier.id, 11)}
          fill="none"
          stroke={tier.palette.primary}
          strokeOpacity={0.45}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </Svg>
      {showDivision && division ? (
        <Text
          style={[
            styles.numeral,
            { color: tier.palette.primary, fontSize: Math.max(9, Math.round(size * 0.26)) },
          ]}
        >
          {division}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  emblem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: {
    opacity: 0.35,
  },
  numeral: {
    fontFamily: fonts.monoBold,
  },
});
