import { Text as RNText } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Section } from './Section';

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
});
