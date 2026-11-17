import { render, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import * as navigationTransitions from '../navigation/navigationTransitions';
import { Ellipse } from 'react-native-svg';
import { colors } from './theme';
import {
  bulbCount,
  CandyStripes,
  HolidayGarland,
  HolidayLights,
  LIGHT_COLORS,
  LIGHTS_HEIGHT,
  SantaHat,
  SnowCap,
} from './HolidayDecorations';

const hidden = { includeHiddenElements: true };

describe('SantaHat', () => {
  it('is only decoration: touches pass through it and assistive tech never meets it', () => {
    render(<SantaHat />);

    expect(screen.queryByTestId('santa-hat')).toBeNull();
    const hat = screen.getByTestId('santa-hat', hidden);
    expect(hat.props.pointerEvents).toBe('none');
    expect(hat.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});

describe('HolidayLights', () => {
  it('hangs about one bulb every 39 points, and always at least one', () => {
    expect(bulbCount(390)).toBe(10);
    expect(bulbCount(430)).toBe(11);
    expect(bulbCount(10)).toBe(1);
  });

  it('strings them across the screen in turn, red, green, gold and blue', () => {
    render(<HolidayLights />);

    const bulbs = screen.UNSAFE_getAllByType(Ellipse);
    expect(bulbs).toHaveLength(bulbCount(Dimensions.get('window').width));
    expect(bulbs.slice(0, 5).map((bulb) => bulb.props.fill)).toEqual([
      colors.destructive,
      LIGHT_COLORS[1],
      LIGHT_COLORS[2],
      LIGHT_COLORS[3],
      colors.destructive,
    ]);
  });

  it('is only decoration, like the hat', () => {
    render(<HolidayLights />);

    const lights = screen.getByTestId('holiday-lights', hidden);
    expect(lights.props.pointerEvents).toBe('none');
    expect(lights.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});

describe('HolidayGarland', () => {
  const insets = (top: number) => ({ top, bottom: 34, left: 0, right: 0 });

  it('hangs across the top of the screen just under the status bar, never over a title', () => {
    const { rerender } = render(
      <SafeAreaInsetsContext.Provider value={insets(59)}>
        <HolidayGarland />
      </SafeAreaInsetsContext.Provider>,
    );
    const garland = () => screen.getByTestId('holiday-garland', hidden);
    // With an island or a notch, in the status bar's own space, below its clock and battery.
    expect(StyleSheet.flatten(garland().props.style).top).toBe(59 - LIGHTS_HEIGHT);
    expect(garland().props.pointerEvents).toBe('none');

    // Without one, under the bar itself.
    rerender(
      <SafeAreaInsetsContext.Provider value={insets(20)}>
        <HolidayGarland />
      </SafeAreaInsetsContext.Provider>,
    );
    expect(StyleSheet.flatten(garland().props.style).top).toBe(20);
  });

  it('twinkles -- every other bulb brightening in turn -- and is simply lit under Reduce Motion', () => {
    jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(false);
    const { unmount } = render(<HolidayGarland />);
    expect(screen.getByTestId('holiday-garland-set-0', hidden)).toBeTruthy();
    expect(screen.getByTestId('holiday-garland-set-1', hidden)).toBeTruthy();
    unmount();

    jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(true);
    render(<HolidayGarland />);
    expect(screen.queryByTestId('holiday-garland-set-0', hidden)).toBeNull();
    expect(screen.UNSAFE_getAllByType(Ellipse).length).toBe(
      bulbCount(Dimensions.get('window').width),
    );
    jest.restoreAllMocks();
  });
});

describe('SnowCap and CandyStripes', () => {
  it('are only decoration: touches pass through and assistive tech never meets them', () => {
    render(
      <>
        <SnowCap testID="snow" />
        <CandyStripes testID="stripes" radius={4} />
      </>,
    );
    for (const id of ['snow', 'stripes']) {
      const node = screen.getByTestId(id, hidden);
      expect(node.props.pointerEvents).toBe('none');
      expect(node.props.accessibilityElementsHidden).toBe(true);
    }
    // The stripes are trimmed to the bar's rounded ends.
    expect(StyleSheet.flatten(screen.getByTestId('stripes', hidden).props.style)).toMatchObject({
      borderRadius: 4,
      overflow: 'hidden',
    });
  });
});
