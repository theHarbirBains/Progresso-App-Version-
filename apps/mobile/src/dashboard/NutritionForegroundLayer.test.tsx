import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { NutritionForegroundLayer } from './NutritionForegroundLayer';
import { useBackgroundTheme } from '../design/backgroundThemeStore';

jest.mock('../design/backgroundThemeStore', () => ({
  ...jest.requireActual('../design/backgroundThemeStore'),
  useBackgroundTheme: jest.fn(),
}));

const mockUseBackgroundTheme = useBackgroundTheme as jest.Mock;

const NUTRITION_IMAGE = { uri: 'https://example.test/nutrition.jpg' };

describe('NutritionForegroundLayer', () => {
  beforeEach(() => {
    mockUseBackgroundTheme.mockReturnValue({
      theme: {
        ...require('../design/backgroundThemes').BACKGROUND_THEMES.obsidian,
        nutritionImageSource: NUTRITION_IMAGE,
      },
    });
  });

  it('is non-interactive so it never intercepts touches', () => {
    render(<NutritionForegroundLayer visible />);
    expect(screen.getByTestId('nutrition-foreground-layer').props.pointerEvents).toBe('none');
  });

  it('renders both the left and bottom foreground windows using the same nutrition photo', () => {
    render(<NutritionForegroundLayer visible />);

    expect(screen.getByTestId('nutrition-foreground-left-image').props.source).toEqual(
      NUTRITION_IMAGE,
    );
    expect(screen.getByTestId('nutrition-foreground-bottom-image').props.source).toEqual(
      NUTRITION_IMAGE,
    );
  });

  it('stays mounted (rather than unmounting) when not visible, only turning invisible via opacity', () => {
    render(<NutritionForegroundLayer visible={false} />);

    // Kept mounted -- decoded and ready -- so switching into Nutrition mode
    // never pays a first-time image-decode cost, matching
    // AppBackgroundLayer's own "both photos always mounted" approach.
    const leftImage = screen.getByTestId('nutrition-foreground-left-image');
    const bottomImage = screen.getByTestId('nutrition-foreground-bottom-image');
    expect(leftImage).toBeTruthy();
    expect(bottomImage).toBeTruthy();
  });

  it('renders the foreground windows at full opacity when visible, and invisible when not', () => {
    const { rerender } = render(<NutritionForegroundLayer visible />);
    expect(
      StyleSheet.flatten(screen.getByTestId('nutrition-foreground-left-window').props.style)
        .opacity,
    ).toBe(1);
    expect(
      StyleSheet.flatten(screen.getByTestId('nutrition-foreground-bottom-window').props.style)
        .opacity,
    ).toBe(1);

    rerender(<NutritionForegroundLayer visible={false} />);
    expect(
      StyleSheet.flatten(screen.getByTestId('nutrition-foreground-left-window').props.style)
        .opacity,
    ).toBe(0);
    expect(
      StyleSheet.flatten(screen.getByTestId('nutrition-foreground-bottom-window').props.style)
        .opacity,
    ).toBe(0);
  });

  it('renders nothing when the active theme has no nutrition photo', () => {
    mockUseBackgroundTheme.mockReturnValue({
      theme: {
        ...require('../design/backgroundThemes').BACKGROUND_THEMES.obsidian,
        nutritionImageSource: undefined,
      },
    });

    render(<NutritionForegroundLayer visible />);

    expect(screen.queryByTestId('nutrition-foreground-layer')).toBeNull();
  });
});
