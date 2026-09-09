import { fireEvent, render, screen } from '@testing-library/react-native';
import { WorkoutSummaryCard } from './WorkoutSummaryCard';

const baseProps = {
  workoutName: 'Push Day',
  muscleGroupsLabel: 'Chest, Shoulders, Triceps',
  performedAt: null as string | null,
  active: false,
  totalSets: 0,
  totalVolumeDisplay: '0 kg',
  accentColor: '#2F80FF',
};

describe('WorkoutSummaryCard', () => {
  it('shows the workout name and muscle groups', () => {
    render(<WorkoutSummaryCard {...baseProps} />);

    expect(screen.getByText('Push Day')).toBeTruthy();
    expect(screen.getByText('Chest, Shoulders, Triceps')).toBeTruthy();
  });

  it('shows a static 00:00 duration before the workout has started', () => {
    render(<WorkoutSummaryCard {...baseProps} performedAt={null} />);

    expect(screen.getByTestId('workout-summary-duration')).toHaveTextContent('00:00');
  });

  it('shows total sets and total volume', () => {
    render(<WorkoutSummaryCard {...baseProps} totalSets={5} totalVolumeDisplay="1,250 kg" />);

    expect(screen.getByTestId('workout-summary-total-sets')).toHaveTextContent('5');
    expect(screen.getByTestId('workout-summary-total-volume')).toHaveTextContent('1,250 kg');
  });

  it('does not show a Change link when onChangeDay is omitted', () => {
    render(<WorkoutSummaryCard {...baseProps} />);

    expect(screen.queryByTestId('workout-summary-change')).toBeNull();
  });

  it('calls onChangeDay when Change is pressed', () => {
    const onChangeDay = jest.fn();
    render(<WorkoutSummaryCard {...baseProps} onChangeDay={onChangeDay} />);

    fireEvent.press(screen.getByTestId('workout-summary-change'));

    expect(onChangeDay).toHaveBeenCalled();
  });

  it('does not display estimated calories anywhere', () => {
    render(<WorkoutSummaryCard {...baseProps} />);

    expect(screen.queryByText(/calor/i)).toBeNull();
  });
});
