import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { StatBlock } from './StatBlock';
import { colors, fonts, radii } from './theme';

describe('StatBlock', () => {
  it('shows the figure and its label', () => {
    render(<StatBlock testID="s" value="45 min" label="Duration" />);

    expect(screen.getByTestId('s')).toHaveTextContent(/45 min/);
    expect(screen.getByText('Duration')).toBeTruthy();
  });

  it('sets the figure in the mono face, neutral by default and in the given colour when asked', () => {
    const { rerender } = render(<StatBlock value="12" label="Sets" />);
    const neutral = StyleSheet.flatten(screen.getByText('12').props.style);
    expect(neutral.fontFamily).toBe(fonts.mono);
    expect(neutral.color).toBe(colors.textPrimary);

    rerender(<StatBlock value="12" label="Sets" valueColor="#2F80FF" />);
    expect(StyleSheet.flatten(screen.getByText('12').props.style).color).toBe('#2F80FF');
  });

  it('is a quiet raised block: a fill and the control radius, but no border', () => {
    render(<StatBlock testID="s" value="12" label="Sets" />);

    const style = StyleSheet.flatten(screen.getByTestId('s').props.style);
    expect(style.backgroundColor).toBe(colors.surfaceRaised);
    expect(style.borderRadius).toBe(radii.md);
    expect(style.borderWidth).toBeUndefined();
    expect(style.flex).toBe(1);
  });
});
