import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import {
  forgetBuiltinExtras,
  setBuiltinSources,
  type BuiltinExtras,
  type ExerciseGuide,
} from './builtinExtras';
import { ExerciseDetailsCard } from './ExerciseDetailsCard';
import { ExerciseGuideSheet } from './ExerciseGuideSheet';
import { ExercisePhoto } from './ExercisePhoto';
import { HowToPill } from './HowToPill';

jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const benchGuide: ExerciseGuide = {
  name: 'Dumbbell Bench Press',
  muscleGroup: 'chest',
  equipment: 'dumbbell',
  movementType: 'bilateral',
  measurementType: 'weight_reps',
  slug: 'db-bench-press',
  secondaryMuscleGroups: ['shoulders', 'triceps'],
  movementPattern: 'horizontal_push',
  summary: 'A flat-bench press that lets each arm move freely.',
  setupSteps: ['Lie back with the dumbbells at your chest.'],
  executionSteps: ['Press them up.', 'Lower them slowly.'],
  commonMistakes: ['Flaring the elbows.'],
  illustrationUrl: null,
};

const extras = new Map<string, BuiltinExtras>([
  [
    'bench-id',
    {
      slug: 'db-bench-press',
      secondaryMuscleGroups: ['shoulders', 'triceps'],
      searchAliases: [],
      movementPattern: 'horizontal_push',
      illustrationUrl: null,
    },
  ],
]);

let guideReads = 0;
beforeEach(() => {
  forgetBuiltinExtras();
  guideReads = 0;
  setBuiltinSources({
    extras: async () => extras,
    guide: async (id) => {
      guideReads += 1;
      return id === 'bench-id' ? benchGuide : null;
    },
  });
});

afterAll(() => setBuiltinSources(null));

describe('HowToPill', () => {
  it("offers a built-in's guide under its name, and nothing for a person's own exercise", async () => {
    render(
      <>
        <HowToPill
          testID="pill"
          exerciseId="bench-id"
          name="Dumbbell Bench Press"
          accentColor="#D99A50"
        />
        <HowToPill testID="own-pill" exerciseId="own-id" name="My Press" accentColor="#D99A50" />
      </>,
    );

    const pill = await screen.findByTestId('pill');
    expect(pill).toHaveTextContent(/How to Do It/);
    expect(screen.queryByTestId('own-pill')).toBeNull();
    fireEvent.press(pill);
    expect(await screen.findByTestId('pill-sheet-page-dots')).toBeTruthy();
  });
});

describe('ExerciseGuideSheet', () => {
  it('shows how to do the exercise: its muscles, three phases, Key Tips and Common Mistakes', async () => {
    render(
      <ExerciseGuideSheet
        visible
        onClose={jest.fn()}
        exerciseId="bench-id"
        exerciseName="Dumbbell Bench Press"
      />,
    );

    expect(await screen.findByTestId('exercise-guide-illustration')).toBeTruthy();
    // The phases are drawn once their width is known.
    fireEvent(screen.getByTestId('exercise-guide-illustration'), 'layout', {
      nativeEvent: { layout: { width: 320, height: 240, x: 0, y: 0 } },
    });
    // What it targets, under its name, then what it is.
    expect(screen.getByTestId('exercise-guide-target')).toHaveTextContent('Chest');
    expect(screen.getByTestId('exercise-guide-summary')).toHaveTextContent(/each arm move freely/);
    // The anatomy figure's key names the muscles, one per line.
    const primary = screen.getByTestId('exercise-guide-muscles-primary');
    expect(within(primary).getByText('Primary')).toBeTruthy();
    expect(within(primary).getByText('Chest')).toBeTruthy();
    const secondary = screen.getByTestId('exercise-guide-muscles-secondary');
    expect(within(secondary).getByText('Secondary')).toBeTruthy();
    expect(within(secondary).getByText('Shoulders')).toBeTruthy();
    expect(within(secondary).getByText('Triceps')).toBeTruthy();
    // Exactly three phases -- the setup, the movement, the way back -- each a numbered row.
    expect(screen.getByTestId('exercise-guide-illustration-label-0')).toHaveTextContent('Setup');
    expect(screen.getByTestId('exercise-guide-illustration-label-1')).toHaveTextContent('Press');
    expect(screen.getByTestId('exercise-guide-illustration-label-2')).toHaveTextContent('Lower');
    expect(screen.queryByTestId('exercise-guide-illustration-label-3')).toBeNull();
    expect(screen.getByTestId('exercise-guide-step-0')).toHaveTextContent(/Setup.*Sit on the end/);
    expect(screen.getByTestId('exercise-guide-step-1')).toHaveTextContent(
      /Press.*Press the dumbbells up/,
    );
    expect(screen.getByTestId('exercise-guide-step-2')).toHaveTextContent(
      /Lower.*Lower them slowly/,
    );
    expect(screen.getByTestId('exercise-guide-tips')).toHaveTextContent(
      /Key Tips.*shoulder blades back and down/,
    );
    expect(screen.getByTestId('exercise-guide-mistakes')).toHaveTextContent(/Flaring the elbows/);
  });

  it('swipes to a second page, Technique & Setup, with dots that say which page is showing', async () => {
    render(
      <ExerciseGuideSheet
        visible
        onClose={jest.fn()}
        exerciseId="bench-id"
        exerciseName="Dumbbell Bench Press"
      />,
    );

    expect(await screen.findByTestId('exercise-guide-page-1')).toBeTruthy();
    expect(screen.getByTestId('exercise-guide-technique-target')).toHaveTextContent(
      'Technique & Setup',
    );
    // What makes this exercise what it is: here, how the dumbbells are held.
    expect(screen.getByTestId('exercise-guide-technique-card-0')).toHaveTextContent(
      /Overhand Grip.*Palms facing toward your feet/,
    );
    const dots = screen.getByTestId('exercise-guide-page-dots');
    expect(dots.props.accessibilityLabel).toBe('Page 1 of 2');
    fireEvent.press(screen.getByTestId('exercise-guide-next'));
    expect(screen.getByTestId('exercise-guide-page-dots').props.accessibilityLabel).toBe(
      'Page 2 of 2',
    );
    fireEvent.press(screen.getByTestId('exercise-guide-previous'));
    expect(screen.getByTestId('exercise-guide-page-dots').props.accessibilityLabel).toBe(
      'Page 1 of 2',
    );
  });

  it("falls back on the exercise's own steps when How to Do It has no phases for it", async () => {
    setBuiltinSources({
      extras: async () => extras,
      guide: async () => ({ ...benchGuide, slug: null }),
    });
    render(
      <ExerciseGuideSheet
        visible
        onClose={jest.fn()}
        exerciseId="bench-id"
        exerciseName="Dumbbell Bench Press"
      />,
    );

    expect(await screen.findByTestId('exercise-guide-step-0')).toHaveTextContent(
      /Setup.*Lie back with the dumbbells/,
    );
    expect(screen.getByTestId('exercise-guide-step-1')).toHaveTextContent(/Press them up/);
    expect(screen.getByTestId('exercise-guide-step-2')).toHaveTextContent(/Lower them slowly/);
    expect(screen.getByTestId('exercise-guide-muscle-groups')).toHaveTextContent(
      'Chest · Shoulders · Triceps',
    );
    expect(screen.queryByTestId('exercise-guide-tips')).toBeNull();
    // Nothing drawn, so no second page.
    expect(screen.queryByTestId('exercise-guide-page-dots')).toBeNull();
  });

  it("says when the guide can't be read, and Retry reads it again", async () => {
    let fail = true;
    setBuiltinSources({
      extras: async () => extras,
      guide: async () => {
        if (fail) throw new Error('offline');
        return benchGuide;
      },
    });
    render(
      <ExerciseGuideSheet
        visible
        onClose={jest.fn()}
        exerciseId="bench-id"
        exerciseName="Dumbbell Bench Press"
      />,
    );

    expect(await screen.findByTestId('exercise-guide-error')).toBeTruthy();
    fail = false;
    fireEvent.press(screen.getByTestId('exercise-guide-error-retry'));
    expect(await screen.findByTestId('exercise-guide-steps')).toBeTruthy();
  });

  it('closes with its X', async () => {
    const onClose = jest.fn();
    render(
      <ExerciseGuideSheet
        visible
        onClose={onClose}
        exerciseId="bench-id"
        exerciseName="Dumbbell Bench Press"
      />,
    );
    await screen.findByTestId('exercise-guide-steps');
    fireEvent.press(screen.getByTestId('exercise-guide-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('reads a guide once a session', async () => {
    const { unmount } = render(
      <ExerciseGuideSheet
        visible
        onClose={jest.fn()}
        exerciseId="bench-id"
        exerciseName="Dumbbell Bench Press"
      />,
    );
    await screen.findByTestId('exercise-guide-steps');
    unmount();
    render(
      <ExerciseGuideSheet
        visible
        onClose={jest.fn()}
        exerciseId="bench-id"
        exerciseName="Dumbbell Bench Press"
      />,
    );
    await screen.findByTestId('exercise-guide-steps');
    expect(guideReads).toBe(1);
  });
});

describe('ExercisePhoto for a built-in', () => {
  it('shows the illustrated instructor in place of the first letter, and opens the guide when tapped', async () => {
    render(
      <ExercisePhoto
        testID="photo"
        uri={null}
        name="Dumbbell Bench Press"
        exerciseId="bench-id"
        slug="db-bench-press"
      />,
    );

    expect(screen.getByTestId('photo-illustration')).toBeTruthy();
    expect(screen.getByTestId('photo-guide').props.accessibilityLabel).toBe(
      'How to do Dumbbell Bench Press',
    );
    fireEvent.press(screen.getByTestId('photo-guide'));
    expect(await screen.findByTestId('photo-guide-sheet-steps')).toBeTruthy();
  });

  it("looks the illustration up by the exercise's id when it isn't given one", async () => {
    render(
      <ExercisePhoto testID="photo" uri={null} name="Dumbbell Bench Press" exerciseId="bench-id" />,
    );
    expect(await screen.findByTestId('photo-illustration')).toBeTruthy();
  });

  it("keeps a machine photo, and a person's own exercise its first letter", async () => {
    render(
      <ExercisePhoto
        testID="photo"
        uri="https://example.com/m.jpg"
        name="Dumbbell Bench Press"
        exerciseId="bench-id"
      />,
    );
    expect(screen.queryByTestId('photo-illustration')).toBeNull();
    expect(screen.getByTestId('photo-zoom')).toBeTruthy();

    render(<ExercisePhoto testID="own" uri={null} name="My Press" exerciseId="someone-elses-id" />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId('own-illustration')).toBeNull();
    expect(screen.queryByTestId('own-guide')).toBeNull();
  });

  it('shows everything as before when nothing has plugged in the guides', () => {
    setBuiltinSources(null);
    render(
      <ExercisePhoto testID="photo" uri={null} name="Dumbbell Bench Press" exerciseId="bench-id" />,
    );
    expect(screen.queryByTestId('photo-illustration')).toBeNull();
  });
});

describe('ExerciseDetailsCard for a built-in', () => {
  const details = {
    muscleGroup: 'chest' as const,
    movementType: 'bilateral' as const,
    photoUrl: null,
    gym: null,
    equipment: 'dumbbell' as const,
    grip: null,
    attachment: null,
    loadType: null,
    pulleyPosition: null,
    pulley: null,
  };

  it('offers How to Do It beside the illustration', async () => {
    render(
      <ExerciseDetailsCard
        details={details}
        exerciseName="Dumbbell Bench Press"
        testID="card"
        exerciseId="bench-id"
      />,
    );
    const howTo = await screen.findByTestId('card-how-to');
    fireEvent.press(howTo);
    await waitFor(() => expect(screen.getByTestId('card-guide-steps')).toBeTruthy());
  });

  it("offers nothing more for a person's own exercise", async () => {
    render(
      <ExerciseDetailsCard
        details={details}
        exerciseName="My Press"
        testID="card"
        exerciseId="mine"
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId('card-how-to')).toBeNull();
  });
});
