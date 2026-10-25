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

  describe('zoomable', () => {
    it('opens a real photo full screen when tapped, and closes it', () => {
      render(<FoodImage testID="img" uri="https://images.example/oreo.jpg" name="Oreo" zoomable />);

      expect(screen.queryByTestId('img-lightbox')).toBeNull();
      fireEvent.press(screen.getByLabelText('View Oreo photo'));
      expect(screen.getByTestId('img-lightbox')).toBeTruthy();

      fireEvent.press(screen.getByTestId('img-lightbox-close'));
      expect(screen.queryByTestId('img-lightbox')).toBeNull();
    });

    it('lets the photo be pinched in and dragged around', () => {
      render(<FoodImage testID="img" uri="https://images.example/oreo.jpg" name="Oreo" zoomable />);
      fireEvent.press(screen.getByTestId('img-zoom'));

      const zoom = screen.getByTestId('img-lightbox-zoom');
      expect(zoom.props.maximumZoomScale).toBeGreaterThan(1);
      expect(zoom.props.minimumZoomScale).toBe(1);
    });

    it('has nothing to open for a glyph, or a photo that failed to load', () => {
      const { unmount } = render(<FoodImage testID="img" uri={null} name="Oreo" zoomable />);
      expect(screen.queryByTestId('img-zoom')).toBeNull();
      unmount();

      render(
        <FoodImage testID="img" uri="https://images.example/broken.jpg" name="Oreo" zoomable />,
      );
      fireEvent(screen.getByTestId('img-photo', HIDDEN), 'error');
      expect(screen.queryByTestId('img-zoom')).toBeNull();
    });

    it("opens nothing unless asked to -- in a row, the tap is the row's", () => {
      render(<FoodImage testID="img" uri="https://images.example/oreo.jpg" name="Oreo" />);

      expect(screen.queryByTestId('img-zoom')).toBeNull();
    });
  });
});
