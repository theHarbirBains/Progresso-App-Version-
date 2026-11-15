import { StyleSheet } from 'react-native';
import { act, render, renderHook, screen } from '@testing-library/react-native';
import { colors } from '../design/theme';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { APP_THEMES } from '../theme/appThemes';
import { HOLIDAY_LAUNCH_MS, LaunchScreen, useHolidayLaunchHeld } from './LaunchScreen';

jest.mock('../navigation/navigationTransitions', () => ({
  useReduceMotionPreference: jest.fn(() => false),
}));

const forest = APP_THEMES.find((theme) => theme.id === 'forest')!;

function opacityOf(testID: string): number {
  const style = StyleSheet.flatten(screen.getByTestId(testID).props.style);
  return typeof style.opacity === 'number' ? style.opacity : Number(style.opacity);
}

describe('LaunchScreen', () => {
  beforeEach(() => {
    jest.mocked(useReduceMotionPreference).mockReturnValue(false);
  });

  it("takes over from the native splash: its warm brown and the P, before the theme's read", () => {
    render(<LaunchScreen ready={false} theme={null} />);

    expect(opacityOf('launch-screen')).toBe(1);
    expect(
      StyleSheet.flatten(screen.getByTestId('launch-screen').props.style).backgroundColor,
    ).toBe(colors.launchWood);
    expect(screen.getByTestId('launch-logo')).toBeTruthy();
    expect(screen.queryByTestId('launch-photo')).toBeNull();
  });

  it('wears the theme on this phone: its photo, full screen behind the P', () => {
    const { rerender } = render(<LaunchScreen ready={false} theme={null} />);

    rerender(<LaunchScreen ready={false} theme={forest} />);

    expect(screen.getByTestId('launch-photo-image').props.source).toBe(forest.photo);
    expect(screen.getByTestId('launch-photo-image').props.resizeMode).toBe('cover');
    expect(StyleSheet.flatten(screen.getByTestId('launch-photo').props.style)).toMatchObject({
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    });
    // It eases in from nothing (Reduce Motion, below, shows it whole at once).
    expect(opacityOf('launch-photo')).toBe(0);
  });

  it('shows the holiday gym through the holidays, in place of the theme', () => {
    render(<LaunchScreen ready={false} theme={forest} holiday />);

    expect(screen.getByTestId('launch-photo-image').props.source).toBe(
      require('../../assets/launch/holiday-launch.jpg'),
    );
    expect(screen.getByTestId('launch-photo-image').props.source).not.toBe(forest.photo);
    expect(screen.getByTestId('launch-logo')).toBeTruthy();
  });

  it('holds the holiday launch about three seconds from the start', () => {
    jest.useFakeTimers();
    try {
      const { result } = renderHook(() => useHolidayLaunchHeld());
      expect(HOLIDAY_LAUNCH_MS).toBe(3000);
      expect(result.current).toBe(false);

      act(() => {
        jest.advanceTimersByTime(2999);
      });
      expect(result.current).toBe(false);

      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(result.current).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows the photo at once under Reduce Motion', () => {
    jest.mocked(useReduceMotionPreference).mockReturnValue(true);

    render(<LaunchScreen ready={false} theme={forest} />);

    expect(opacityOf('launch-photo')).toBe(1);
    expect(opacityOf('launch-logo')).toBe(1);
  });

  it('still renders once ready (stays mounted through its own exit fade)', () => {
    const { rerender } = render(<LaunchScreen ready={false} theme={forest} />);

    rerender(<LaunchScreen ready theme={forest} />);

    expect(screen.getByTestId('launch-screen')).toBeTruthy();
  });
});
