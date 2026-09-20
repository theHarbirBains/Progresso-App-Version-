import { KeyboardAvoidingView, ScrollView, StyleSheet, Text as RNText } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from './Screen';
import { spacing } from './theme';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn(),
}));

const mockInsets = useSafeAreaInsets as jest.Mock;

beforeEach(() => {
  mockInsets.mockReturnValue({ top: 47, bottom: 34, left: 0, right: 0 });
});

describe('Screen', () => {
  it('renders its children', () => {
    render(
      <Screen testID="screen">
        <RNText>Hello</RNText>
      </Screen>,
    );

    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('is transparent, so the app-level background shows through instead of the screen painting its own', () => {
    render(
      <Screen testID="screen">
        <RNText>x</RNText>
      </Screen>,
    );

    expect(StyleSheet.flatten(screen.getByTestId('screen').props.style).backgroundColor).toBe(
      'transparent',
    );
  });

  it("pads for the device's real top safe area when it has no header", () => {
    render(
      <Screen testID="screen">
        <RNText>x</RNText>
      </Screen>,
    );

    expect(StyleSheet.flatten(screen.getByTestId('screen').props.style).paddingTop).toBe(
      47 + spacing.lg,
    );
  });

  it('adds no top inset of its own when a header is given (the header pads for the safe area itself)', () => {
    render(
      <Screen testID="screen" header={<RNText>Header</RNText>}>
        <RNText>x</RNText>
      </Screen>,
    );

    expect(StyleSheet.flatten(screen.getByTestId('screen').props.style).paddingTop).toBe(0);
    expect(screen.getByText('Header')).toBeTruthy();
  });

  it('renders the header above the body', () => {
    render(
      <Screen testID="screen" header={<RNText testID="header">Header</RNText>}>
        <RNText testID="body">Body</RNText>
      </Screen>,
    );

    const children = screen.getByTestId('screen').children as unknown[];
    expect(children).toHaveLength(2);
    expect(screen.getByTestId('header')).toBeTruthy();
    expect(screen.getByTestId('body')).toBeTruthy();
  });

  it('scrolls by default, keeping taps working while a keyboard is open', () => {
    render(
      <Screen>
        <RNText>x</RNText>
      </Screen>,
    );

    const scroll = screen.UNSAFE_getByType(ScrollView);
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
  });

  it('renders a plain view (no ScrollView) when scroll is false', () => {
    render(
      <Screen scroll={false}>
        <RNText>x</RNText>
      </Screen>,
    );

    expect(screen.UNSAFE_queryAllByType(ScrollView)).toHaveLength(0);
  });

  it('applies the standard horizontal padding, and none when padded is false', () => {
    const { rerender } = render(
      <Screen scroll={false} testID="screen">
        <RNText testID="body">x</RNText>
      </Screen>,
    );
    const paddedBody = screen.getByTestId('body').parent!.parent!;
    expect(StyleSheet.flatten(paddedBody.props.style).paddingHorizontal).toBe(spacing.xxl);

    rerender(
      <Screen scroll={false} padded={false} testID="screen">
        <RNText testID="body">x</RNText>
      </Screen>,
    );
    const bareBody = screen.getByTestId('body').parent!.parent!;
    expect(StyleSheet.flatten(bareBody.props.style).paddingHorizontal).toBeUndefined();
  });

  it('only wraps the body in a keyboard-avoiding view on request', () => {
    const { rerender } = render(
      <Screen>
        <RNText>x</RNText>
      </Screen>,
    );
    expect(screen.UNSAFE_queryAllByType(KeyboardAvoidingView)).toHaveLength(0);

    rerender(
      <Screen keyboardAvoiding>
        <RNText>x</RNText>
      </Screen>,
    );
    expect(screen.UNSAFE_queryAllByType(KeyboardAvoidingView)).toHaveLength(1);
  });

  it('reserves no bottom space for the navigation bar (it is an in-flow sibling of the navigator)', () => {
    render(
      <Screen testID="screen" scroll={false}>
        <RNText>x</RNText>
      </Screen>,
    );

    expect(
      StyleSheet.flatten(screen.getByTestId('screen').props.style).paddingBottom,
    ).toBeUndefined();
  });
});

describe('Screen -- scrollTestID', () => {
  it('puts scrollTestID on the ScrollView, leaving testID on the root', () => {
    render(
      <Screen testID="root" scrollTestID="root-scroll">
        <RNText>content</RNText>
      </Screen>,
    );

    expect(screen.UNSAFE_getByType(ScrollView).props.testID).toBe('root-scroll');
    expect(screen.getByTestId('root')).toBeTruthy();
  });

  it('adds no testID to the scroll area when none is given', () => {
    render(
      <Screen testID="root">
        <RNText>content</RNText>
      </Screen>,
    );

    expect(screen.UNSAFE_getByType(ScrollView).props.testID).toBeUndefined();
  });
});
