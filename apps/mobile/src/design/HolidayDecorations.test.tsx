import { render, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { Ellipse } from 'react-native-svg';
import { colors } from './theme';
import { bulbCount, HolidayLights, LIGHT_COLORS, SantaHat } from './HolidayDecorations';

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
