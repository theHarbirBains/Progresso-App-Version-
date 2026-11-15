import { render, screen } from '@testing-library/react-native';
import Svg, { Path } from 'react-native-svg';
import { AchievementEmblem } from './AchievementEmblem';

describe('AchievementEmblem', () => {
  it('draws one ring segment per level, the levels reached in the accent', () => {
    render(
      <AchievementEmblem icon="zap" level={3} levels={8} accentColor="#D99A50" testID="emblem" />,
    );

    const emblem = screen.getByTestId('emblem', { includeHiddenElements: true });
    const segments = emblem.findByType(Svg).findAllByType(Path);
    expect(segments).toHaveLength(8);
    expect(
      segments.filter((s: { props: { stroke?: string } }) => s.props.stroke === '#D99A50'),
    ).toHaveLength(3);
    expect(emblem.props.accessibilityElementsHidden).toBe(true);
  });

  it("draws a single unlock's ring whole", () => {
    render(
      <AchievementEmblem icon="play" level={1} levels={1} accentColor="#D99A50" testID="emblem" />,
    );

    const emblem = screen.getByTestId('emblem', { includeHiddenElements: true });
    expect(emblem.findByType(Svg).findAllByType(Path)).toHaveLength(0);
  });
});
