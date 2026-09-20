import { fireEvent, render, screen } from '@testing-library/react-native';
import { AlphabetIndexRail } from './AlphabetIndexRail';

const LETTERS = ['#', 'A', 'B', 'C'];

describe('AlphabetIndexRail', () => {
  it('renders every letter passed in', () => {
    render(
      <AlphabetIndexRail
        testID="rail"
        letters={LETTERS}
        availableLetters={new Set(['A', 'B'])}
        onSelect={jest.fn()}
        accentColor="#29E3C7"
      />,
    );

    for (const letter of LETTERS) {
      expect(screen.getByTestId(`rail-${letter}`)).toHaveTextContent(letter);
    }
  });

  it('calls onSelect with an available letter when pressed', () => {
    const onSelect = jest.fn();
    render(
      <AlphabetIndexRail
        testID="rail"
        letters={LETTERS}
        availableLetters={new Set(['A', 'B'])}
        onSelect={onSelect}
        accentColor="#29E3C7"
      />,
    );

    fireEvent.press(screen.getByTestId('rail-B'));

    expect(onSelect).toHaveBeenCalledWith('B');
  });

  it('does not call onSelect for a letter with no content', () => {
    const onSelect = jest.fn();
    render(
      <AlphabetIndexRail
        testID="rail"
        letters={LETTERS}
        availableLetters={new Set(['A', 'B'])}
        onSelect={onSelect}
        accentColor="#29E3C7"
      />,
    );

    fireEvent.press(screen.getByTestId('rail-C'));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks an unavailable letter as disabled for accessibility', () => {
    render(
      <AlphabetIndexRail
        testID="rail"
        letters={LETTERS}
        availableLetters={new Set(['A'])}
        onSelect={jest.fn()}
        accentColor="#29E3C7"
      />,
    );

    expect(screen.getByTestId('rail-C').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('rail-A').props.accessibilityState.disabled).toBe(false);
  });

  it('marks the active letter as selected for accessibility', () => {
    render(
      <AlphabetIndexRail
        testID="rail"
        letters={LETTERS}
        availableLetters={new Set(['A', 'B'])}
        activeLetter="B"
        onSelect={jest.fn()}
        accentColor="#29E3C7"
      />,
    );

    expect(screen.getByTestId('rail-B').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('rail-A').props.accessibilityState.selected).toBe(false);
  });

  it('never marks an unavailable letter as active/selected, even if it matches activeLetter', () => {
    render(
      <AlphabetIndexRail
        testID="rail"
        letters={LETTERS}
        availableLetters={new Set(['A', 'B'])}
        activeLetter="C"
        onSelect={jest.fn()}
        accentColor="#29E3C7"
      />,
    );

    expect(screen.getByTestId('rail-C').props.accessibilityState.selected).toBe(false);
  });
});
