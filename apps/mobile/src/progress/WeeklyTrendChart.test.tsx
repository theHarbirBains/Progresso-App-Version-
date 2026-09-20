import { fireEvent, render, screen } from '@testing-library/react-native';
import { WeeklyTrendChart } from './WeeklyTrendChart';

function layoutWidth(testID: string, width: number) {
  fireEvent(screen.getByTestId(testID), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 90 } },
  });
}

describe('WeeklyTrendChart', () => {
  it('shows the empty message and no chart when every week is zero', () => {
    render(
      <WeeklyTrendChart
        testID="weekly-workouts"
        label="Weekly Workouts"
        points={[
          { weekStart: '2026-08-24T00:00:00.000Z', value: 0 },
          { weekStart: '2026-08-31T00:00:00.000Z', value: 0 },
        ]}
        accentColor="#2F80FF"
        formatTotal={(total) => `${total} workouts`}
        emptyMessage="Log a workout to see your weekly trend."
      />,
    );

    expect(screen.getByTestId('weekly-workouts-empty')).toHaveTextContent(
      'Log a workout to see your weekly trend.',
    );
    expect(screen.queryByTestId('weekly-workouts-total')).toBeNull();
    expect(screen.queryByTestId('weekly-workouts-chart')).toBeNull();
  });

  it('shows the real total and renders the chart once real data exists', () => {
    render(
      <WeeklyTrendChart
        testID="weekly-workouts"
        label="Weekly Workouts"
        points={[
          { weekStart: '2026-08-24T00:00:00.000Z', value: 2 },
          { weekStart: '2026-08-31T00:00:00.000Z', value: 3 },
        ]}
        accentColor="#2F80FF"
        formatTotal={(total) => `${total} workouts`}
        emptyMessage="Log a workout to see your weekly trend."
      />,
    );

    expect(screen.getByTestId('weekly-workouts-total')).toHaveTextContent('5 workouts');
    layoutWidth('weekly-workouts-measure', 280);
    expect(screen.getByTestId('weekly-workouts-chart')).toBeTruthy();
    expect(screen.queryByTestId('weekly-workouts-empty')).toBeNull();
  });
});
