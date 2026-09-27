import { render, screen } from '@testing-library/react-native';
import { Circle } from 'react-native-svg';
import { CalorieRing } from './CalorieRing';

// The value/unit text is deliberately hidden from the accessibility tree
// (importantForAccessibility="no-hide-descendants" -- the ring's own single
// accessibilityLabel covers it, so a screen reader doesn't hear it twice);
// every query below that reaches into that text passes
// includeHiddenElements so it isn't itself treated as absent.
const includeHidden = { includeHiddenElements: true };

describe('CalorieRing', () => {
  it('shows the consumed number and the goal', () => {
    render(<CalorieRing testID="ring" consumed={1200} goal={2000} accentColor="#FFFFFF" />);

    expect(screen.getByTestId('ring-value', includeHidden)).toHaveTextContent('1200');
    expect(screen.getByTestId('ring', includeHidden)).toHaveTextContent(/of 2000 cal/);
  });

  it('falls back to a plain "cal" label, with no fraction filled, when no goal is set', () => {
    render(<CalorieRing testID="ring" consumed={450} goal={null} accentColor="#FFFFFF" />);

    expect(screen.getByTestId('ring-value', includeHidden)).toHaveTextContent('450');
    expect(screen.getByTestId('ring', includeHidden)).toHaveTextContent(/^450cal$/);

    const [, fill] = screen.UNSAFE_getAllByType(Circle);
    const circumference = Number(String(fill.props.strokeDasharray).split(' ')[0]);
    expect(fill.props.strokeDashoffset).toBeCloseTo(circumference);
  });

  it('fills proportionally to consumed/goal', () => {
    render(<CalorieRing testID="ring" consumed={1000} goal={2000} accentColor="#FFFFFF" />);

    const [, fill] = screen.UNSAFE_getAllByType(Circle);
    const circumference = Number(String(fill.props.strokeDasharray).split(' ')[0]);
    // Half the goal eaten -- half the ring's circumference should be drawn,
    // i.e. the offset (the undrawn remainder) is the other half.
    expect(fill.props.strokeDashoffset).toBeCloseTo(circumference / 2);
  });

  it('caps the fill at a full ring once consumed exceeds the goal, rather than overshooting', () => {
    render(<CalorieRing testID="ring" consumed={2500} goal={2000} accentColor="#FFFFFF" />);

    const [, fill] = screen.UNSAFE_getAllByType(Circle);
    expect(fill.props.strokeDashoffset).toBeCloseTo(0);
  });

  it('gives the whole ring one accessible label instead of exposing the SVG to screen readers', () => {
    render(<CalorieRing testID="ring" consumed={1200} goal={2000} accentColor="#FFFFFF" />);

    expect(screen.getByTestId('ring').props.accessibilityLabel).toBe(
      '1200 of 2000 calories logged today',
    );
  });
});
