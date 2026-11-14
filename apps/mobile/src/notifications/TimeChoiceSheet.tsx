import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton } from '../design/Button';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import { WheelPicker } from '../design/WheelPicker';
import { timeLabel } from './reminderSettings';

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = ['00', '15', '30', '45'];
const HALVES = ['AM', 'PM'];

/** A time (minutes after midnight) as the three wheels show it. */
function wheelsFor(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = Math.round((minutes % 60) / 15) * 15;
  return {
    hour: String(hour % 12 === 0 ? 12 : hour % 12),
    minute: String(minute === 60 ? 45 : minute).padStart(2, '0'),
    half: hour < 12 ? 'AM' : 'PM',
  };
}

function minutesFor(wheels: { hour: string; minute: string; half: string }): number {
  const hour12 = Number(wheels.hour) % 12;
  return (hour12 + (wheels.half === 'PM' ? 12 : 0)) * 60 + Number(wheels.minute);
}

interface Props {
  /** What the time is for ("Workout Reminders"); null keeps the sheet closed. */
  title: string | null;
  value: number;
  accentColor: string;
  onAccentColor: string;
  onClose: () => void;
  onChoose: (minutes: number) => void;
}

/**
 * Chooses a reminder's time: hour, minute (in quarter hours) and AM/PM on the app's own scroll
 * wheels (design/WheelPicker), with the time chosen spelled out beneath, and Done. The wheels are
 * made afresh each time the sheet opens, at the reminder's time: a wheel scrolls to its value only
 * as it's first drawn.
 */
export function TimeChoiceSheet({
  title,
  value,
  accentColor,
  onAccentColor,
  onClose,
  onChoose,
}: Props) {
  return (
    <BottomSheet visible={title !== null} onClose={onClose} testID="reminder-time-sheet">
      {title !== null ? (
        <TimeWheels
          key={`${title}-${value}`}
          title={title}
          value={value}
          accentColor={accentColor}
          onAccentColor={onAccentColor}
          onDone={(minutes) => {
            onChoose(minutes);
            onClose();
          }}
        />
      ) : null}
    </BottomSheet>
  );
}

function TimeWheels({
  title,
  value,
  accentColor,
  onAccentColor,
  onDone,
}: {
  title: string;
  value: number;
  accentColor: string;
  onAccentColor: string;
  onDone: (minutes: number) => void;
}) {
  const [wheels, setWheels] = useState(() => wheelsFor(value));
  return (
    <View style={styles.content}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.wheels}>
        <View style={styles.wheel}>
          <WheelPicker
            testID="reminder-time-hour"
            values={HOURS}
            selectedValue={wheels.hour}
            onChange={(hour) => setWheels((prev) => ({ ...prev, hour }))}
          />
        </View>
        <View style={styles.wheel}>
          <WheelPicker
            testID="reminder-time-minute"
            values={MINUTES}
            selectedValue={wheels.minute}
            onChange={(minute) => setWheels((prev) => ({ ...prev, minute }))}
          />
        </View>
        <View style={styles.wheel}>
          <WheelPicker
            testID="reminder-time-half"
            values={HALVES}
            selectedValue={wheels.half}
            onChange={(half) => setWheels((prev) => ({ ...prev, half }))}
          />
        </View>
      </View>
      <Text testID="reminder-time-preview" style={styles.preview}>
        {timeLabel(minutesFor(wheels))}
      </Text>
      <PrimaryButton
        testID="reminder-time-done"
        label="Done"
        onPress={() => onDone(minutesFor(wheels))}
        accentColor={accentColor}
        onAccentColor={onAccentColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  wheels: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  wheel: {
    flex: 1,
  },
  preview: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
