import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii } from '../design/theme';
import { FoodImage } from './FoodImage';

// The image is hidden from assistive tech on purpose, so queries must opt in to see it.
const HIDDEN = { includeHiddenElements: true };

describe('FoodImage', () => {
  it("shows the food's real photo when it has one", () => {
    render(<FoodImage testID="img" uri="https://images.example/oreo.jpg" name="Oreo" />);

    expect(screen.getByTestId('img-photo', HIDDEN).props.source).toEqual({
      uri: 'https://images.example/oreo.jpg',
    });
    expect(screen.UNSAFE_queryAllByType(MaterialCommunityIcons)).toHaveLength(0);
  });

  it('draws a category glyph, never a photo, when there is none', () => {
    render(<FoodImage testID="img" uri={null} name="Chicken Breast (cooked)" />);

    expect(screen.queryByTestId('img-photo', HIDDEN)).toBeNull();
    expect(screen.UNSAFE_getByType(MaterialCommunityIcons).props.name).toBe('food-drumstick');
  });

  it('falls back to the glyph when the photo fails to load', () => {
    render(<FoodImage testID="img" uri="https://images.example/broken.jpg" name="Banana" />);

    fireEvent(screen.getByTestId('img-photo', HIDDEN), 'error');

    expect(screen.queryByTestId('img-photo', HIDDEN)).toBeNull();
    expect(screen.UNSAFE_getByType(MaterialCommunityIcons).props.name).toBe('food-apple');
  });

  it('is a square raised tile with the control radius, sized as asked', () => {
    render(<FoodImage testID="img" name="Apple" size={96} />);

    const style = StyleSheet.flatten(screen.getByTestId('img', HIDDEN).props.style);
    expect(style.width).toBe(96);
    expect(style.height).toBe(96);
    expect(style.borderRadius).toBe(radii.md);
    expect(style.backgroundColor).toBe(colors.surfaceRaised);
  });

  it('is decorative: hidden from screen readers, since the name sits beside it', () => {
    render(<FoodImage testID="img" name="Apple" />);

    expect(screen.getByTestId('img', HIDDEN).props.importantForAccessibility).toBe(
      'no-hide-descendants',
    );
  });
});
