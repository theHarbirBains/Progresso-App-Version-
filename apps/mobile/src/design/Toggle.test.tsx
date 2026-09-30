import { fireEvent, render, screen } from '@testing-library/react-native';
import { Toggle } from './Toggle';

describe('Toggle', () => {
  it('reflects the current value', () => {
    render(
      <Toggle
        testID="toggle"
        value={true}
        onValueChange={jest.fn()}
        accessibilityLabel="Email opt-in"
      />,
    );

    expect(screen.getByTestId('toggle').props.value).toBe(true);
  });

  it('calls onValueChange with the flipped value', () => {
    const onValueChange = jest.fn();
    render(
      <Toggle
        testID="toggle"
        value={false}
        onValueChange={onValueChange}
        accessibilityLabel="Email opt-in"
      />,
    );

    fireEvent(screen.getByTestId('toggle'), 'valueChange', true);

    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('exposes an accessibility label and switch role', () => {
    render(
      <Toggle
        testID="toggle"
        value={false}
        onValueChange={jest.fn()}
        accessibilityLabel="Email opt-in"
      />,
    );

    const toggle = screen.getByTestId('toggle');
    expect(toggle.props.accessibilityLabel).toBe('Email opt-in');
    expect(toggle.props.accessibilityRole).toBe('switch');
  });

  it('is disabled when disabled is passed', () => {
    render(
      <Toggle
        testID="toggle"
        value={false}
        onValueChange={jest.fn()}
        accessibilityLabel="x"
        disabled
      />,
    );

    expect(screen.getByTestId('toggle').props.disabled).toBe(true);
  });

  // Regression guard: a white/near-white accentColor (the app's own default
  // Workout/Nutrition theme -- see accentColor.ts) makes an ON track white.
  // Without a contrast-safe thumb, the thumb -- default colors.textPrimary,
  // itself white -- disappears into that track entirely. onAccentColor
  // (computed to contrast against accentColor by buildAccentTheme) fixes
  // this; the default (colors.background, a plain dark dot) is the safe
  // fallback for a caller that hasn't been updated to pass one yet.
  it("uses onAccentColor for the ON thumb, so a white accent's toggle still shows a visible dot", () => {
    render(
      <Toggle
        testID="toggle"
        value={true}
        onValueChange={jest.fn()}
        accessibilityLabel="x"
        accentColor="#FFFFFF"
        onAccentColor="#0A0A0A"
      />,
    );

    // RN's Switch renders thumbColor down as the native thumbTintColor prop
    // on both platforms -- see Switch.js.
    expect(screen.getByTestId('toggle').props.thumbTintColor).toBe('#0A0A0A');
  });

  it('ignores onAccentColor while OFF -- the off-thumb never needs to match the on-accent', () => {
    render(
      <Toggle
        testID="toggle"
        value={false}
        onValueChange={jest.fn()}
        accessibilityLabel="x"
        accentColor="#FFFFFF"
        onAccentColor="#0A0A0A"
      />,
    );

    expect(screen.getByTestId('toggle').props.thumbTintColor).not.toBe('#0A0A0A');
  });
});
