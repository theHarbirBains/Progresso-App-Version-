import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Stat } from './Stat';
import { colors, fonts } from './theme';

describe('Stat', () => {
  it('renders the value, unit and label', () => {
    render(<Stat testID="stat" value="1,500" unit="kcal" label="Remaining" />);

    expect(screen.getByTestId('stat-value')).toHaveTextContent(/1,500/);
    expect(screen.getByTestId('stat-value')).toHaveTextContent(/kcal/);
    expect(screen.getByText('Remaining')).toBeTruthy();
  });

  it('is neutral by default: the number uses primary text, not the accent', () => {
    render(<Stat testID="stat" value="42" label="Sets" />);

    expect(StyleSheet.flatten(screen.getByTestId('stat-value').props.style).color).toBe(
      colors.textPrimary,
    );
  });

  it('takes an explicit accent for the one number that matters most', () => {
    render(<Stat testID="stat" value="42" label="Sets" color="#10B981" />);

    expect(StyleSheet.flatten(screen.getByTestId('stat-value').props.style).color).toBe('#10B981');
  });

  it.each([
    ['large', 30],
    ['medium', 19],
    ['small', 15],
  ] as const)('renders the %s size in the mono readout face at %spx', (size, px) => {
    render(<Stat testID="stat" value="42" label="Sets" size={size} />);

    const style = StyleSheet.flatten(screen.getByTestId('stat-value').props.style);
    expect(style.fontSize).toBe(px);
    expect([fonts.mono, fonts.monoBold]).toContain(style.fontFamily);
  });

  it('centres its content on request', () => {
    render(<Stat testID="stat" value="42" label="Sets" align="center" />);

    expect(StyleSheet.flatten(screen.getByTestId('stat').props.style).alignItems).toBe('center');
  });
});
