import { fireEvent, render, screen } from '@testing-library/react-native';
import { ChartPointDetail, type ChartPointDetailData } from './ChartPointDetail';

const baseData: ChartPointDetailData = {
  exerciseName: 'Bench Press',
  weightDisplay: 225,
  reps: 5,
  performedAt: '2026-10-03T00:00:00Z',
  unit: 'lb',
  volumeDisplay: 1125,
  previous: { weightDisplay: 220, reps: 5 },
  trueOneRepMaxDisplay: null,
};

describe('ChartPointDetail', () => {
  it('shows the headline weight x reps, date, and exercise name', () => {
    render(
      <ChartPointDetail
        data={baseData}
        accentColor="#2F80FF"
        onDismiss={jest.fn()}
        testID="detail"
      />,
    );

    expect(screen.getByText('225lb × 5')).toBeTruthy();
    expect(screen.getByText(/Bench Press/)).toBeTruthy();
  });

  it('shows volume, previous, and change', () => {
    render(
      <ChartPointDetail
        data={baseData}
        accentColor="#2F80FF"
        onDismiss={jest.fn()}
        testID="detail"
      />,
    );

    expect(screen.getByText('1125lb')).toBeTruthy();
    expect(screen.getByText('220lb × 5')).toBeTruthy();
    expect(screen.getByText('+5lb')).toBeTruthy();
  });

  it('does not show a 1RM line when this point is not a real 1-rep set', () => {
    render(
      <ChartPointDetail
        data={baseData}
        accentColor="#2F80FF"
        onDismiss={jest.fn()}
        testID="detail"
      />,
    );

    expect(screen.queryByText('1RM')).toBeNull();
  });

  it('shows a true 1RM line when this point is a real 1-rep set', () => {
    render(
      <ChartPointDetail
        data={{ ...baseData, reps: 1, trueOneRepMaxDisplay: 225 }}
        accentColor="#2F80FF"
        onDismiss={jest.fn()}
        testID="detail"
      />,
    );

    expect(screen.getByText('1RM')).toBeTruthy();
  });

  it('does not show a previous/change block when there is no previous point', () => {
    render(
      <ChartPointDetail
        data={{ ...baseData, previous: null }}
        accentColor="#2F80FF"
        onDismiss={jest.fn()}
        testID="detail"
      />,
    );

    expect(screen.queryByText('Previous')).toBeNull();
    expect(screen.queryByText('Change')).toBeNull();
  });

  it('shows a negative change without a plus sign', () => {
    render(
      <ChartPointDetail
        data={{ ...baseData, weightDisplay: 215, previous: { weightDisplay: 220, reps: 5 } }}
        accentColor="#2F80FF"
        onDismiss={jest.fn()}
        testID="detail"
      />,
    );

    expect(screen.getByText('-5lb')).toBeTruthy();
  });

  it('calls onDismiss when the dismiss button is pressed', () => {
    const onDismiss = jest.fn();
    render(
      <ChartPointDetail
        data={baseData}
        accentColor="#2F80FF"
        onDismiss={onDismiss}
        testID="detail"
      />,
    );

    fireEvent.press(screen.getByTestId('detail-dismiss'));

    expect(onDismiss).toHaveBeenCalled();
  });
});
