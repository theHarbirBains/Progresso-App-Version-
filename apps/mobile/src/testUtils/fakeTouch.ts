import type { GestureResponderEvent } from 'react-native';

/**
 * A responder event for one finger that has moved from (fromX, fromY) to (x, y) by `time` -- what a
 * PanResponder's handlers read (its touch history), for driving them in a test without a screen.
 */
export function fakeTouch(
  x: number,
  y: number,
  time: number,
  from: { x: number; y: number; time: number } = { x: 0, y: 0, time: 0 },
): GestureResponderEvent {
  return {
    nativeEvent: { touches: [{}], changedTouches: [{}], timestamp: time },
    touchHistory: {
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: time,
      touchBank: [
        {
          touchActive: true,
          startPageX: 0,
          startPageY: 0,
          startTimeStamp: 0,
          currentPageX: x,
          currentPageY: y,
          currentTimeStamp: time,
          previousPageX: from.x,
          previousPageY: from.y,
          previousTimeStamp: from.time,
        },
      ],
    },
  } as unknown as GestureResponderEvent;
}
