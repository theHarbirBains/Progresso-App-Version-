import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { fonts } from '../design/theme';
import { WorkoutStats } from './WorkoutStats';

const baseProps = {
  performedAt: null as string | null,
  active: false,
  totalSets: 0,
  totalVolumeDisplay: '0 kg',
};

describe('WorkoutStats', () => {
  it('shows a static 00:00 duration before the workout has started', () => {
    render(<WorkoutStats {...baseProps} performedAt={null} />);

    expect(screen.getByTestId('workout-summary-duration')).toHaveTextContent('00:00');
  });

  it('shows a running duration once the workout has a start time', () => {
    render(
      <WorkoutStats {...baseProps} performedAt={new Date().toISOString()} active testID="stats" />,
    );

    expect(screen.getByTestId('workout-summary-duration')).toHaveTextContent(/^\d{2}:\d{2}/);
  });

  it('shows total sets and total volume', () => {
    render(<WorkoutStats {...baseProps} totalSets={5} totalVolumeDisplay="1,250 kg" />);

    expect(screen.getByTestId('workout-summary-total-sets')).toHaveTextContent('5');
    expect(screen.getByTestId('workout-summary-total-volume')).toHaveTextContent('1,250 kg');
  });

  it('labels each readout', () => {
    render(<WorkoutStats {...baseProps} />);

    expect(screen.getByText('Duration')).toBeTruthy();
    expect(screen.getByText('Total Sets')).toBeTruthy();
    expect(screen.getByText('Total Volume')).toBeTruthy();
  });

  it('is a quiet strip: mono numbers in the neutral text color, no card or fill', () => {
    render(<WorkoutStats {...baseProps} totalSets={3} testID="stats" />);

    const value = StyleSheet.flatten(screen.getByTestId('workout-summary-total-sets').props.style);
    expect(value.fontFamily).toBe(fonts.mono);
    const strip = StyleSheet.flatten(screen.getByTestId('stats').props.style);
    expect(strip.backgroundColor).toBeUndefined();
    expect(strip.borderRadius).toBeUndefined();
  });

  it('does not display estimated calories anywhere', () => {
    render(<WorkoutStats {...baseProps} />);

    expect(screen.queryByText(/calor/i)).toBeNull();
  });
});
