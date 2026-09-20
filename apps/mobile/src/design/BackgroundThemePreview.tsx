import { View, type DimensionValue } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import type { BackgroundThemeDefinition } from './backgroundThemes';

// A small, static hint of each theme's atmosphere for the Appearance picker
// grid -- deliberately simpler than AppBackgroundLayer's real (occasionally
// animated) treatment: a preview tile just needs to communicate "this one
// has stars" / "this one has a warm color wash", not reproduce the effect
// exactly. Kept non-animated everywhere, including for themes that animate
// in the real app, so a grid of nine of these stays cheap to render.
export function BackgroundThemePreview({ theme }: { theme: BackgroundThemeDefinition }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <PreviewTreatment theme={theme} />
    </View>
  );
}

function PreviewTreatment({ theme }: { theme: BackgroundThemeDefinition }) {
  switch (theme.treatment) {
    case 'starlight':
      return <StaticDots positions={STAR_POSITIONS} size={1.4} opacity={0.3} />;
    case 'particles':
      return <StaticDots positions={PARTICLE_POSITIONS} size={2.4} opacity={0.22} />;
    case 'aurora':
      return (
        <View
          style={{
            position: 'absolute',
            top: -20,
            left: -10,
            width: '80%',
            height: 90,
            borderRadius: 90,
            backgroundColor: '#1F6E63',
            opacity: 0.12,
          }}
        />
      );
    case 'topographic':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid slice">
          <Path
            d="M-10,30 C 40,15 90,45 150,30 S 220,15 250,35"
            stroke="#FFFFFF"
            strokeWidth={1}
            fill="none"
            opacity={0.1}
          />
          <Path
            d="M-10,65 C 45,50 95,80 150,65 S 220,50 250,70"
            stroke="#FFFFFF"
            strokeWidth={1}
            fill="none"
            opacity={0.1}
          />
        </Svg>
      );
    case 'carbon':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid slice">
          {[-40, 0, 40, 80, 120, 160, 200].map((x) => (
            <Line
              key={x}
              x1={x}
              y1={0}
              x2={x + 100}
              y2={100}
              stroke="#FFFFFF"
              strokeWidth={1}
              opacity={0.07}
            />
          ))}
        </Svg>
      );
    case 'flat':
    default:
      return null;
  }
}

const STAR_POSITIONS: [DimensionValue, DimensionValue][] = [
  ['12%', '20%'],
  ['30%', '55%'],
  ['48%', '15%'],
  ['62%', '65%'],
  ['78%', '30%'],
  ['88%', '70%'],
  ['20%', '80%'],
  ['55%', '85%'],
];

const PARTICLE_POSITIONS: [DimensionValue, DimensionValue][] = [
  ['18%', '30%'],
  ['52%', '60%'],
  ['75%', '25%'],
  ['85%', '75%'],
];

function StaticDots({
  positions,
  size,
  opacity,
}: {
  positions: [DimensionValue, DimensionValue][];
  size: number;
  opacity: number;
}) {
  return (
    <>
      {positions.map(([left, top], i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left,
            top,
            width: size,
            height: size,
            borderRadius: size,
            backgroundColor: '#FFFFFF',
            opacity,
          }}
        />
      ))}
    </>
  );
}
