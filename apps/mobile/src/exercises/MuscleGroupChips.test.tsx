import { ScrollView, StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MuscleGroupChips } from './MuscleGroupChips';

describe('MuscleGroupChips', () => {
  // Regression test for the "chips render as skinny/empty bubbles" bug:
  // react-test-renderer never runs a real layout pass, so it can't catch a
  // clipped label directly -- but the actual defect was a missing
  // alignItems: 'center' on the horizontal row's content container (DESIGN.md
  // §12's documented "tabs-row layout trap": without it, the row's
  // cross-axis defaults to 'stretch', squashing every chip to whatever
  // near-zero height the row resolves to). Asserting the real fix directly
  // guards against it silently regressing again.
  it("sets alignItems: 'center' on the horizontal row so chips are never stretched to a clipped height", () => {
    render(<MuscleGroupChips value={null} onChange={jest.fn()} includeAll />);

    const scrollView = screen.UNSAFE_getByType(ScrollView);
    const contentStyle = StyleSheet.flatten(scrollView.props.contentContainerStyle);
    expect(contentStyle.alignItems).toBe('center');
  });

  // The chip row kept reappearing as clipped/invisible even after the
  // alignItems fix above, so every dimension a label's visibility depends
  // on is now made explicit rather than left to intrinsic/platform sizing
  // (which react-test-renderer can't verify, but these concrete style
  // values can be asserted and guarded against regressing). Deliberately
  // NOT a hardcoded lineHeight/numberOfLines here -- a lineHeight smaller
  // than the font's actual rendered line box would clip the label just as
  // badly as the original bug, so the fix only ever adds headroom
  // (minHeight + centering), never constrains the label's own line box.
  it('gives every chip and its label explicit, non-collapsible sizing (flexShrink/minHeight)', () => {
    render(<MuscleGroupChips value={null} onChange={jest.fn()} includeAll />);

    const chip = screen.getByTestId('muscle-group-chip-shoulders');
    const chipStyle = StyleSheet.flatten(chip.props.style);
    expect(chipStyle.flexShrink).toBe(0);
    expect(chipStyle.minHeight).toBeGreaterThanOrEqual(36);
    expect(chipStyle.justifyContent).toBe('center');

    const label = screen.getByText('Shoulders');
    const labelStyle = StyleSheet.flatten(label.props.style);
    expect(labelStyle.flexShrink).toBe(0);
  });

  // Regression test for "chips are crammed together horizontally": the row's
  // inter-chip spacing and each chip's own horizontal padding must come from
  // DESIGN.md's spacing tokens (12/16), not the shared exerciseStyles.ts
  // legacy hardcoded values (gap: 8, paddingHorizontal: 14) which read as
  // cramped once the earlier visibility fix made the labels readable again.
  it('gives the row a token-based gap and each chip token-based horizontal padding, not the cramped legacy values', () => {
    render(<MuscleGroupChips value={null} onChange={jest.fn()} includeAll />);

    const scrollView = screen.UNSAFE_getByType(ScrollView);
    const contentStyle = StyleSheet.flatten(scrollView.props.contentContainerStyle);
    expect(contentStyle.gap).toBe(12);

    const chip = screen.getByTestId('muscle-group-chip-shoulders');
    const chipStyle = StyleSheet.flatten(chip.props.style);
    expect(chipStyle.paddingHorizontal).toBe(16);
  });

  it('calls onChange with the pressed muscle group', () => {
    const onChange = jest.fn();
    render(<MuscleGroupChips value={null} onChange={onChange} />);

    fireEvent.press(screen.getByTestId('muscle-group-chip-chest'));

    expect(onChange).toHaveBeenCalledWith('chest');
  });

  it('includes a leading "All" chip only when includeAll is set', () => {
    render(<MuscleGroupChips value={null} onChange={jest.fn()} includeAll />);
    expect(screen.getByTestId('muscle-group-chip-all')).toBeTruthy();
  });

  it('uses the existing static selected look when no accentColor is given', () => {
    render(<MuscleGroupChips value="chest" onChange={jest.fn()} />);

    const chip = screen.getByTestId('muscle-group-chip-chest');
    const flat = StyleSheet.flatten(chip.props.style);
    expect(flat.backgroundColor).toBe('#FFFFFF');
  });

  it("follows the given accentColor/onAccentColor for the selected chip instead of the static color", () => {
    render(
      <MuscleGroupChips
        value="chest"
        onChange={jest.fn()}
        accentColor="#8B5CF6"
        onAccentColor="#0A0A0A"
      />,
    );

    const chip = screen.getByTestId('muscle-group-chip-chest');
    const flat = StyleSheet.flatten(chip.props.style);
    expect(flat.backgroundColor).toBe('#8B5CF6');

    const label = screen.getByText('Chest');
    const labelFlat = StyleSheet.flatten(label.props.style);
    expect(labelFlat.color).toBe('#0A0A0A');
  });

  it('follows chipBorderColor/chipTextColor for the UNSELECTED chip look, leaving the selected chip untouched', () => {
    render(
      <MuscleGroupChips
        value="chest"
        onChange={jest.fn()}
        includeAll
        chipBorderColor="#212B2D"
        chipTextColor="#8FA0A2"
      />,
    );

    const unselected = screen.getByTestId('muscle-group-chip-back');
    expect(StyleSheet.flatten(unselected.props.style).borderColor).toBe('#212B2D');
    expect(StyleSheet.flatten(screen.getByText('Back').props.style).color).toBe('#8FA0A2');

    // The selected chip keeps its own (static, in this case) selected look --
    // chipBorderColor/chipTextColor only ever apply to unselected chips.
    const selected = screen.getByTestId('muscle-group-chip-chest');
    expect(StyleSheet.flatten(selected.props.style).backgroundColor).toBe('#FFFFFF');
  });

  it('marks the selected chip with accessibilityState', () => {
    render(<MuscleGroupChips value="chest" onChange={jest.fn()} />);

    expect(
      screen.getByTestId('muscle-group-chip-chest').props.accessibilityState.selected,
    ).toBe(true);
    expect(
      screen.getByTestId('muscle-group-chip-back').props.accessibilityState.selected,
    ).toBe(false);
  });
});
