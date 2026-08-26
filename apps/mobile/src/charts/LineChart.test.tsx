import { render } from '@testing-library/react-native';
import { Circle, Polyline } from 'react-native-svg';
import { LineChart } from './LineChart';

// Verifies chart-data correctness at the component boundary: the right
// number of data points get rendered, and no pixel-level assertions are
// made (RNTL can't meaningfully assert exact SVG coordinates).
describe('LineChart', () => {
  it('renders one Circle per point', () => {
    const { UNSAFE_getAllByType } = render(
      <LineChart
        points={[
          { x: 0, y: 10 },
          { x: 1, y: 20 },
          { x: 2, y: 15 },
        ]}
        width={200}
        height={100}
      />,
    );

    expect(UNSAFE_getAllByType(Circle)).toHaveLength(3);
  });

  it('renders a Polyline when there is more than one point', () => {
    const { UNSAFE_getAllByType } = render(
      <LineChart
        points={[
          { x: 0, y: 10 },
          { x: 1, y: 20 },
        ]}
        width={200}
        height={100}
      />,
    );

    expect(UNSAFE_getAllByType(Polyline)).toHaveLength(1);
  });

  it('does not render a Polyline for a single point', () => {
    const { UNSAFE_queryAllByType } = render(
      <LineChart points={[{ x: 0, y: 10 }]} width={200} height={100} />,
    );

    expect(UNSAFE_queryAllByType(Polyline)).toHaveLength(0);
  });

  it('renders an empty placeholder without crashing when there are no points', () => {
    const { toJSON } = render(
      <LineChart points={[]} width={200} height={100} testID="empty-chart" />,
    );

    expect(toJSON()).toBeTruthy();
  });

  it('does not divide by zero when every point shares the same x or y value', () => {
    const { UNSAFE_getAllByType } = render(
      <LineChart
        points={[
          { x: 5, y: 100 },
          { x: 5, y: 100 },
        ]}
        width={200}
        height={100}
      />,
    );

    expect(UNSAFE_getAllByType(Circle)).toHaveLength(2);
  });
});
