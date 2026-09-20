import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import * as navigationTransitions from '../navigation/navigationTransitions';
import { AppBackgroundLayer } from './AppBackgroundLayer';
import { BACKGROUND_THEME_ORDER } from './backgroundThemes';
import { useBackgroundTheme } from './backgroundThemeStore';

jest.mock('./backgroundThemeStore', () => ({
  ...jest.requireActual('./backgroundThemeStore'),
  useBackgroundTheme: jest.fn(),
}));

const mockUseBackgroundTheme = useBackgroundTheme as jest.Mock;

describe('AppBackgroundLayer', () => {
  it.each(BACKGROUND_THEME_ORDER)('renders %s without crashing, animated or not', (id) => {
    mockUseBackgroundTheme.mockReturnValue({
      theme: require('./backgroundThemes').BACKGROUND_THEMES[id],
    });
    jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(false);

    render(<AppBackgroundLayer />);
    expect(screen.getByTestId('app-background-layer')).toBeTruthy();
  });

  it('still renders every treatment when Reduce Motion is enabled (falls back to static)', () => {
    jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(true);

    for (const id of BACKGROUND_THEME_ORDER) {
      mockUseBackgroundTheme.mockReturnValue({
        theme: require('./backgroundThemes').BACKGROUND_THEMES[id],
      });
      const { unmount } = render(<AppBackgroundLayer />);
      expect(screen.getByTestId('app-background-layer')).toBeTruthy();
      unmount();
    }
  });

  it('is non-interactive (pointerEvents="none") so it never intercepts touches', () => {
    mockUseBackgroundTheme.mockReturnValue({
      theme: require('./backgroundThemes').BACKGROUND_THEMES.obsidian,
    });
    jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(false);

    render(<AppBackgroundLayer />);
    expect(screen.getByTestId('app-background-layer').props.pointerEvents).toBe('none');
  });

  it('always renders the depth overlay, for every theme, regardless of Reduce Motion', () => {
    jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(true);
    mockUseBackgroundTheme.mockReturnValue({
      theme: require('./backgroundThemes').BACKGROUND_THEMES.obsidian,
    });

    render(<AppBackgroundLayer />);

    expect(screen.getByTestId('app-background-depth-overlay')).toBeTruthy();
  });

  it('does not render either background image when the theme has neither photo', () => {
    mockUseBackgroundTheme.mockReturnValue({
      theme: {
        ...require('./backgroundThemes').BACKGROUND_THEMES.midnight,
        workoutImageSource: undefined,
        nutritionImageSource: undefined,
      },
    });
    jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(false);

    render(<AppBackgroundLayer />);

    expect(screen.queryByTestId('app-background-image-workout')).toBeNull();
    expect(screen.queryByTestId('app-background-image-nutrition')).toBeNull();
  });

  it.each(BACKGROUND_THEME_ORDER)(
    'renders both the workout and nutrition background images for every theme, regardless of mode (%s)',
    (id) => {
      mockUseBackgroundTheme.mockReturnValue({
        theme: require('./backgroundThemes').BACKGROUND_THEMES[id],
      });
      jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(false);

      render(<AppBackgroundLayer />);

      // Both stay mounted at all times (only opacity toggles on mode change)
      // so switching modes is an instant opacity flip, never a fresh image
      // decode -- see the component's own comment.
      expect(screen.getByTestId('app-background-image-workout')).toBeTruthy();
      expect(screen.getByTestId('app-background-image-nutrition')).toBeTruthy();
    },
  );

  it('shows the workout photo at full opacity, and keeps the nutrition photo mounted but invisible, when mode is "workout" (or omitted)', () => {
    mockUseBackgroundTheme.mockReturnValue({
      theme: {
        ...require('./backgroundThemes').BACKGROUND_THEMES.midnight,
        workoutImageSource: { uri: 'https://example.test/workout.jpg' },
        nutritionImageSource: { uri: 'https://example.test/nutrition.jpg' },
      },
    });
    jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(false);

    render(<AppBackgroundLayer mode="workout" />);

    const workoutImage = screen.getByTestId('app-background-image-workout');
    const nutritionImage = screen.getByTestId('app-background-image-nutrition');
    expect(workoutImage.props.source).toEqual({ uri: 'https://example.test/workout.jpg' });
    expect(StyleSheet.flatten(workoutImage.props.style).opacity).toBe(1);
    expect(StyleSheet.flatten(nutritionImage.props.style).opacity).toBe(0);
  });

  it('shows the nutrition photo at full opacity, and keeps the workout photo mounted but invisible, when mode is "nutrition"', () => {
    mockUseBackgroundTheme.mockReturnValue({
      theme: {
        ...require('./backgroundThemes').BACKGROUND_THEMES.midnight,
        workoutImageSource: { uri: 'https://example.test/workout.jpg' },
        nutritionImageSource: { uri: 'https://example.test/nutrition.jpg' },
      },
    });
    jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(false);

    render(<AppBackgroundLayer mode="nutrition" />);

    const workoutImage = screen.getByTestId('app-background-image-workout');
    const nutritionImage = screen.getByTestId('app-background-image-nutrition');
    expect(nutritionImage.props.source).toEqual({ uri: 'https://example.test/nutrition.jpg' });
    expect(StyleSheet.flatten(nutritionImage.props.style).opacity).toBe(1);
    expect(StyleSheet.flatten(workoutImage.props.style).opacity).toBe(0);
  });

  it('renders the background images at full sharpness, with no blur applied', () => {
    mockUseBackgroundTheme.mockReturnValue({
      theme: {
        ...require('./backgroundThemes').BACKGROUND_THEMES.midnight,
        workoutImageSource: { uri: 'https://example.test/bg.jpg' },
      },
    });
    jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(false);

    render(<AppBackgroundLayer mode="workout" />);

    const image = screen.getByTestId('app-background-image-workout');
    expect(image.props.blurRadius).toBeFalsy();
  });
});
