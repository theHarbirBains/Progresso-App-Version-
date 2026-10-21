import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AnimatedBar } from './AnimatedBar';
import { colors } from './theme';

// The bar is hidden from screen readers, so it's only found by asking for hidden elements too.
const HIDDEN = { includeHiddenElements: true };

describe('AnimatedBar', () => {
  it('draws a fill in the given colour on a quiet track, hidden from screen readers', () => {
    render(<AnimatedBar testID="bar" fraction={0.5} color="#D99A50" />);

    const fill = screen.getByTestId('bar', HIDDEN);
    expect(StyleSheet.flatten(fill.props.style).backgroundColor).toBe('#D99A50');
    const track = screen.getByTestId('bar-track', HIDDEN);
    expect(StyleSheet.flatten(track.props.style).backgroundColor).toBe(colors.surfaceRaised);
    expect(track.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it("doesn't draw the fill until the track's width is known, so it never flashes full", () => {
    render(<AnimatedBar testID="bar" fraction={0.5} color="#D99A50" />);

    const fill = screen.getByTestId('bar', HIDDEN);
    expect(StyleSheet.flatten(fill.props.style).opacity).toBe(0);
    fireEvent(screen.getByTestId('bar-track', HIDDEN), 'layout', {
      nativeEvent: { layout: { width: 200 } },
    });
    expect(StyleSheet.flatten(screen.getByTestId('bar', HIDDEN).props.style).opacity).toBe(1);
  });

  it('is 4pt thick by default and 8pt for a widget’s one figure', () => {
    const { rerender } = render(<AnimatedBar testID="bar" fraction={1} color="#D99A50" />);
    expect(StyleSheet.flatten(screen.getByTestId('bar-track', HIDDEN).props.style).height).toBe(4);

    rerender(<AnimatedBar testID="bar" fraction={1} color="#D99A50" height={8} />);
    expect(StyleSheet.flatten(screen.getByTestId('bar-track', HIDDEN).props.style).height).toBe(8);
  });
});
