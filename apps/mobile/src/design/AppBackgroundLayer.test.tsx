import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import * as navigationTransitions from '../navigation/navigationTransitions';
import { AppBackgroundLayer, ScreenBackdrop, useHeroBackdrop } from './AppBackgroundLayer';
import { colors } from './theme';

const alphaOf = (rgba: string) => Number(/, ([\d.]+)\)$/.exec(rgba)![1]);

// How dark the photo's top is: the hero darkening, plus the everyday layer at its opacity.
function topDarkness(prefix: string) {
  const hero = alphaOf(screen.getByTestId(`${prefix}-photo-fade`).props.colors[0]);
  const everydayLayer = screen.getByTestId(`${prefix}-photo-everyday`);
  const opacity = StyleSheet.flatten(everydayLayer.props.style).opacity as number;
  const extra = alphaOf(everydayLayer.children[0].props.colors[0]) * opacity;
  return 1 - (1 - hero) * (1 - extra);
}

beforeEach(() => {
  // Brightening is instant with Reduce Motion, so the end state is checked without timers.
  jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(true);
});

describe('AppBackgroundLayer', () => {
  it('is non-interactive (pointerEvents="none") so it never intercepts touches', () => {
    render(<AppBackgroundLayer />);

    expect(screen.getByTestId('app-background-layer').props.pointerEvents).toBe('none');
  });

  it('puts the sunset photo across the top, a little zoomed and pinned left, before sign-in too', () => {
    render(<AppBackgroundLayer showAtmosphere={false} />);

    const photo = StyleSheet.flatten(screen.getByTestId('app-background-photo').props.style);
    expect(photo).toMatchObject({ position: 'absolute', top: 0, left: 0, width: '125%' });
    expect(photo.aspectRatio).toBeGreaterThan(0);
    // The zoomed photo runs past the right edge, so the layer clips it.
    expect(
      StyleSheet.flatten(screen.getByTestId('app-background-layer').props.style).overflow,
    ).toBe('hidden');
  });

  it('darkens the photo to 70% for legibility and fades it into the solid warm background', () => {
    render(<AppBackgroundLayer />);

    expect(topDarkness('app-background')).toBeCloseTo(0.7, 2);
    // Fully the warm fill at the photo's bottom edge.
    const fade = screen.getByTestId('app-background-photo-fade');
    expect(fade.props.colors[fade.props.colors.length - 1]).toBe('rgba(18, 17, 15, 1)');
  });

  it('darkens the text side and the header band, leaving the sun side of the photo clear', () => {
    render(<AppBackgroundLayer />);

    const side = screen.getByTestId('app-background-side-scrim');
    expect(side.props.start).toEqual({ x: 0, y: 0 });
    expect(side.props.end).toEqual({ x: 1, y: 0 });
    expect(alphaOf(side.props.colors[0])).toBeGreaterThan(0.5);
    expect(alphaOf(side.props.colors[side.props.colors.length - 1])).toBe(0);
    const band = screen.getByTestId('app-background-header-band');
    expect(alphaOf(band.props.colors[0])).toBe(0.5);
    expect(alphaOf(band.props.colors[band.props.colors.length - 1])).toBe(0);
  });
});

describe('AppBackgroundLayer atmosphere', () => {
  const opacity = (testID: string) =>
    StyleSheet.flatten(screen.getByTestId(testID).props.style).opacity;

  it('draws the same glow and shade as every page, in the given accent', () => {
    render(<AppBackgroundLayer accentColor="#D99A50" />);

    expect(screen.getByTestId('app-background-glow').props.colors[0]).toBe(
      'rgba(217, 154, 80, 0.08)',
    );
    expect(screen.getByTestId('app-background-shade')).toBeTruthy();
    expect(opacity('app-background-atmosphere')).toBe(1);
  });

  it('draws no glow without an accent, but keeps the gentle edge shade', () => {
    render(<AppBackgroundLayer />);

    expect(screen.queryByTestId('app-background-glow')).toBeNull();
    expect(screen.getByTestId('app-background-shade')).toBeTruthy();
  });

  it('hides the atmosphere (staying mounted) when showAtmosphere is false', () => {
    const { rerender } = render(
      <AppBackgroundLayer accentColor="#D99A50" showAtmosphere={false} />,
    );
    expect(opacity('app-background-atmosphere')).toBe(0);

    rerender(<AppBackgroundLayer accentColor="#D99A50" showAtmosphere />);
    expect(opacity('app-background-atmosphere')).toBe(1);
  });
});

describe('ScreenBackdrop', () => {
  it('paints the warm background fully opaque, so nothing behind it can show through', () => {
    render(
      <ScreenBackdrop>
        <Text>page</Text>
      </ScreenBackdrop>,
    );

    const style = StyleSheet.flatten(screen.getByTestId('screen-backdrop').props.style);
    expect(style.backgroundColor).toBe(colors.background);
    expect(style.opacity).toBeUndefined();
  });

  it('fills its screen and renders the page on top of the photo', () => {
    render(
      <ScreenBackdrop>
        <Text>page</Text>
      </ScreenBackdrop>,
    );

    expect(StyleSheet.flatten(screen.getByTestId('screen-backdrop').props.style).flex).toBe(1);
    expect(screen.getByTestId('screen-backdrop-photo')).toBeTruthy();
    expect(screen.getByText('page')).toBeTruthy();
  });
});

describe('ScreenBackdrop glow', () => {
  it('eases a soft glow of the given accent in from the top corner, fading to nothing', () => {
    render(
      <ScreenBackdrop accentColor="#D99A50">
        <Text>page</Text>
      </ScreenBackdrop>,
    );

    const glow = screen.getByTestId('screen-backdrop-glow');
    expect(glow.props.colors).toHaveLength(2);
    expect(glow.props.colors[0]).toMatch(/^rgba\(217, 154, 80, 0\.\d+\)$/);
    expect(glow.props.colors[1]).toBe('rgba(217, 154, 80, 0)');
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

  it('keeps the photo and both layers behind the page and out of the way of touches', () => {
    render(
      <ScreenBackdrop accentColor="#D99A50">
        <Text>page</Text>
      </ScreenBackdrop>,
    );

    for (const testID of ['screen-backdrop-glow', 'screen-backdrop-photo']) {
      let node = screen.getByTestId(testID).parent;
      let sawNone = false;
      while (node) {
        if (node.props.pointerEvents === 'none') sawNone = true;
        node = node.parent;
      }
      expect(sawNone).toBe(true);
    }
  });
});

function Hero() {
  useHeroBackdrop(true);
  return <Text>hero</Text>;
}

describe('ScreenBackdrop behind a photo hero', () => {
  it('keeps the everyday 70% darkening when no hero is on the screen', () => {
    render(
      <ScreenBackdrop>
        <Text>page</Text>
      </ScreenBackdrop>,
    );

    expect(topDarkness('screen-backdrop')).toBeCloseTo(0.7, 2);
  });

  it('shows the sunset almost in full (10% darkening) while a hero is on the screen, and back when it goes', () => {
    const { rerender } = render(
      <ScreenBackdrop>
        <Hero />
      </ScreenBackdrop>,
    );
    expect(topDarkness('screen-backdrop')).toBeCloseTo(0.1, 2);

    rerender(
      <ScreenBackdrop>
        <Text>page</Text>
      </ScreenBackdrop>,
    );
    expect(topDarkness('screen-backdrop')).toBeCloseTo(0.7, 2);
  });

  it('is a no-op outside a backdrop', () => {
    expect(() => render(<Hero />)).not.toThrow();
  });
});
