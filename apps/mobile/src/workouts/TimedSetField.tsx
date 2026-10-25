import type { StyleProp, TextStyle } from 'react-native';
import { Pressable, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import { describeDuration, formatDuration } from '../lib/duration';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';
import {
  discardSetTimer,
  pauseSetTimer,
  startSetTimer,
  timerSeconds,
  useSetTimer,
  useTimerClock,
} from './setTimers';
import { useAppTheme } from '../theme/appThemeContext';

interface Props {
  setId: string;
  label: string;
  duration: string;
  completed: boolean;
  onChangeDuration?: (setId: string, text: string) => void;
  /** Offers a timer beside the field (the live workout only); otherwise the field spans both columns. */
  timer?: boolean;
  accentColor?: string;
  fieldStyle: StyleProp<TextStyle>;
  testID?: string;
}

/**
 * A timed set's time: the field, typed as seconds or minutes:seconds, and -- in the live
 * workout -- a timer beside it (setTimers.ts). Start runs it; while it runs the field shows the
 * time going up and can't be typed into; Pause holds it and puts the time in the field, Resume
 * carries on. The set's check finishes it (SetRow). Typing into a paused field drops the timer
 * and keeps what's typed.
 */
export function TimedSetField({
  setId,
  label,
  duration,
  completed,
  onChangeDuration,
  timer: offerTimer = false,
  accentColor: accentColorProp,
  fieldStyle,
  testID,
}: Props) {
  // Unless told otherwise, the app theme's accent.
  const themeAccent = useAppTheme().accent.accent;
  const accentColor = accentColorProp ?? themeAccent;
  const timer = useSetTimer(setId);
  const running = timer?.startedAt != null;
  const now = useTimerClock(running);
  const showTimer = offerTimer && !completed;
  const seconds = timer ? timerSeconds(timer, now) : null;
  const shown = timer && showTimer ? formatDuration(seconds ?? 0) : duration;

  function handleTimer() {
    if (running) {
      const paused = pauseSetTimer(setId);
      if (paused !== null) onChangeDuration?.(setId, formatDuration(paused));
      return;
    }
    startSetTimer(setId);
  }

  return (
    <>
      <TextInput
        testID={testID ? `${testID}-time` : undefined}
        style={[
          fieldStyle,
          showTimer ? null : styles.setInputWide,
          running ? { color: accentColor } : null,
        ]}
        accessibilityLabel={
          running
            ? `${label} time, timing: ${describeDuration(seconds ?? 0)}`
            : `${label} time, in seconds or minutes and seconds`
        }
        keyboardType="numbers-and-punctuation"
        value={shown}
        onChangeText={(text) => {
          if (timer) discardSetTimer(setId);
          onChangeDuration?.(setId, text);
        }}
        editable={!completed && !running}
        placeholder="0:00"
        placeholderTextColor={colors.textMuted}
      />
      {showTimer ? (
        <Pressable
          testID={testID ? `${testID}-timer` : undefined}
          style={[styles.setTimerButton, running ? { borderColor: accentColor } : null]}
          onPress={handleTimer}
          accessibilityRole="button"
          accessibilityLabel={`${running ? 'Pause' : timer ? 'Resume' : 'Start'} timer, ${label}`}
        >
          <Feather
            name={running ? 'pause' : 'play'}
            size={16}
            color={running ? accentColor : colors.textSecondary}
          />
          <Text style={[styles.setTimerLabel, running ? { color: accentColor } : null]}>
            {running ? 'Pause' : timer ? 'Resume' : 'Start'}
          </Text>
        </Pressable>
      ) : null}
    </>
  );
}
