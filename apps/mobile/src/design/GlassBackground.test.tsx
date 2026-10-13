import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { GlassBackground } from './GlassBackground';

describe('GlassBackground', () => {
  it('renders on its own, with no provider needed', () => {
    render(<GlassBackground testID="glass" />);

    expect(screen.getByTestId('glass')).toBeTruthy();
  });

  it('does not render a blur layer for the default (surface) variant', () => {
    render(<GlassBackground testID="glass" />);

    expect(screen.queryByTestId('glass-blur')).toBeNull();
  });

  it('tints a widget translucently, so the background photo shows through it', () => {
    render(<GlassBackground testID="glass" />);

    // colors.surface (#1C1916) at 70%, the same opacity as Card's fill.
    const fill = StyleSheet.flatten(screen.getByTestId('glass-fill').props.style);
    expect(fill.backgroundColor).toBe('rgba(28, 25, 22, 0.7)');
  });
});
