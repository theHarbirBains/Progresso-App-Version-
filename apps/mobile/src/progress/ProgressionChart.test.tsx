import { fireEvent, render, screen } from '@testing-library/react-native';
import { ProgressionChart } from './ProgressionChart';

const points = [
  { x: 1, y: 100 },
  { x: 2, y: 110 },
  { x: 3, y: 120 },
];

function layoutWidth(testID: string, width: number) {
  fireEvent(screen.getByTestId(testID), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 160 } },
  });
}

describe('ProgressionChart', () => {
  it('renders nothing to measure when there are no points', () => {
    render(
      <ProgressionChart
        points={[]}
        color="#2F80FF"
        selectedIndex={null}
        onSelectIndex={jest.fn()}
        testID="chart"
      />,
    );

    expect(screen.getByTestId('chart')).toBeTruthy();
    expect(screen.queryByTestId('chart-point-0')).toBeNull();
  });

  it('renders one tappable point per data point once measured', () => {
    render(
      <ProgressionChart
        points={points}
        color="#2F80FF"
        selectedIndex={null}
        onSelectIndex={jest.fn()}
        testID="chart"
      />,
    );
    layoutWidth('chart', 280);

    expect(screen.getByTestId('chart-point-0')).toBeTruthy();
    expect(screen.getByTestId('chart-point-1')).toBeTruthy();
    expect(screen.getByTestId('chart-point-2')).toBeTruthy();
  });

  it('selects a point on tap', () => {
    const onSelectIndex = jest.fn();
    render(
      <ProgressionChart
        points={points}
        color="#2F80FF"
        selectedIndex={null}
        onSelectIndex={onSelectIndex}
        testID="chart"
      />,
    );
    layoutWidth('chart', 280);

    fireEvent.press(screen.getByTestId('chart-point-1'));

    expect(onSelectIndex).toHaveBeenCalledWith(1);
  });

  it('deselects when the already-selected point is tapped again', () => {
    const onSelectIndex = jest.fn();
    render(
      <ProgressionChart
        points={points}
        color="#2F80FF"
        selectedIndex={1}
        onSelectIndex={onSelectIndex}
        testID="chart"
      />,
    );
    layoutWidth('chart', 280);

    fireEvent.press(screen.getByTestId('chart-point-1'));

    expect(onSelectIndex).toHaveBeenCalledWith(null);
  });

  it('marks the selected point in accessibilityState', () => {
    render(
      <ProgressionChart
        points={points}
        color="#2F80FF"
        selectedIndex={2}
        onSelectIndex={jest.fn()}
        testID="chart"
      />,
    );
    layoutWidth('chart', 280);

    expect(screen.getByTestId('chart-point-2').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('chart-point-0').props.accessibilityState.selected).toBe(false);
  });

  it('uses a custom accessibility label per point when provided', () => {
    render(
      <ProgressionChart
        points={points}
        color="#2F80FF"
        selectedIndex={null}
        onSelectIndex={jest.fn()}
        testID="chart"
        accessibilityLabelForPoint={(i) => `Custom label ${i}`}
      />,
    );
    layoutWidth('chart', 280);

    expect(screen.getByTestId('chart-point-0').props.accessibilityLabel).toBe('Custom label 0');
  });
});
