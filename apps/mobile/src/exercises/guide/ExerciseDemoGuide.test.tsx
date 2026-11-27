import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { createVideoPlayer } from 'expo-video';
import { forgetBuiltinExtras, setBuiltinSources, type ExerciseGuide } from '../builtinExtras';
import { ExerciseGuideSheet } from '../ExerciseGuideSheet';
import { BUILTIN_GUIDES } from '../illustrations/builtinGuides.generated';
import { guidePhases } from '../illustrations/exerciseArt';
import { clockText, ExerciseDemoGuide, guideSteps, guideTitle } from './ExerciseDemoGuide';
import { EXERCISE_DEMOS, type ExerciseDemo } from './exerciseDemos.generated';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const SLUG = 'pl-t-bar-row-upper';

const pilot: ExerciseGuide = {
  name: 'Chest-Supported T-Bar Row — Upper Handles (Pronated Grip)',
  muscleGroup: 'back',
  equipment: 'machine',
  movementType: 'bilateral',
  measurementType: 'weight_reps',
  slug: SLUG,
  secondaryMuscleGroups: ['shoulders', 'biceps', 'forearms'],
  movementPattern: 'horizontal_pull',
  summary:
    "Lying chest-down on a T-bar row machine's pad and rowing its upper handles up with an overhand grip, elbows out.",
  setupSteps: [
    'Lie chest-down on the angled pad with your feet on the platform.',
    'Take the upper handles, palms facing down, with straight arms.',
  ],
  executionSteps: [
    'Row the handles up toward your upper chest, elbows out wide.',
    'Squeeze your shoulder blades together and back.',
    'Lower slowly to straight arms.',
  ],
  commonMistakes: [
    'Lifting the chest off the pad to heave the weight.',
    'Shrugging the shoulders up to the ears.',
    'Cutting the stretch short at the bottom.',
  ],
  illustrationUrl: null,
  grip: 'Pronated',
  attachment: 'Upper handles',
  loadType: 'plate_loaded',
};

const unrendered: ExerciseDemo = EXERCISE_DEMOS[SLUG];
const rendered: ExerciseDemo = { ...unrendered, video: 42, poster: 43, seconds: 18 };

beforeEach(() => jest.mocked(createVideoPlayer).mockClear());

describe('the guide data', () => {
  it('lists the pilot, and only the pilot, until it is approved', () => {
    expect(Object.keys(EXERCISE_DEMOS)).toEqual([SLUG]);
  });

  it('splits a name into its title and its variation', () => {
    expect(guideTitle(pilot.name)).toEqual({
      title: 'Chest-Supported T-Bar Row',
      variant: 'Upper Handles (Pronated Grip)',
    });
    expect(guideTitle('Leg Press')).toEqual({ title: 'Leg Press', variant: null });
  });

  it('makes Step-by-Step from the guide: set up, starting position, the movement, the return', () => {
    expect(guideSteps(pilot)).toEqual([
      { title: 'Set Up', text: pilot.setupSteps[0] },
      { title: 'Starting Position', text: pilot.setupSteps[1] },
      {
        title: guidePhases(SLUG)[1].label,
        text: 'Row the handles up toward your upper chest, elbows out wide. Squeeze your shoulder blades together and back.',
      },
      { title: 'Control & Return', text: 'Lower slowly to straight arms.' },
    ]);
  });

  it('leaves out a step with nothing to say', () => {
    const steps = guideSteps({
      slug: null,
      setupSteps: ['Stand tall.'],
      executionSteps: ['Hold it.'],
    });
    expect(steps).toEqual([
      { title: 'Set Up', text: 'Stand tall.' },
      { title: 'Movement', text: 'Hold it.' },
    ]);
  });

  it('shows a length as a clock', () => {
    expect(clockText(18)).toBe('0:18');
    expect(clockText(59.6)).toBe('1:00');
    expect(clockText(125)).toBe('2:05');
  });
});

describe('ExerciseDemoGuide', () => {
  it('lays the guide out from the exercise: name, chips, details, steps, muscles, do and avoid', () => {
    render(<ExerciseDemoGuide guide={pilot} demo={unrendered} accent="#D99A50" />);
    expect(screen.getByTestId('exercise-guide-title')).toHaveTextContent(
      'Chest-Supported T-Bar Row',
    );
    expect(screen.getByTestId('exercise-guide-variant')).toHaveTextContent(
      'Upper Handles (Pronated Grip)',
    );
    expect(screen.getByTestId('exercise-guide-chip-Upper Back')).toBeTruthy();
    expect(screen.getByTestId('exercise-guide-chip-Rear Delts')).toBeTruthy();
    expect(screen.getByTestId('exercise-guide-summary')).toHaveTextContent(pilot.summary!);

    expect(screen.getByTestId('exercise-guide-fact-equipment')).toHaveTextContent(
      /EquipmentMachine/,
    );
    expect(screen.getByTestId('exercise-guide-fact-loading')).toHaveTextContent(
      /LoadingPlate loaded/,
    );
    expect(screen.getByTestId('exercise-guide-fact-movement')).toHaveTextContent(
      /MovementHorizontal Pull/,
    );
    expect(screen.getByTestId('exercise-guide-fact-grip')).toHaveTextContent(/GripPronated/);
    expect(screen.getByTestId('exercise-guide-fact-handles')).toHaveTextContent(
      /HandlesUpper handles/,
    );
    // No machine picture until one is added; its grip and setup pictures (Technique & Setup).
    expect(screen.queryByTestId('exercise-guide-equipment-picture')).toBeNull();
    expect(screen.getByTestId('exercise-guide-setup-1')).toHaveTextContent(/Overhand Grip/);

    expect(screen.getByTestId('exercise-guide-step-1')).toHaveTextContent(/Set Up/);
    expect(screen.getByTestId('exercise-guide-step-4')).toHaveTextContent(
      /Control & ReturnLower slowly to straight arms\./,
    );

    expect(screen.getByTestId('exercise-guide-primary')).toHaveTextContent(
      'Primary MusclesUpper Back, Rear Delts',
    );
    expect(screen.getByTestId('exercise-guide-secondary')).toHaveTextContent(/Biceps/);
    // Seen from behind: the back and shoulders in coral, the forearms in amber (the biceps are in
    // front).
    expect(screen.getByTestId('exercise-guide-muscle-figure-back')).toBeTruthy();
    expect(screen.getByTestId('exercise-guide-muscle-figure-forearms')).toBeTruthy();
    expect(screen.queryByTestId('exercise-guide-muscle-figure-chest')).toBeNull();

    for (const tip of BUILTIN_GUIDES[SLUG].tips) {
      expect(screen.getByTestId('exercise-guide-do')).toHaveTextContent(new RegExp(tip));
    }
    expect(screen.getByTestId('exercise-guide-avoid')).toHaveTextContent(
      /Shrugging the shoulders up to the ears\./,
    );
  });

  it('shows the exercise as drawn until it has a video', () => {
    render(<ExerciseDemoGuide guide={pilot} demo={unrendered} accent="#D99A50" />);
    expect(screen.getByTestId('exercise-guide-hero-still')).toBeTruthy();
    expect(createVideoPlayer).not.toHaveBeenCalled();
    expect(screen.queryByTestId('exercise-guide-full-demo')).toBeNull();
  });

  it('plays a rendered demonstration muted on a loop, and full screen from Watch Full Demonstration', () => {
    render(<ExerciseDemoGuide guide={pilot} demo={rendered} accent="#D99A50" />);
    expect(createVideoPlayer).toHaveBeenCalledWith(42);
    const player = jest.mocked(createVideoPlayer).mock.results[0].value;
    expect(player.muted).toBe(true);
    expect(player.loop).toBe(true);
    expect(screen.getByTestId('exercise-guide-duration')).toHaveTextContent('0:18');

    fireEvent.press(screen.getByTestId('exercise-guide-full-demo'));
    expect(screen.getByTestId('exercise-guide-full-demo')).toHaveTextContent(
      /Watch Full Demonstration \(0:18\)/,
    );
    expect(screen.getByTestId('exercise-guide-full')).toBeTruthy();
    expect(createVideoPlayer).toHaveBeenCalledTimes(2);
    fireEvent.press(screen.getByTestId('exercise-guide-full-close'));
    expect(screen.queryByTestId('exercise-guide-full')).toBeNull();
  });

  it('offers Sound only for a demonstration with a sound track', () => {
    const { rerender } = render(
      <ExerciseDemoGuide guide={pilot} demo={rendered} accent="#D99A50" />,
    );
    const ready = (index: number) => {
      const player = jest.mocked(createVideoPlayer).mock.results[index].value;
      act(() => player.listeners.statusChange!({ status: 'readyToPlay' }));
    };
    ready(0);
    expect(screen.queryByTestId('exercise-guide-video-sound')).toBeNull();
    rerender(
      <ExerciseDemoGuide
        guide={pilot}
        demo={{ ...rendered, video: 44, audio: true }}
        accent="#D99A50"
      />,
    );
    ready(1);
    fireEvent.press(screen.getByTestId('exercise-guide-video-sound'));
    expect(jest.mocked(createVideoPlayer).mock.results[1].value.muted).toBe(false);
  });

  it('moves its tabs to the section tapped', () => {
    render(<ExerciseDemoGuide guide={pilot} demo={unrendered} accent="#D99A50" />);
    expect(screen.getByTestId('exercise-guide-tabs-howto')).toBeSelected();
    fireEvent.press(screen.getByTestId('exercise-guide-tabs-tips'));
    expect(screen.getByTestId('exercise-guide-tabs-tips')).toBeSelected();
  });

  it('says when its name has scrolled away, and when it is back', () => {
    const away = jest.fn();
    render(
      <ExerciseDemoGuide
        guide={pilot}
        demo={unrendered}
        accent="#D99A50"
        onNameScrolledAway={away}
      />,
    );
    fireEvent(screen.getByTestId('exercise-guide-top'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 350, height: 420 } },
    });
    const scrollTo = (y: number) =>
      fireEvent.scroll(screen.getByTestId('exercise-guide-scroll'), {
        nativeEvent: {
          contentOffset: { y },
          layoutMeasurement: { height: 800 },
          contentSize: { height: 3000 },
        },
      });
    scrollTo(500);
    expect(away).toHaveBeenLastCalledWith(true);
    scrollTo(100);
    expect(away).toHaveBeenLastCalledWith(false);
  });
});

describe('ExerciseGuideSheet with the Exercise Guide', () => {
  beforeEach(() => {
    forgetBuiltinExtras();
    setBuiltinSources({
      extras: async () =>
        new Map([
          [
            'tbar-id',
            {
              slug: SLUG,
              secondaryMuscleGroups: ['shoulders', 'biceps', 'forearms'],
              searchAliases: [],
              movementPattern: 'horizontal_pull',
              illustrationUrl: null,
            },
          ],
        ]),
      guide: async () => pilot,
    });
  });

  it('opens on the guide, headed Exercise Guide', async () => {
    render(
      <ExerciseGuideSheet
        visible
        onClose={jest.fn()}
        exerciseId="tbar-id"
        exerciseName={pilot.name}
      />,
    );
    expect(await screen.findByTestId('exercise-guide-demo-guide')).toBeTruthy();
    expect(screen.getByTestId('exercise-guide-header-title')).toHaveTextContent('Exercise Guide');
    await waitFor(() =>
      expect(screen.getByTestId('exercise-guide-title')).toHaveTextContent(
        'Chest-Supported T-Bar Row',
      ),
    );
  });
});
