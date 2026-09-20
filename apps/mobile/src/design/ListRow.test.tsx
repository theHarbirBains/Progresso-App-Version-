import { StyleSheet, Text as RNText } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ListRow } from './ListRow';
import { colors, fonts } from './theme';

describe('ListRow', () => {
  it('renders the title and subtitle', () => {
    render(<ListRow testID="row" title="Bench Press" subtitle="Chest · 4 sets" />);

    expect(screen.getByText('Bench Press')).toBeTruthy();
    expect(screen.getByText('Chest · 4 sets')).toBeTruthy();
  });

  it('is a plain, non-interactive row (no button role, no chevron) without onPress', () => {
    render(<ListRow testID="row" title="Bench Press" />);

    expect(screen.getByTestId('row').props.accessibilityRole).toBeUndefined();
    // No icon well and no chevron: nothing but the text.
    expect(screen.UNSAFE_queryAllByType(Feather)).toHaveLength(0);
  });

  it('shows a chevron for a pressable row, and only when asked for on a non-pressable one', () => {
    const { rerender } = render(<ListRow title="A" onPress={jest.fn()} />);
    expect(screen.UNSAFE_getByType(Feather).props.name).toBe('chevron-right');

    rerender(<ListRow title="A" onPress={jest.fn()} chevron={false} />);
    expect(screen.UNSAFE_queryAllByType(Feather)).toHaveLength(0);

    rerender(<ListRow title="A" chevron />);
    expect(screen.UNSAFE_getByType(Feather).props.name).toBe('chevron-right');
  });

  it('shows the icon in a neutral well when given an icon', () => {
    render(<ListRow title="Weight" icon="activity" />);

    expect(screen.UNSAFE_getByType(Feather).props.name).toBe('activity');
  });

  it('becomes an accessible button with a chevron when given onPress', () => {
    const onPress = jest.fn();
    render(<ListRow testID="row" title="Bench Press" subtitle="Chest" onPress={onPress} />);

    const row = screen.getByTestId('row');
    expect(row.props.accessibilityRole).toBe('button');
    // A single announcement combining the two lines, not two stops.
    expect(row.props.accessibilityLabel).toBe('Bench Press, Chest');

    fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('honours an explicit accessibilityLabel', () => {
    render(
      <ListRow
        testID="row"
        title="Bench Press"
        onPress={jest.fn()}
        accessibilityLabel="Open Bench Press history"
      />,
    );

    expect(screen.getByTestId('row').props.accessibilityLabel).toBe('Open Bench Press history');
  });

  it('does not call onPress when disabled, and reports the disabled state', () => {
    const onPress = jest.fn();
    render(<ListRow testID="row" title="Bench Press" onPress={onPress} disabled />);

    fireEvent.press(screen.getByTestId('row'));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('row').props.accessibilityState.disabled).toBe(true);
  });

  it('shows a trailing value in the mono readout face', () => {
    render(<ListRow testID="row" title="Weight" value="82.5 kg" />);

    const style = StyleSheet.flatten(screen.getByText('82.5 kg').props.style);
    expect(style.fontFamily).toBe(fonts.monoBold);
  });

  it('prefers custom trailing content over the value and the chevron', () => {
    render(
      <ListRow
        testID="row"
        title="Notifications"
        value="ignored"
        onPress={jest.fn()}
        trailing={<RNText testID="custom">Toggle</RNText>}
      />,
    );

    expect(screen.getByTestId('custom')).toBeTruthy();
    expect(screen.queryByText('ignored')).toBeNull();
  });

  it('draws a hairline above the row only when `divider` is set', () => {
    const { rerender } = render(<ListRow testID="row" title="A" />);
    expect(
      StyleSheet.flatten(screen.getByTestId('row').props.style).borderTopWidth,
    ).toBeUndefined();

    rerender(<ListRow testID="row" title="A" divider />);
    const style = StyleSheet.flatten(screen.getByTestId('row').props.style);
    expect(style.borderTopWidth).toBe(StyleSheet.hairlineWidth);
    expect(style.borderTopColor).toBe(colors.divider);
  });

  it('is at least 44pt tall, so it is comfortable to hit', () => {
    render(<ListRow testID="row" title="A" onPress={jest.fn()} />);

    expect(
      StyleSheet.flatten(screen.getByTestId('row').props.style).minHeight,
    ).toBeGreaterThanOrEqual(44);
  });

  it('colors the title with the destructive token for a destructive row', () => {
    render(<ListRow testID="row" title="Delete account" destructive />);

    expect(StyleSheet.flatten(screen.getByText('Delete account').props.style).color).toBe(
      colors.destructive,
    );
  });
});

describe('ListRow -- detail line and title testID', () => {
  it('renders a third, muted single-line detail under the subtitle', () => {
    render(<ListRow testID="row" title="PPL" subtitle="6 days" detail="Push · Pull · Legs" />);

    const detail = screen.getByText('Push · Pull · Legs');
    expect(detail.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(detail.props.style).color).toBe(colors.textMuted);
  });

  it('renders no detail line when none is given', () => {
    render(<ListRow testID="row" title="PPL" subtitle="6 days" />);

    expect(screen.queryByText('Push · Pull · Legs')).toBeNull();
  });

  it('puts titleTestID on the title text itself, not on the row', () => {
    render(<ListRow testID="row" titleTestID="row-name" title="PPL" onPress={jest.fn()} />);

    expect(screen.getByTestId('row-name')).toHaveTextContent('PPL');
    expect(screen.getByTestId('row').props.accessibilityLabel).toBe('PPL');
  });
});
