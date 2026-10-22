import { HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  background,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  minimumScaleFactor,
  monospacedDigit,
  multilineTextAlignment,
  padding,
  shapes,
  tint,
  widgetURL,
  activityBackgroundTint,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, createWidget, type WidgetEnvironment } from 'expo-widgets';
import type {
  NextWorkoutWidgetProps,
  NutritionWidgetProps,
  StepsWidgetProps,
  WorkoutActivityProps,
} from './widgetProps';

// The home-screen widgets and the Lock Screen workout card. Each layout below is marked
// 'widget': it is turned into a string when the app is built and run by the widget itself,
// outside the app, with only its props -- so it can't use anything from this file or the app,
// only the SwiftUI views and modifiers imported above, under exactly those names (they are what
// the widget's own runtime provides). That's why the colours are written out in each one: they
// are the app's own (design/theme.ts: background, textPrimary, textSecondary, accent,
// heroAction, onAccent -- widgetLayouts.test.ts checks they still match). The app's fonts aren't
// in the widget, so it uses the system face, figures in its monospaced design like the app's
// mono readouts. Props may be empty before the app has run once, so each one copes with that.

const NutritionToday = (props: NutritionWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const FILL = '#12110F';
  const INK = '#F5F0E8';
  const QUIET = '#B6ADA1';
  const AMBER = '#D99A50';
  const root = [containerBackground(FILL, 'widget'), widgetURL('progresso://nutrition')];
  if (!props.signedIn) {
    return (
      <VStack alignment="leading" spacing={6} modifiers={root}>
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(AMBER)]}>
          Today
        </Text>
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(INK)]}>
          {props.signedIn === false
            ? 'Sign in to Progresso to see today.'
            : 'Open Progresso to see today.'}
        </Text>
        <Spacer />
      </VStack>
    );
  }
  const summary = (
    <VStack alignment="leading" spacing={4}>
      <HStack>
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(QUIET)]}>
          Today
        </Text>
        <Spacer />
        <Image systemName="fork.knife" size={13} color={AMBER} />
      </HStack>
      <Spacer />
      <Text
        modifiers={[
          font({ size: 32, weight: 'bold', design: 'monospaced' }),
          foregroundStyle(INK),
          minimumScaleFactor(0.6),
        ]}
      >
        {props.calories}
      </Text>
      <Text modifiers={[font({ size: 13 }), foregroundStyle(QUIET)]}>{props.caption}</Text>
      {typeof props.progress !== 'number' ? null : (
        <ProgressView value={props.progress} modifiers={[tint(AMBER)]} />
      )}
    </VStack>
  );
  if (environment.widgetFamily !== 'systemMedium') {
    return (
      <VStack alignment="leading" modifiers={root}>
        {summary}
      </VStack>
    );
  }
  return (
    <HStack spacing={18} modifiers={root}>
      {summary}
      <VStack alignment="leading" spacing={8}>
        {props.macros.map((item) => (
          <VStack key={item.label} alignment="leading" spacing={3}>
            <HStack>
              <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(QUIET)]}>
                {item.label}
              </Text>
              <Spacer />
              <Text
                modifiers={[
                  font({ size: 12, weight: 'semibold', design: 'monospaced' }),
                  foregroundStyle(INK),
                ]}
              >
                {item.amount}
              </Text>
            </HStack>
            {typeof item.progress !== 'number' ? null : (
              <ProgressView value={item.progress} modifiers={[tint(AMBER)]} />
            )}
          </VStack>
        ))}
      </VStack>
    </HStack>
  );
};

const NextWorkout = (props: NextWorkoutWidgetProps) => {
  'widget';
  const FILL = '#12110F';
  const INK = '#F5F0E8';
  const QUIET = '#B6ADA1';
  const AMBER = '#D99A50';
  const CREAM = '#F2E3CD';
  const ON_CREAM = '#12110F';
  if (!props.signedIn) {
    return (
      <VStack
        alignment="leading"
        spacing={6}
        modifiers={[containerBackground(FILL, 'widget'), widgetURL('progresso://feed')]}
      >
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(AMBER)]}>
          Next Workout
        </Text>
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(INK)]}>
          {props.signedIn === false
            ? 'Sign in to Progresso to see your next workout.'
            : 'Open Progresso to see your next workout.'}
        </Text>
        <Spacer />
      </VStack>
    );
  }
  return (
    <VStack
      alignment="leading"
      spacing={4}
      modifiers={[containerBackground(FILL, 'widget'), widgetURL(props.url)]}
    >
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(AMBER)]}>
        {props.eyebrow}
      </Text>
      <Text
        modifiers={[
          font({ size: 20, weight: 'heavy' }),
          foregroundStyle(INK),
          minimumScaleFactor(0.7),
        ]}
      >
        {props.title}
      </Text>
      <Text modifiers={[font({ size: 13 }), foregroundStyle(QUIET)]}>{props.detail}</Text>
      <Spacer />
      <Text
        modifiers={[
          font({ size: 14, weight: 'bold' }),
          foregroundStyle(ON_CREAM),
          padding({ horizontal: 14, vertical: 6 }),
          background(CREAM, shapes.capsule()),
        ]}
      >
        {props.action}
      </Text>
    </VStack>
  );
};

const StepsToday = (props: StepsWidgetProps) => {
  'widget';
  const FILL = '#12110F';
  const INK = '#F5F0E8';
  const QUIET = '#B6ADA1';
  const AMBER = '#D99A50';
  return (
    <VStack
      alignment="leading"
      spacing={4}
      modifiers={[containerBackground(FILL, 'widget'), widgetURL('progresso://feed')]}
    >
      <HStack>
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(QUIET)]}>
          Steps
        </Text>
        <Spacer />
        <Image systemName="figure.walk" size={13} color={AMBER} />
      </HStack>
      <Spacer />
      <Text
        modifiers={[
          font({ size: 32, weight: 'bold', design: 'monospaced' }),
          foregroundStyle(INK),
          minimumScaleFactor(0.6),
        ]}
      >
        {props.signedIn && props.steps ? props.steps : '—'}
      </Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(QUIET)]}>
        {props.signedIn === false
          ? 'Sign in to Progresso'
          : props.caption
            ? props.caption
            : 'Open Progresso to see your steps'}
      </Text>
    </VStack>
  );
};

const WorkoutInProgress = (props: WorkoutActivityProps) => {
  'widget';
  const FILL = '#12110F';
  const INK = '#F5F0E8';
  const QUIET = '#B6ADA1';
  const AMBER = '#D99A50';
  const started = new Date(props.startedAt);
  const timer = (size: number, width: number) => (
    <Text
      date={started}
      dateStyle="timer"
      modifiers={[
        font({ size, weight: 'bold', design: 'monospaced' }),
        monospacedDigit(),
        foregroundStyle(AMBER),
        multilineTextAlignment('trailing'),
        frame({ width, alignment: 'trailing' }),
      ]}
    />
  );
  const glyph = <Image systemName="dumbbell.fill" size={16} color={AMBER} />;
  const name = (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: 16, weight: 'bold' }), foregroundStyle(INK)]}>
        {props.title}
      </Text>
      <Text modifiers={[font({ size: 13 }), foregroundStyle(QUIET)]}>{props.kind}</Text>
    </VStack>
  );
  return {
    banner: (
      <HStack spacing={12} modifiers={[padding({ all: 16 }), activityBackgroundTint(FILL)]}>
        {glyph}
        {name}
        <Spacer />
        {timer(26, 120)}
      </HStack>
    ),
    compactLeading: glyph,
    compactTrailing: timer(14, 56),
    minimal: glyph,
    expandedLeading: glyph,
    expandedTrailing: timer(18, 80),
    expandedBottom: name,
  };
};

export const nutritionWidget = createWidget('NutritionToday', NutritionToday);
export const nextWorkoutWidget = createWidget('NextWorkout', NextWorkout);
export const stepsWidget = createWidget('StepsToday', StepsToday);
export const workoutActivity = createLiveActivity('WorkoutInProgress', WorkoutInProgress);
