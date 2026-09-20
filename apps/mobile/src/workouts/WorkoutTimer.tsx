import { useEffect, useState } from 'react';
import { type StyleProp, type TextStyle } from 'react-native';
import { Text } from '../design/Text';
import { computeElapsedSeconds, formatElapsed } from './workoutDuration';

interface Props {
  performedAt: string;
  /** Only ticks while true -- an active, not-yet-completed workout. A
   * finished workout just shows its final elapsed time, frozen. */
  active: boolean;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

export function WorkoutTimer({ performedAt, active, style, testID }: Props) {
  const [elapsed, setElapsed] = useState(() => computeElapsedSeconds(performedAt));

  useEffect(() => {
    setElapsed(computeElapsedSeconds(performedAt));
    if (!active) return;
    const interval = setInterval(() => {
      setElapsed(computeElapsedSeconds(performedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [performedAt, active]);

  return (
    <Text testID={testID} style={style}>
      {formatElapsed(elapsed)}
    </Text>
  );
}
