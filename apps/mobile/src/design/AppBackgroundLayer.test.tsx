import { StyleSheet, Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { AppBackgroundLayer, ScreenBackdrop } from './AppBackgroundLayer';
import { colors } from './theme';

const hidden = { includeHiddenElements: true };

describe('AppBackgroundLayer', () => {
  it('is one plain colour -- the fill the text was chosen against -- with no photo, glow or shade', () => {
    render(<AppBackgroundLayer />);

    const layer = screen.getByTestId('app-background-layer', hidden);
    expect(StyleSheet.flatten(layer.props.style).backgroundColor).toBe(colors.background);
    expect(layer.props.pointerEvents).toBe('none');
    expect(screen.queryByTestId('app-background-photo', hidden)).toBeNull();
    expect(screen.queryByTestId('app-background-glow', hidden)).toBeNull();
    expect(screen.queryByTestId('app-background-shade', hidden)).toBeNull();
  });
});

describe('ScreenBackdrop', () => {
  it("paints the same plain fill under a screen's own content, opaque, so a push never shows through", () => {
    render(
      <ScreenBackdrop>
        <Text>Page</Text>
      </ScreenBackdrop>,
    );

    const backdrop = screen.getByTestId('screen-backdrop');
    expect(StyleSheet.flatten(backdrop.props.style)).toMatchObject({
      flex: 1,
      backgroundColor: colors.background,
    });
    expect(screen.getByText('Page')).toBeTruthy();
    expect(screen.queryByTestId('screen-backdrop-photo', hidden)).toBeNull();
  });
});
