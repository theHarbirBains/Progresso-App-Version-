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
});
