import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { LineChart } from '../charts/LineChart';
import { colors } from '../design/theme';
import { PageArrival, usePageArrived } from './useAfterTransition';

function Probe() {
  return <Text testID="probe">{usePageArrived() ? 'arrived' : 'arriving'}</Text>;
}

function fakeNavigation() {
  let end: (() => void) | undefined;
  return {
    navigation: {
      addListener: (_event: 'transitionEnd', cb: () => void) => {
        end = cb;
        return () => undefined;
      },
    },
    finishSlide: () => end?.(),
  };
}

// The placeholder is a raised block of the chart's own size; the chart itself has no fill.
const fillOf = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID).props.style)?.backgroundColor;

const points = [
  { x: 0, y: 1 },
  { x: 1, y: 2 },
];

describe('PageArrival', () => {
  afterEach(() => jest.useRealTimers());

  it('counts as arrived outside a navigator', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('arrived');
  });

  it('arrives when the slide-in ends, and stays arrived for anything mounted later', () => {
    const { navigation, finishSlide } = fakeNavigation();
    const { rerender } = render(
      <PageArrival navigation={navigation}>
        <Probe />
      </PageArrival>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('arriving');

    act(() => finishSlide());
    expect(screen.getByTestId('probe')).toHaveTextContent('arrived');

    // A chart that appears later (a tab switched to) draws at once.
    rerender(
      <PageArrival navigation={navigation}>
        <LineChart testID="chart" points={points} width={200} height={100} />
      </PageArrival>,
    );
    expect(fillOf('chart')).toBeUndefined();
  });

  it("arrives anyway if the page never reports its slide's end", () => {
    jest.useFakeTimers();
    const { navigation } = fakeNavigation();
    render(
      <PageArrival navigation={navigation}>
        <Probe />
      </PageArrival>,
    );

    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(screen.getByTestId('probe')).toHaveTextContent('arrived');
  });

  it('shows a chart as a same-size placeholder while its page is still sliding in', () => {
    const { navigation, finishSlide } = fakeNavigation();
    render(
      <PageArrival navigation={navigation}>
        <LineChart testID="chart" points={points} width={200} height={100} />
      </PageArrival>,
    );

    expect(StyleSheet.flatten(screen.getByTestId('chart').props.style)).toMatchObject({
      width: 200,
      height: 100,
      backgroundColor: colors.surfaceRaised,
    });

    act(() => finishSlide());
    expect(fillOf('chart')).toBeUndefined();
  });
});
