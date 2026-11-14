import { render, screen } from '@testing-library/react-native';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { SNOWFLAKES, Snowfall, snowflakes } from './Snowfall';

jest.mock('../navigation/navigationTransitions', () => ({
  useReduceMotionPreference: jest.fn(() => false),
}));

describe('Snowfall', () => {
  beforeEach(() => {
    jest.mocked(useReduceMotionPreference).mockReturnValue(false);
  });

  it('is a few small, see-through flakes over the screen that touches and VoiceOver pass by', () => {
    render(<Snowfall />);

    // Hidden from VoiceOver, so it's found among hidden elements.
    const snow = screen.getByTestId('snowfall', { includeHiddenElements: true });
    expect(snow.props.pointerEvents).toBe('none');
    expect(snow.props.accessibilityElementsHidden).toBe(true);
    expect(snow.props.importantForAccessibility).toBe('no-hide-descendants');
    const flakes = snow.props.children as unknown[];
    expect(flakes).toHaveLength(SNOWFLAKES);
    expect(SNOWFLAKES).toBeLessThanOrEqual(20);
  });

  it('keeps every flake small, faint and slow, so the app stays easy to read', () => {
    const flakes = snowflakes();

    expect(flakes).toHaveLength(SNOWFLAKES);
    for (const flake of flakes) {
      expect(flake.size).toBeLessThanOrEqual(6);
      expect(flake.opacity).toBeLessThanOrEqual(0.65);
      // At least 9 seconds from top to bottom.
      expect(flake.duration).toBeGreaterThanOrEqual(9000);
    }
    // The same flakes every time.
    expect(snowflakes()).toEqual(flakes);
  });

  it('shows nothing under Reduce Motion', () => {
    jest.mocked(useReduceMotionPreference).mockReturnValue(true);

    render(<Snowfall />);

    expect(screen.queryByTestId('snowfall', { includeHiddenElements: true })).toBeNull();
  });
});
