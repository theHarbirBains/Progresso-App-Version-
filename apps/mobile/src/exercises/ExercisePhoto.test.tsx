import { fireEvent, render, screen } from '@testing-library/react-native';
import { ExercisePhoto } from './ExercisePhoto';

describe('ExercisePhoto', () => {
  it('renders the photo plainly, with no zoom touch target, when there is none', () => {
    render(<ExercisePhoto testID="photo" uri={null} name="Barbell Bench Press" />);

    expect(screen.getByTestId('photo')).toBeTruthy();
    expect(screen.queryByTestId('photo-zoom')).toBeNull();
    expect(screen.queryByTestId('photo-lightbox')).toBeNull();
  });

  it('opens a full-screen view of the photo when tapped', () => {
    render(<ExercisePhoto testID="photo" uri="https://example.com/machine.jpg" name="Leg Press" />);

    expect(screen.queryByTestId('photo-lightbox')).toBeNull();

    fireEvent.press(screen.getByTestId('photo-zoom'));

    const lightbox = screen.getByTestId('photo-lightbox');
    expect(lightbox).toBeTruthy();
  });

  it('closes the lightbox when its close button is pressed', () => {
    render(<ExercisePhoto testID="photo" uri="https://example.com/machine.jpg" name="Leg Press" />);

    fireEvent.press(screen.getByTestId('photo-zoom'));
    expect(screen.getByTestId('photo-lightbox')).toBeTruthy();

    fireEvent.press(screen.getByTestId('photo-lightbox-close'));

    expect(screen.queryByTestId('photo-lightbox')).toBeNull();
  });

  it("labels the zoom touch target by the exercise's name", () => {
    render(<ExercisePhoto testID="photo" uri="https://example.com/machine.jpg" name="Leg Press" />);

    expect(screen.getByTestId('photo-zoom').props.accessibilityLabel).toBe('View Leg Press photo');
  });
});
