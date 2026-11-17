import { Animated, StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { DayBar } from './DayBar';

function renderBar(day: string) {
  return render(
    <DayBar
      day={day}
      slide={new Animated.Value(0)}
      width={390}
      onChooseDay={jest.fn()}
      onAdjust={jest.fn()}
      accentColor="#EBC27C"
    />,
  );
}

describe('DayBar', () => {
  it("shows the week's days as dots under the date, the day shown a pill in the accent", () => {
    // Wednesday, November 18, 2026: the fourth of its week, Sunday first.
    renderBar('2026-11-18');

    for (let index = 0; index < 7; index += 1) {
      const style = StyleSheet.flatten(
        screen.getByTestId(`nutrition-day-dot-${index}`, { includeHiddenElements: true }).props
          .style,
      );
      if (index === 3) {
        expect(style).toMatchObject({ width: 14, backgroundColor: '#EBC27C' });
      } else {
        expect(style.width).toBe(6);
        expect(style.backgroundColor).not.toBe('#EBC27C');
      }
    }
  });

  it('keeps the dots out of what VoiceOver reads -- the day itself is the control', () => {
    renderBar('2026-11-22');

    expect(screen.queryByTestId('nutrition-day-dots')).toBeNull();
    expect(screen.getByTestId('nutrition-day-dots', { includeHiddenElements: true })).toBeTruthy();
    // A Sunday: the first dot.
    expect(
      StyleSheet.flatten(
        screen.getByTestId('nutrition-day-dot-0', { includeHiddenElements: true }).props.style,
      ).width,
    ).toBe(14);
  });
});
