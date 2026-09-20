import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors, radii } from './theme';
import { DestructiveButton, PrimaryButton, SecondaryButton, TextButton } from './Button';

describe('Button variants', () => {
  it.each([
    ['PrimaryButton', PrimaryButton],
    ['SecondaryButton', SecondaryButton],
    ['DestructiveButton', DestructiveButton],
    ['TextButton', TextButton],
  ])('%s renders its label and calls onPress when tapped', (_name, Component) => {
    const onPress = jest.fn();
    render(<Component label="Do it" onPress={onPress} testID="btn" />);

    expect(screen.getByText('Do it')).toBeTruthy();
    fireEvent.press(screen.getByTestId('btn'));

    expect(onPress).toHaveBeenCalled();
  });

  it.each([
    ['PrimaryButton', PrimaryButton],
    ['SecondaryButton', SecondaryButton],
    ['DestructiveButton', DestructiveButton],
    ['TextButton', TextButton],
  ])('%s does not call onPress when disabled', (_name, Component) => {
    const onPress = jest.fn();
    render(<Component label="Do it" onPress={onPress} disabled testID="btn" />);

    fireEvent.press(screen.getByTestId('btn'));

    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('PrimaryButton accent color', () => {
  it('defaults to the static brand accent when no accentColor is given', () => {
    render(<PrimaryButton label="Do it" onPress={jest.fn()} testID="btn" />);

    const style = StyleSheet.flatten(screen.getByTestId('btn').props.style);
    expect(style.backgroundColor).toBe(colors.accent);
  });

  it("uses the user's own accent color and its contrasting text color when given", () => {
    render(
      <PrimaryButton
        label="Do it"
        onPress={jest.fn()}
        testID="btn"
        accentColor="#FF6600"
        onAccentColor="#000000"
      />,
    );

    const buttonStyle = StyleSheet.flatten(screen.getByTestId('btn').props.style);
    expect(buttonStyle.backgroundColor).toBe('#FF6600');

    const labelStyle = StyleSheet.flatten(screen.getByText('Do it').props.style);
    expect(labelStyle.color).toBe('#000000');
  });

  it('immediately reflects a changed accent color on re-render, without remounting', () => {
    const { rerender } = render(
      <PrimaryButton label="Do it" onPress={jest.fn()} testID="btn" accentColor="#FF6600" />,
    );
    expect(StyleSheet.flatten(screen.getByTestId('btn').props.style).backgroundColor).toBe(
      '#FF6600',
    );

    rerender(
      <PrimaryButton label="Do it" onPress={jest.fn()} testID="btn" accentColor="#00AAFF" />,
    );
    expect(StyleSheet.flatten(screen.getByTestId('btn').props.style).backgroundColor).toBe(
      '#00AAFF',
    );
  });
});

describe('Button sizing, loading and accessibility', () => {
  it('is announced as a button, labelled by its own text, with disabled/busy state', () => {
    render(<PrimaryButton label="Save workout" onPress={jest.fn()} testID="btn" />);

    const btn = screen.getByTestId('btn');
    expect(btn.props.accessibilityRole).toBe('button');
    expect(btn.props.accessibilityLabel).toBe('Save workout');
    expect(btn.props.accessibilityState).toEqual({ disabled: false, busy: false });
  });

  it('lets a caller override the accessibility label', () => {
    render(
      <SecondaryButton
        label="Edit"
        accessibilityLabel="Edit Push Day split"
        onPress={jest.fn()}
        testID="btn"
      />,
    );

    expect(screen.getByTestId('btn').props.accessibilityLabel).toBe('Edit Push Day split');
  });

  it.each([
    ['PrimaryButton', PrimaryButton],
    ['SecondaryButton', SecondaryButton],
    ['DestructiveButton', DestructiveButton],
    ['TextButton', TextButton],
  ])('%s shows a spinner instead of its label while loading, and ignores presses', (_n, C) => {
    const onPress = jest.fn();
    render(<C label="Save" onPress={onPress} loading testID="btn" />);

    expect(screen.queryByText('Save')).toBeNull();
    fireEvent.press(screen.getByTestId('btn'));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('btn').props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
  });

  it.each([
    ['lg', 52],
    ['md', 44],
    ['sm', 36],
  ] as const)('the %s size is %spt tall', (size, height) => {
    render(<PrimaryButton label="Go" size={size} onPress={jest.fn()} testID="btn" />);

    expect(StyleSheet.flatten(screen.getByTestId('btn').props.style).minHeight).toBe(height);
  });

  it('still exposes a 44pt touch area on the compact size, by extending the hit area', () => {
    render(<PrimaryButton label="Go" size="sm" onPress={jest.fn()} testID="btn" />);

    const btn = screen.getByTestId('btn');
    const visible = StyleSheet.flatten(btn.props.style).minHeight as number;
    const slop = btn.props.hitSlop as { top: number; bottom: number };
    expect(visible + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
  });

  it('defaults to the large size', () => {
    render(<PrimaryButton label="Go" onPress={jest.fn()} testID="btn" />);

    expect(StyleSheet.flatten(screen.getByTestId('btn').props.style).minHeight).toBe(52);
  });

  it('uses the control radius, which sits below a card surface radius', () => {
    render(<PrimaryButton label="Go" onPress={jest.fn()} testID="btn" />);

    const radius = StyleSheet.flatten(screen.getByTestId('btn').props.style).borderRadius;
    expect(radius).toBe(radii.md);
    expect(radii.lg).toBeGreaterThan(radii.md);
  });

  it('gives a text-only button a full 44pt touch target', () => {
    render(<TextButton label="Skip" onPress={jest.fn()} testID="btn" />);

    expect(StyleSheet.flatten(screen.getByTestId('btn').props.style).minHeight).toBe(44);
  });

  it('renders every label in a Manrope face, never the system font', () => {
    render(<PrimaryButton label="Go" onPress={jest.fn()} />);

    expect(String(StyleSheet.flatten(screen.getByText('Go').props.style).fontFamily)).toMatch(
      /^Manrope_/,
    );
  });
});

describe('TextButton -- destructive', () => {
  it('tints the label with the destructive color, and stays a normal quiet link otherwise', () => {
    render(
      <>
        <TextButton testID="delete" label="Delete" destructive onPress={jest.fn()} />
        <TextButton testID="edit" label="Edit" onPress={jest.fn()} />
      </>,
    );

    const label = (id: string, text: string) =>
      StyleSheet.flatten(within(screen.getByTestId(id)).getByText(text).props.style);
    expect(label('delete', 'Delete').color).toBe(colors.destructive);
    expect(label('edit', 'Edit').color).toBe(colors.textSecondary);
  });

  it('is still a 44pt target and still fires onPress when destructive', () => {
    const onPress = jest.fn();
    render(<TextButton testID="delete" label="Delete" destructive onPress={onPress} />);

    expect(StyleSheet.flatten(screen.getByTestId('delete').props.style).minHeight).toBe(44);
    fireEvent.press(screen.getByTestId('delete'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
