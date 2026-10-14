import { Animated, StyleSheet, Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import * as navigationTransitions from '../navigation/navigationTransitions';
import { RiseIn, RiseInGroup, RiseInStack } from './RiseIn';

function delays(timing: jest.SpyInstance) {
  return timing.mock.calls.map(([, config]) => (config as { delay: number }).delay);
}

describe('RiseIn', () => {
  let timing: jest.SpyInstance;
  let now = 1_000;

  beforeEach(() => {
    jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(false);
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    timing = jest.spyOn(Animated, 'spring');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const card = (n: number) => (
    <RiseIn key={n} testID={`card-${n}`}>
      <Text>Card {n}</Text>
    </RiseIn>
  );

  it('rolls widgets that appear together out one after another, the first few in turn', () => {
    render(<RiseInGroup>{Array.from({ length: 9 }, (_, n) => card(n))}</RiseInGroup>);

    expect(delays(timing)).toEqual([0, 110, 220, 330, 440, 550, 660, 660, 660]);
  });

  it('starts a widget that appears on its own later right away, and never replays one already shown', () => {
    const { rerender } = render(<RiseInGroup>{[card(0), card(1)]}</RiseInGroup>);
    expect(delays(timing)).toEqual([0, 110]);

    // A refresh a while later adds one new workout at the top.
    now += 5_000;
    rerender(<RiseInGroup>{[card(9), card(0), card(1)]}</RiseInGroup>);

    expect(delays(timing)).toEqual([0, 110, 0]);
  });

  it('starts hidden, low and a little small, then springs up into place', () => {
    render(<RiseInGroup>{card(0)}</RiseInGroup>);

    const style = StyleSheet.flatten(screen.getByTestId('card-0').props.style);
    expect(style.opacity).toBe(0);
    expect(style.transform).toEqual([{ translateY: 44 }, { scale: 0.94 }]);
    const config = timing.mock.calls[0][1] as { toValue: number; useNativeDriver: boolean };
    expect(config.toValue).toBe(1);
    expect(config.useNativeDriver).toBe(true);
  });

  it('simply appears with Reduce Motion on', () => {
    jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(true);
    render(<RiseInGroup>{card(0)}</RiseInGroup>);

    expect(timing).not.toHaveBeenCalled();
    expect(StyleSheet.flatten(screen.getByTestId('card-0').props.style).opacity).toBe(1);
  });

  it("gives each of a page's widgets its own place in one cascade, skipping empty slots", () => {
    render(
      <RiseInStack>
        <Text testID="widget-a">A</Text>
        {null}
        {false}
        <Text testID="widget-b">B</Text>
        <Text testID="widget-c">C</Text>
      </RiseInStack>,
    );

    expect(delays(timing)).toEqual([0, 110, 220]);
    // One rollout wrapper per widget, in page order, each holding just its
    // widget -- no extra box around the stack, so the page's spacing is unchanged.
    const wrappers = screen.UNSAFE_getAllByType(RiseIn);
    expect(wrappers.map((w) => w.props.children.props.testID)).toEqual([
      'widget-a',
      'widget-b',
      'widget-c',
    ]);
  });
});
