import {
  Circle,
  HStack,
  Image,
  ProgressView,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  activityBackgroundTint,
  aspectRatio,
  background,
  clipped,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  multilineTextAlignment,
  padding,
  resizable,
  rotationEffect,
  shadow,
  shapes,
  strokeBorder,
  tint,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { ReactNode } from 'react';
import type { HomeWidgets } from './homeWidgetsTypes';
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
// the widget's own runtime provides). That's why the colours are written out in each one, and
// why each draws its own backdrop and date: the app's fill, text and quiet text (design/theme.ts
// -- widgetLayouts.test.ts checks they still match), and the theme's accent and photo from its
// props, with the original amber where it has none. The app's fonts aren't in the widget, so it
// uses the system face, smaller figures in its monospaced design like the app's mono readouts.
// Props may be empty before the app has run once, so each one copes with that.
//
// Each widget fills its whole face (contentMarginsDisabled in app.json): the theme's photo, a
// darkening of the app's fill over it (65% at the top to 88% at the bottom, so text and captions
// keep AA contrast over even a white pixel of snow or sky), then the content inset by its own
// padding. Where iOS draws
// widgets tinted or clear, there's no photo -- the system draws their background.
//
// Loading this file does nothing but define the layouts: it's loaded after the app starts
// (loadWidgets.ts), and Metro treats any failure while a file loads then as fatal, whatever
// catches it. Creating the widgets -- the part that hands iOS each layout -- happens in
// homeWidgets(), a plain call loadWidgets can catch a failure from.

const NutritionToday = (props: NutritionWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const FILL = '#12110F';
  const INK = '#F5F0E8';
  const QUIET = '#B6ADA1';
  const HEX = /^#[0-9A-Fa-f]{6}$/;
  const ACCENT =
    typeof props.accent === 'string' && HEX.test(props.accent) ? props.accent : '#D99A50';
  const GLOW = typeof props.glow === 'string' && HEX.test(props.glow) ? props.glow : FILL;
  const CLEAR = '#00000000';
  const FULL = { minWidth: 0, maxWidth: 4000, minHeight: 0, maxHeight: 4000 };
  const wide = environment.widgetFamily === 'systemMedium';
  // Tinted or clear (accented), or on the Lock Screen or in StandBy at night (vibrant): no photo.
  const fullColor = !/accented|vibrant/i.test(String(environment.widgetRenderingMode ?? ''));
  const photo = fullColor ? (wide ? props.photoMedium : props.photoSmall) : undefined;
  const glass = (radius: number) => [
    background(`${FILL}A6`, shapes.roundedRectangle({ cornerRadius: radius })),
    strokeBorder({
      content: `${ACCENT}38`,
      style: { lineWidth: 1 },
      shape: 'roundedRectangle',
      cornerRadius: radius,
    }),
  ];
  const day = props.day ? (
    <HStack
      spacing={5}
      modifiers={[
        padding({ horizontal: 9, vertical: 4 }),
        background(`${FILL}A6`, shapes.capsule()),
        strokeBorder({ content: `${ACCENT}59`, style: { lineWidth: 1 }, shape: 'capsule' }),
      ]}
    >
      <Image systemName="calendar" size={11} color={ACCENT} />
      <Text
        modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(INK), lineLimit(1)]}
      >
        {props.day}
      </Text>
    </HStack>
  ) : null;
  const face = (content: ReactNode) => (
    <ZStack
      modifiers={[
        containerBackground(
          {
            type: 'linearGradient',
            colors: [GLOW, FILL],
            startPoint: { x: 0.5, y: 0 },
            endPoint: { x: 0.5, y: 1 },
          },
          'widget',
        ),
        widgetURL('progresso://nutrition'),
      ]}
    >
      {photo ? (
        <Image
          uiImage={photo}
          modifiers={[resizable(), aspectRatio({ contentMode: 'fill' }), frame(FULL), clipped()]}
        />
      ) : null}
      <VStack
        alignment="leading"
        spacing={0}
        modifiers={[
          padding({ all: 12 }),
          frame({ ...FULL, alignment: 'topLeading' }),
          background({
            type: 'linearGradient',
            colors: [`${FILL}A6`, `${FILL}E0`],
            startPoint: { x: 0.5, y: 0 },
            endPoint: { x: 0.5, y: 1 },
          }),
        ]}
      >
        {content}
      </VStack>
    </ZStack>
  );
  const heading = (
    <HStack spacing={5}>
      {day}
      <Spacer />
      <Image systemName="fork.knife" size={13} color={ACCENT} />
      {wide ? (
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(INK)]}>
          Nutrition
        </Text>
      ) : null}
    </HStack>
  );
  if (!props.signedIn) {
    return face(
      <VStack alignment="leading" spacing={8}>
        {heading}
        <Spacer />
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(INK)]}>
          {props.signedIn === false
            ? 'Sign in to Progresso to see today.'
            : 'Open Progresso to see today.'}
        </Text>
      </VStack>,
    );
  }
  // Calories as a ring: the day's target all the way round, filled in the accent as it's eaten.
  const SIZE = wide ? 92 : 90;
  const LINE = 7;
  const around = Math.PI * (SIZE - LINE);
  const eaten =
    typeof props.progress === 'number' ? Math.min(1, Math.max(0, props.progress)) : null;
  const ring = (
    <ZStack modifiers={[frame({ width: SIZE, height: SIZE })]}>
      <Circle
        modifiers={[
          foregroundStyle(`${FILL}8C`),
          strokeBorder({ content: `${ACCENT}38`, style: { lineWidth: LINE }, shape: 'circle' }),
        ]}
      />
      {eaten === null || eaten <= 0.002 ? null : (
        <Circle
          modifiers={[
            foregroundStyle(CLEAR),
            strokeBorder({
              content: ACCENT,
              style:
                eaten >= 0.998
                  ? { lineWidth: LINE }
                  : { lineWidth: LINE, lineCap: 'round', dash: [eaten * around, around] },
              shape: 'circle',
            }),
            rotationEffect(-90),
            shadow({ radius: 5, color: `${ACCENT}99` }),
          ]}
        />
      )}
      <VStack spacing={0} modifiers={[frame({ width: SIZE - LINE * 2 - 8 })]}>
        <Text
          modifiers={[
            font({ size: 26, weight: 'bold' }),
            foregroundStyle(INK),
            minimumScaleFactor(0.5),
            lineLimit(1),
          ]}
        >
          {props.calories}
        </Text>
        <Text
          modifiers={[
            font({ size: 10 }),
            foregroundStyle(QUIET),
            minimumScaleFactor(0.7),
            lineLimit(1),
          ]}
        >
          {props.caption}
        </Text>
      </VStack>
    </ZStack>
  );
  if (!wide) {
    return face(
      <VStack spacing={0}>
        {heading}
        <Spacer />
        <HStack spacing={0}>
          <Spacer />
          {ring}
          <Spacer />
        </HStack>
        <Spacer />
      </VStack>,
    );
  }
  const ICONS: Record<string, 'figure.strengthtraining.traditional' | 'leaf.fill' | 'drop.fill'> = {
    Protein: 'figure.strengthtraining.traditional',
    Carbs: 'leaf.fill',
    Fat: 'drop.fill',
  };
  return face(
    <VStack alignment="leading" spacing={6}>
      {heading}
      <HStack spacing={12}>
        {ring}
        <VStack spacing={4}>
          {(props.macros ?? []).map((item) => (
            <HStack
              key={item.label}
              spacing={8}
              modifiers={[padding({ horizontal: 10, vertical: 4 }), ...glass(10)]}
            >
              {ICONS[item.label] ? (
                <Image
                  systemName={ICONS[item.label]}
                  size={12}
                  color={ACCENT}
                  modifiers={[frame({ width: 16 })]}
                />
              ) : null}
              <VStack alignment="leading" spacing={2}>
                <HStack spacing={0}>
                  <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(INK)]}>
                    {item.label}
                  </Text>
                  <Spacer />
                  <Text
                    modifiers={[
                      font({ size: 11, weight: 'semibold', design: 'monospaced' }),
                      foregroundStyle(INK),
                      minimumScaleFactor(0.7),
                      lineLimit(1),
                    ]}
                  >
                    {item.amount}
                  </Text>
                </HStack>
                {typeof item.progress !== 'number' ? null : (
                  <ProgressView value={item.progress} modifiers={[tint(ACCENT)]} />
                )}
              </VStack>
            </HStack>
          ))}
        </VStack>
      </HStack>
    </VStack>,
  );
};

const NextWorkout = (props: NextWorkoutWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const FILL = '#12110F';
  const INK = '#F5F0E8';
  const QUIET = '#B6ADA1';
  const CREAM = '#F2E3CD';
  const ON_CREAM = '#12110F';
  const HEX = /^#[0-9A-Fa-f]{6}$/;
  const ACCENT =
    typeof props.accent === 'string' && HEX.test(props.accent) ? props.accent : '#D99A50';
  const GLOW = typeof props.glow === 'string' && HEX.test(props.glow) ? props.glow : FILL;
  const FULL = { minWidth: 0, maxWidth: 4000, minHeight: 0, maxHeight: 4000 };
  const wide = environment.widgetFamily === 'systemMedium';
  // Tinted or clear (accented), or on the Lock Screen or in StandBy at night (vibrant): no photo.
  const fullColor = !/accented|vibrant/i.test(String(environment.widgetRenderingMode ?? ''));
  const photo = fullColor ? (wide ? props.photoMedium : props.photoSmall) : undefined;
  const day = props.day ? (
    <HStack
      spacing={5}
      modifiers={[
        padding({ horizontal: 9, vertical: 4 }),
        background(`${FILL}A6`, shapes.capsule()),
        strokeBorder({ content: `${ACCENT}59`, style: { lineWidth: 1 }, shape: 'capsule' }),
      ]}
    >
      <Image systemName="calendar" size={11} color={ACCENT} />
      <Text
        modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(INK), lineLimit(1)]}
      >
        {props.day}
      </Text>
    </HStack>
  ) : null;
  const face = (url: string, content: ReactNode) => (
    <ZStack
      modifiers={[
        containerBackground(
          {
            type: 'linearGradient',
            colors: [GLOW, FILL],
            startPoint: { x: 0.5, y: 0 },
            endPoint: { x: 0.5, y: 1 },
          },
          'widget',
        ),
        widgetURL(url),
      ]}
    >
      {photo ? (
        <Image
          uiImage={photo}
          modifiers={[resizable(), aspectRatio({ contentMode: 'fill' }), frame(FULL), clipped()]}
        />
      ) : null}
      <VStack
        alignment="leading"
        spacing={0}
        modifiers={[
          padding({ all: 12 }),
          frame({ ...FULL, alignment: 'topLeading' }),
          background({
            type: 'linearGradient',
            colors: [`${FILL}A6`, `${FILL}E0`],
            startPoint: { x: 0.5, y: 0 },
            endPoint: { x: 0.5, y: 1 },
          }),
        ]}
      >
        {content}
      </VStack>
    </ZStack>
  );
  const heading = (title: string | null) => (
    <HStack spacing={5}>
      {day}
      <Spacer />
      <Image systemName="dumbbell.fill" size={13} color={ACCENT} />
      {title ? (
        <Text
          modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(INK), lineLimit(1)]}
        >
          {title}
        </Text>
      ) : null}
    </HStack>
  );
  if (!props.signedIn) {
    return face(
      'progresso://feed',
      <VStack alignment="leading" spacing={8}>
        {heading(wide ? 'Next Workout' : null)}
        <Spacer />
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(INK)]}>
          {props.signedIn === false
            ? 'Sign in to Progresso to see your next workout.'
            : 'Open Progresso to see your next workout.'}
        </Text>
      </VStack>,
    );
  }
  const title = (
    <Text
      modifiers={[
        font({ size: wide ? 22 : 20, weight: 'heavy' }),
        foregroundStyle(INK),
        minimumScaleFactor(0.6),
        lineLimit(1),
      ]}
    >
      {props.title}
    </Text>
  );
  const detail = (
    <Text modifiers={[font({ size: 12 }), foregroundStyle(QUIET), lineLimit(wide ? 2 : 1)]}>
      {props.detail}
    </Text>
  );
  const action = (
    <Text
      modifiers={[
        font({ size: 13, weight: 'bold' }),
        foregroundStyle(ON_CREAM),
        padding({ horizontal: 14, vertical: 6 }),
        background(CREAM, shapes.capsule()),
      ]}
    >
      {props.action}
    </Text>
  );
  if (!wide) {
    return face(
      props.url,
      <VStack alignment="leading" spacing={2}>
        {heading(null)}
        <Spacer />
        <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(ACCENT)]}>
          {props.eyebrow}
        </Text>
        {title}
        {detail}
        <Spacer />
        {action}
      </VStack>,
    );
  }
  return face(
    props.url,
    <VStack alignment="leading" spacing={0}>
      {heading(props.eyebrow)}
      <Spacer />
      <HStack
        spacing={12}
        modifiers={[
          padding({ all: 12 }),
          background(`${FILL}A6`, shapes.roundedRectangle({ cornerRadius: 14 })),
          strokeBorder({
            content: `${ACCENT}38`,
            style: { lineWidth: 1 },
            shape: 'roundedRectangle',
            cornerRadius: 14,
          }),
        ]}
      >
        <VStack alignment="leading" spacing={3}>
          {title}
          {detail}
        </VStack>
        <Spacer />
        {action}
      </HStack>
    </VStack>,
  );
};

const StepsToday = (props: StepsWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const FILL = '#12110F';
  const INK = '#F5F0E8';
  const QUIET = '#B6ADA1';
  const HEX = /^#[0-9A-Fa-f]{6}$/;
  const ACCENT =
    typeof props.accent === 'string' && HEX.test(props.accent) ? props.accent : '#D99A50';
  const GLOW = typeof props.glow === 'string' && HEX.test(props.glow) ? props.glow : FILL;
  const FULL = { minWidth: 0, maxWidth: 4000, minHeight: 0, maxHeight: 4000 };
  // Tinted or clear (accented), or on the Lock Screen or in StandBy at night (vibrant): no photo.
  const fullColor = !/accented|vibrant/i.test(String(environment.widgetRenderingMode ?? ''));
  const photo = fullColor ? props.photoSmall : undefined;
  return (
    <ZStack
      modifiers={[
        containerBackground(
          {
            type: 'linearGradient',
            colors: [GLOW, FILL],
            startPoint: { x: 0.5, y: 0 },
            endPoint: { x: 0.5, y: 1 },
          },
          'widget',
        ),
        widgetURL('progresso://feed'),
      ]}
    >
      {photo ? (
        <Image
          uiImage={photo}
          modifiers={[resizable(), aspectRatio({ contentMode: 'fill' }), frame(FULL), clipped()]}
        />
      ) : null}
      <VStack
        alignment="leading"
        spacing={2}
        modifiers={[
          padding({ all: 12 }),
          frame({ ...FULL, alignment: 'topLeading' }),
          background({
            type: 'linearGradient',
            colors: [`${FILL}A6`, `${FILL}E0`],
            startPoint: { x: 0.5, y: 0 },
            endPoint: { x: 0.5, y: 1 },
          }),
        ]}
      >
        <HStack spacing={5}>
          {props.day ? (
            <HStack
              spacing={5}
              modifiers={[
                padding({ horizontal: 9, vertical: 4 }),
                background(`${FILL}A6`, shapes.capsule()),
                strokeBorder({
                  content: `${ACCENT}59`,
                  style: { lineWidth: 1 },
                  shape: 'capsule',
                }),
              ]}
            >
              <Image systemName="calendar" size={11} color={ACCENT} />
              <Text
                modifiers={[
                  font({ size: 12, weight: 'semibold' }),
                  foregroundStyle(INK),
                  lineLimit(1),
                ]}
              >
                {props.day}
              </Text>
            </HStack>
          ) : null}
          <Spacer />
          <Image systemName="figure.walk" size={13} color={ACCENT} />
        </HStack>
        <Spacer />
        <Text
          modifiers={[
            font({ size: 32, weight: 'bold' }),
            foregroundStyle(INK),
            minimumScaleFactor(0.6),
            lineLimit(1),
          ]}
        >
          {props.signedIn && props.steps ? props.steps : '—'}
        </Text>
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(ACCENT)]}>
          Steps
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(QUIET), lineLimit(2)]}>
          {props.signedIn === false
            ? 'Sign in to Progresso'
            : props.caption
              ? props.caption
              : 'Open Progresso to see your steps'}
        </Text>
      </VStack>
    </ZStack>
  );
};

const WorkoutInProgress = (props: WorkoutActivityProps) => {
  'widget';
  const FILL = '#12110F';
  const INK = '#F5F0E8';
  const QUIET = '#B6ADA1';
  const ACCENT =
    typeof props.accent === 'string' && /^#[0-9A-Fa-f]{6}$/.test(props.accent)
      ? props.accent
      : '#D99A50';
  const started = new Date(props.startedAt);
  const timer = (size: number, width: number) => (
    <Text
      date={started}
      dateStyle="timer"
      modifiers={[
        font({ size, weight: 'bold', design: 'monospaced' }),
        monospacedDigit(),
        foregroundStyle(ACCENT),
        multilineTextAlignment('trailing'),
        frame({ width, alignment: 'trailing' }),
      ]}
    />
  );
  const glyph = <Image systemName="dumbbell.fill" size={16} color={ACCENT} />;
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

let created: HomeWidgets | null = null;

/** The widgets and the Lock Screen card, created the first time they're asked for. */
export function homeWidgets(): HomeWidgets {
  created ??= {
    nutritionWidget: createWidget('NutritionToday', NutritionToday),
    nextWorkoutWidget: createWidget('NextWorkout', NextWorkout),
    stepsWidget: createWidget('StepsToday', StepsToday),
    workoutActivity: createLiveActivity('WorkoutInProgress', WorkoutInProgress),
  };
  return created;
}
