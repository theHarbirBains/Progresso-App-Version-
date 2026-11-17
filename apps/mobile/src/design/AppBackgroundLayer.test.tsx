import { StyleSheet, Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { AppThemeContext, type AppThemeValue } from '../theme/appThemeContext';
import { buildAccentTheme } from '../theme/accentColor';
import { themeById } from '../theme/appThemes';
import { AppBackgroundLayer, ScreenBackdrop } from './AppBackgroundLayer';

const hidden = { includeHiddenElements: true };

function wearing(id: string) {
  const theme = themeById(id);
  return {
    theme,
    accent: buildAccentTheme(theme.accent),
  } as unknown as AppThemeValue;
}

describe('AppBackgroundLayer', () => {
  it("is the theme's plain colour with its design over it -- never a photo", () => {
    render(
      <AppThemeContext.Provider value={wearing('forest')}>
        <AppBackgroundLayer />
      </AppThemeContext.Provider>,
    );

    const layer = screen.getByTestId('app-background-layer', hidden);
    expect(StyleSheet.flatten(layer.props.style).backgroundColor).toBe('#0D1410');
    expect(layer.props.pointerEvents).toBe('none');
    expect(screen.getByTestId('app-background-pattern', hidden)).toBeTruthy();
    expect(screen.queryByTestId('app-background-photo', hidden)).toBeNull();
  });

  it('is only the plain colour for a theme with no design (Golden Hour Gym)', () => {
    render(
      <AppThemeContext.Provider value={wearing('golden-hour-gym')}>
        <AppBackgroundLayer />
      </AppThemeContext.Provider>,
    );

    expect(
      StyleSheet.flatten(screen.getByTestId('app-background-layer', hidden).props.style)
        .backgroundColor,
    ).toBe('#12110F');
    expect(screen.queryByTestId('app-background-pattern', hidden)).toBeNull();
  });
});

describe('ScreenBackdrop', () => {
  it("paints the theme's background and design under a screen's own content, opaque", () => {
    render(
      <AppThemeContext.Provider value={wearing('holiday-gym')}>
        <ScreenBackdrop>
          <Text>Page</Text>
        </ScreenBackdrop>
      </AppThemeContext.Provider>,
    );

    const backdrop = screen.getByTestId('screen-backdrop');
    expect(StyleSheet.flatten(backdrop.props.style)).toMatchObject({
      flex: 1,
      backgroundColor: '#0D1511',
    });
    expect(screen.getByTestId('screen-backdrop-pattern', hidden)).toBeTruthy();
    expect(screen.getByText('Page')).toBeTruthy();
  });
});
