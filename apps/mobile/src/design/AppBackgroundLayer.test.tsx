import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import * as navigationTransitions from '../navigation/navigationTransitions';
import { AppBackgroundLayer, ScreenBackdrop } from './AppBackgroundLayer';
import { BACKGROUND_THEME_ORDER, BACKGROUND_THEMES } from './backgroundThemes';
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

  it('draws no photograph in either mode -- only the flat fill, the theme treatment and the glow', () => {
    mockUseBackgroundTheme.mockReturnValue({ theme: BACKGROUND_THEMES.obsidian });
    jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(false);

    render(<AppBackgroundLayer accentColor="#10B981" />);

    expect(screen.queryByTestId('app-background-image-workout')).toBeNull();
    expect(screen.queryByTestId('app-background-image-nutrition')).toBeNull();
    expect(screen.queryByTestId('app-background-depth-overlay')).toBeNull();
  });
});

describe('AppBackgroundLayer atmosphere', () => {
  beforeEach(() => {
    mockUseBackgroundTheme.mockReturnValue({ theme: BACKGROUND_THEMES.obsidian });
    jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(false);
  });

  const opacity = (testID: string) =>
    StyleSheet.flatten(screen.getByTestId(testID).props.style).opacity;

  it('draws the same glow and shade as every page, in the given accent', () => {
    render(<AppBackgroundLayer accentColor="#2F80FF" />);

    expect(screen.getByTestId('app-background-glow').props.colors[0]).toBe(
      'rgba(47, 128, 255, 0.2)',
    );
    expect(screen.getByTestId('app-background-shade')).toBeTruthy();
    expect(opacity('app-background-atmosphere')).toBe(1);
  });

  it('tints the glow green when given the Nutrition accent', () => {
    render(<AppBackgroundLayer accentColor="#10B981" />);

    expect(screen.getByTestId('app-background-glow').props.colors[0]).toBe(
      'rgba(16, 185, 129, 0.2)',
    );
  });

  it('draws no glow without an accent, but keeps the gentle edge shade', () => {
    render(<AppBackgroundLayer />);

    expect(screen.queryByTestId('app-background-glow')).toBeNull();
    expect(screen.getByTestId('app-background-shade')).toBeTruthy();
  });

  it('hides the atmosphere (staying mounted) when showAtmosphere is false, leaving the flat fill', () => {
    const { rerender } = render(
      <AppBackgroundLayer accentColor="#2F80FF" showAtmosphere={false} />,
    );
    expect(opacity('app-background-atmosphere')).toBe(0);

    rerender(<AppBackgroundLayer accentColor="#2F80FF" showAtmosphere />);
    expect(opacity('app-background-atmosphere')).toBe(1);
  });
});

describe('ScreenBackdrop', () => {
  beforeEach(() => {
    jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(false);
  });

  it.each(BACKGROUND_THEME_ORDER)(
    'paints %s theme colour fully opaque, so a photo behind it can never show through',
    (id) => {
      mockUseBackgroundTheme.mockReturnValue({ theme: BACKGROUND_THEMES[id] });
      render(
        <ScreenBackdrop>
          <Text>page</Text>
        </ScreenBackdrop>,
      );

      const style = StyleSheet.flatten(screen.getByTestId('screen-backdrop').props.style);
      expect(style.backgroundColor).toBe(BACKGROUND_THEMES[id].colors.background);
      expect(style.backgroundColor).not.toMatch(/rgba|transparent/);
      expect(style.opacity).toBeUndefined();
    },
  );

  it('fills its screen and renders the page on top of the backdrop', () => {
    mockUseBackgroundTheme.mockReturnValue({ theme: BACKGROUND_THEMES.obsidian });
    render(
      <ScreenBackdrop>
        <Text>page</Text>
      </ScreenBackdrop>,
    );

    expect(StyleSheet.flatten(screen.getByTestId('screen-backdrop').props.style).flex).toBe(1);
    expect(screen.getByText('page')).toBeTruthy();
  });

  it('never carries a photograph', () => {
    mockUseBackgroundTheme.mockReturnValue({ theme: BACKGROUND_THEMES.obsidian });
    render(
      <ScreenBackdrop>
        <Text>page</Text>
      </ScreenBackdrop>,
    );

    expect(screen.queryByTestId('app-background-image-workout')).toBeNull();
    expect(screen.queryByTestId('app-background-image-nutrition')).toBeNull();
  });
});

describe('ScreenBackdrop glow', () => {
  beforeEach(() => {
    jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(false);
    mockUseBackgroundTheme.mockReturnValue({ theme: BACKGROUND_THEMES.obsidian });
  });

  it('eases a soft glow of the given accent in from the top corner, fading to nothing', () => {
    render(
      <ScreenBackdrop accentColor="#2F80FF">
        <Text>page</Text>
      </ScreenBackdrop>,
    );

    const glow = screen.getByTestId('screen-backdrop-glow');
    expect(glow.props.colors).toHaveLength(2);
    expect(glow.props.colors[0]).toMatch(/^rgba\(47, 128, 255, 0\.\d+\)$/);
    expect(glow.props.colors[1]).toBe('rgba(47, 128, 255, 0)');
    // Faint: the first stop is well under half opacity.
    expect(Number(/, ([\d.]+)\)$/.exec(glow.props.colors[0])![1])).toBeLessThanOrEqual(0.25);
  });

  it('draws no glow when no accent is given, but keeps the gentle edge shade', () => {
    render(
      <ScreenBackdrop>
        <Text>page</Text>
      </ScreenBackdrop>,
    );

    expect(screen.queryByTestId('screen-backdrop-glow')).toBeNull();
    expect(screen.getByTestId('screen-backdrop-shade')).toBeTruthy();
  });

  it('keeps both layers behind the page and out of the way of touches', () => {
    render(
      <ScreenBackdrop accentColor="#2F80FF">
        <Text>page</Text>
      </ScreenBackdrop>,
    );

    const glow = screen.getByTestId('screen-backdrop-glow');
    let node = glow.parent;
    let sawNone = false;
    while (node) {
      if (node.props.pointerEvents === 'none') sawNone = true;
      node = node.parent;
    }
    expect(sawNone).toBe(true);
  });
});
