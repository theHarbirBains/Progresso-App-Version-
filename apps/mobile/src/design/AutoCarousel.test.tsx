import { act, render, screen } from '@testing-library/react-native';
import * as navigationTransitions from '../navigation/navigationTransitions';
import { AutoCarousel } from './AutoCarousel';
import { Text } from './Text';

function selected(): number {
  return [0, 1, 2].findIndex(
    (i) => screen.queryByTestId(`c-dot-${i}`)?.props.accessibilityState?.selected,
  );
}

function renderCarousel(items: string[]) {
  return render(
    <AutoCarousel
      testID="c"
      items={items}
      keyOf={(item) => item}
      renderSlide={(item) => <Text>{item}</Text>}
    />,
  );
}

describe('AutoCarousel', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows every slide with a dot each, the first showing, and moves on by itself, wrapping', () => {
    renderCarousel(['a', 'b', 'c']);

    expect(screen.getByTestId('c-slide-b')).toHaveTextContent('b');
    expect(selected()).toBe(0);
    for (const next of [1, 2, 0]) {
      act(() => {
        jest.advanceTimersByTime(3500);
      });
      expect(selected()).toBe(next);
    }
  });

  it('shows one slide on its own, with no dots and no advancing', () => {
    renderCarousel(['a']);

    expect(screen.getByTestId('c-slide-a')).toBeTruthy();
    expect(screen.queryByTestId('c-dot-0')).toBeNull();
  });
});
