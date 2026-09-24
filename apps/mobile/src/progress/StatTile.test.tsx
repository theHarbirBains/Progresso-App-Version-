import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { AppCard } from '../design/AppCard';
import { fonts } from '../design/theme';
import { StatTile } from './StatTile';

describe('StatTile', () => {
  it('renders the value and label', () => {
    render(<StatTile testID="stat-workouts" label="Workouts" value="47" />);

    expect(screen.getByTestId('stat-workouts')).toBeTruthy();
    expect(screen.getByText('47')).toBeTruthy();
    expect(screen.getByText('Workouts')).toBeTruthy();
  });

  it('is plain content -- a neutral mono number, no card, no icon', () => {
    render(<StatTile testID="stat-workouts" label="Workouts" value="47" />);

    expect(screen.UNSAFE_queryAllByType(AppCard)).toHaveLength(0);
    const value = StyleSheet.flatten(screen.getByText('47').props.style);
    expect(value.fontFamily).toBe(fonts.mono);
    expect(
      StyleSheet.flatten(screen.getByTestId('stat-workouts').props.style).backgroundColor,
    ).toBeUndefined();
  });
});
