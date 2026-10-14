import { StyleSheet, Text as RNText } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppCard } from './AppCard';
import { Card } from './Card';
import { Section } from './Section';
import { colors } from './theme';

describe('Section', () => {
  it('renders its title and children', () => {
    render(
      <Section title="Recent" testID="section">
        <RNText>Row content</RNText>
      </Section>,
    );

    expect(screen.getByText('Recent')).toBeTruthy();
    expect(screen.getByText('Row content')).toBeTruthy();
  });

  it('renders no action unless one is given', () => {
    render(
      <Section title="Recent">
        <RNText>x</RNText>
      </Section>,
    );

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows a quiet header action that calls back, with a label that names its section', () => {
    const onPress = jest.fn();
    render(
      <Section title="Recent" action={{ label: 'See all', onPress, testID: 'see-all' }}>
        <RNText>x</RNText>
      </Section>,
    );

    const action = screen.getByTestId('see-all');
    expect(action.props.accessibilityRole).toBe('button');
    // "See all" alone is ambiguous to a screen reader on a page of sections.
    expect(action.props.accessibilityLabel).toBe('See all, Recent');

    fireEvent.press(action);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('extends the action touch area beyond its small label', () => {
    render(
      <Section title="Recent" action={{ label: 'See all', onPress: jest.fn(), testID: 'see-all' }}>
        <RNText>x</RNText>
      </Section>,
    );

    expect(screen.getByTestId('see-all').props.hitSlop).toEqual({
      top: 8,
      bottom: 8,
      left: 8,
      right: 8,
    });
  });

  it('is a widget on its own -- a card with its heading inside, like every other widget', () => {
    render(
      <Section title="Account" testID="section">
        <RNText>Row</RNText>
      </Section>,
    );

    expect(screen.UNSAFE_queryAllByType(Card)).toHaveLength(1);
    const style = StyleSheet.flatten(screen.getByTestId('section').props.style);
    expect(style.backgroundColor).toBe('rgba(38, 33, 28, 0.8)');
    expect(screen.getByTestId('section')).toHaveTextContent(/ACCOUNT|Account/);
  });

  it('is just a titled group inside a card already -- never a card in a card', () => {
    for (const Outer of [Card, AppCard]) {
      const { unmount } = render(
        <Outer>
          <Section title="Account" testID="section">
            <RNText>Row</RNText>
          </Section>
        </Outer>,
      );
      expect(screen.UNSAFE_queryAllByType(Card)).toHaveLength(Outer === Card ? 1 : 0);
      expect(
        StyleSheet.flatten(screen.getByTestId('section').props.style)?.backgroundColor,
      ).not.toBe(colors.surfaceRaised);
      expect(
        StyleSheet.flatten(screen.getByTestId('section').props.style)?.backgroundColor,
      ).toBeUndefined();
      unmount();
    }
  });
});
