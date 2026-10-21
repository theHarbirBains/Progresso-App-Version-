import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { colors } from '../design/theme';
import { LaunchScreen } from './LaunchScreen';

describe('LaunchScreen', () => {
  it('shows the wood full screen with the logo over it while not ready', () => {
    render(<LaunchScreen ready={false} />);

    expect(screen.getByTestId('launch-screen')).toBeTruthy();
    const wood = StyleSheet.flatten(screen.getByTestId('launch-wood').props.style);
    expect(wood).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 });
    expect(screen.getByTestId('launch-wood').props.resizeMode).toBe('cover');
    expect(screen.getByTestId('launch-logo')).toBeTruthy();
  });

  it('is the wood from its first frame -- only the logo eases in', () => {
    render(<LaunchScreen ready={false} />);

    expect(StyleSheet.flatten(screen.getByTestId('launch-screen').props.style).opacity).toBe(1);
    expect(
      StyleSheet.flatten(screen.getByTestId('launch-screen').props.style).backgroundColor,
    ).toBe(colors.launchWood);
  });

  it('still renders once ready (stays mounted through its own exit fade)', () => {
    const { rerender } = render(<LaunchScreen ready={false} />);

    rerender(<LaunchScreen ready />);

    expect(screen.getByTestId('launch-screen')).toBeTruthy();
  });
});
