import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Image } from 'expo-image';
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
import { illustrationFor } from './illustrations/exerciseArt';
import { BUILTIN_GUIDES } from './illustrations/builtinGuides.generated';
import { ExercisePhases, ExerciseThumbnail } from './illustrations/ExerciseIllustration';
import { GUIDE_CARDS } from './illustrations/guideCards.generated';
import { EXERCISE_RENDERS, RENDER_ANCHORS } from './illustrations/renders.generated';
import { TechniqueVisual } from './illustrations/TechniqueVisuals';
import { removeOwnPhoto, saveOwnPhoto, setOwnPhotoSource, type OwnPhotoSource } from './ownPhotos';

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
    expect(screen.getByTestId('exercise-guide-illustration-label-0')).toHaveTextContent(/Setup/);
    expect(screen.getByTestId('exercise-guide-illustration-label-1')).toHaveTextContent(/Press/);
    expect(screen.getByTestId('exercise-guide-illustration-label-2')).toHaveTextContent(/Lower/);
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

describe('a photo of your own machine for a built-in', () => {
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
  const saved = new Map<string, string>();
  const stub: OwnPhotoSource = {
    read: async () => new Map(saved),
    save: async (exerciseId) => {
      saved.set(exerciseId, 'https://example.test/my-machine.jpg');
      return 'https://example.test/my-machine.jpg';
    },
    remove: async (exerciseId) => {
      saved.delete(exerciseId);
    },
  };

  beforeEach(() => {
    saved.clear();
    setOwnPhotoSource(stub);
  });
  afterEach(() => setOwnPhotoSource(null));

  it('is offered on the exercise page, and How to Do It stays there once it replaces the drawing', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(
      <ExerciseDetailsCard
        details={details}
        exerciseName="Dumbbell Bench Press"
        testID="card"
        exerciseId="bench-id"
      />,
    );
    const action = await screen.findByTestId('card-photo-action');
    expect(action).toHaveTextContent('Add Your Machine Photo');
    fireEvent.press(action);
    expect(alert).toHaveBeenCalledWith(
      'Add Your Machine Photo',
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ text: 'Take Photo' })]),
    );
    alert.mockRestore();

    await act(async () => {
      await saveOwnPhoto('bench-id', 'file:///picked.jpg');
    });
    expect(screen.getByTestId('card-photo-action')).toHaveTextContent('Change Photo');
    // The drawing gives way to the photo; the guide is still a tap away.
    expect(screen.queryByTestId('card-photo-illustration')).toBeNull();
    expect(screen.getByTestId('card-how-to')).toBeTruthy();
  });

  it('shows in place of the drawing wherever the exercise is, until it is removed', async () => {
    saved.set('bench-id', 'https://example.test/my-machine.jpg');
    render(
      <ExercisePhoto
        testID="photo"
        uri={null}
        name="Dumbbell Bench Press"
        exerciseId="bench-id"
        slug="db-bench-press"
      />,
    );
    await waitFor(() => expect(screen.queryByTestId('photo-illustration')).toBeNull());

    await act(async () => {
      await removeOwnPhoto('bench-id');
    });
    expect(screen.getByTestId('photo-illustration')).toBeTruthy();
  });
});

describe('the 3D renders', () => {
  it("shows a rendered exercise's three phases still, side by side", () => {
    jest.useFakeTimers();
    render(<ExercisePhases slug="db-bench-press" accent="#D99A50" testID="phases" />);
    fireEvent(screen.getByTestId('phases'), 'layout', {
      nativeEvent: { layout: { width: 320, height: 240, x: 0, y: 0 } },
    });
    const frames = EXERCISE_RENDERS['db-bench-press'].frames;
    const shown = () => [0, 1, 2].map((i) => screen.getByTestId(`phases-render-${i}`).props.source);
    // The way back is drawn from the setup's frame.
    expect(shown()).toEqual([frames[0], frames[1], frames[0]]);
    expect(screen.queryByTestId('phases-stacked')).toBeNull();
    expect(screen.getByTestId('phases-label-1')).toHaveTextContent(/Press/);
    // Nothing moves on by itself.
    act(() => jest.advanceTimersByTime(10000));
    expect(shown()).toEqual([frames[0], frames[1], frames[0]]);
    jest.useRealTimers();
  });

  it('has, for every rendered exercise, a frame and its positions for each drawn frame, and a thumbnail', () => {
    for (const [slug, rendered] of Object.entries(EXERCISE_RENDERS)) {
      const frames = illustrationFor(slug)?.frames.length;
      expect(frames).toBeGreaterThan(0);
      expect(rendered.frames).toHaveLength(frames!);
      expect(rendered.anchors).toHaveLength(frames!);
      expect(rendered.thumb).toBeTruthy();
      for (const points of rendered.anchors) {
        expect(points).toHaveLength(RENDER_ANCHORS.length * 2);
        // Every part is in the picture.
        for (const v of points) expect(v >= 0 && v <= 1).toBe(true);
      }
    }
  });

  it('shows a rendered exercise in a list by its thumbnail', () => {
    render(<ExerciseThumbnail slug="db-bench-press" size={44} testID="thumb" />);
    expect(screen.UNSAFE_getByType(Image).props.source).toBe(
      EXERCISE_RENDERS['db-bench-press'].thumb,
    );
  });

  it("crops Technique & Setup's close look from the render, around the part it's about", () => {
    render(
      <TechniqueVisual
        slug="db-bench-press"
        visual={{ kind: 'closeup', focus: 'hands', frame: 1 }}
        accent="#D99A50"
        size={112}
      />,
    );
    const image = screen.getByTestId('technique-closeup-render');
    expect(image.props.source).toBe(EXERCISE_RENDERS['db-bench-press'].frames[1]);
    // Zoomed in (the picture is bigger than its frame), the hands inside the frame.
    const { left, top, width } = image.props.style;
    expect(width).toBeGreaterThan(112);
    const hands = RENDER_ANCHORS.indexOf('hands');
    const frame = EXERCISE_RENDERS['db-bench-press'].anchors[1]!;
    const [hx, hy] = [frame[2 * hands]!, frame[2 * hands + 1]!];
    expect(left + hx * width).toBeGreaterThan(0);
    expect(left + hx * width).toBeLessThan(112);
    expect(top + hy * width).toBeGreaterThan(0);
    expect(top + hy * width).toBeLessThan(112);
  });
});

describe("an exercise's own guide cards", () => {
  const squatGuide: ExerciseGuide = {
    ...benchGuide,
    name: 'Barbell Back Squat',
    muscleGroup: 'quadriceps',
    equipment: 'barbell',
    slug: 'bb-back-squat',
    commonMistakes: ['Letting the knees cave in.'],
  };
  beforeEach(() => {
    setBuiltinSources({
      extras: async () =>
        new Map([
          ...extras,
          [
            'squat-id',
            {
              slug: 'bb-back-squat',
              secondaryMuscleGroups: [],
              searchAliases: [],
              movementPattern: 'squat',
              illustrationUrl: null,
            },
          ],
        ]),
      guide: async (id) => (id === 'squat-id' ? squatGuide : null),
    });
  });
  const open = () =>
    render(
      <ExerciseGuideSheet
        visible
        onClose={jest.fn()}
        exerciseId="squat-id"
        exerciseName="Barbell Back Squat"
      />,
    );
  const measure = (testID: string, width: number, height: number) =>
    fireEvent(screen.getByTestId(testID), 'layout', {
      nativeEvent: { layout: { width, height, x: 0, y: 0 } },
    });

  it('are two pages, swiped between, in place of the drawn guide', async () => {
    open();
    expect(await screen.findByTestId('exercise-guide-card-page-0-zoom')).toBeTruthy();
    measure('exercise-guide-card-page-0-zoom', 390, 640);
    measure('exercise-guide-card-page-1-zoom', 390, 640);
    const [first, second] = GUIDE_CARDS['bb-back-squat'];
    expect(screen.getByTestId('exercise-guide-card-page-0').props.source).toBe(first.image);
    expect(screen.getByTestId('exercise-guide-card-page-1').props.source).toBe(second.image);
    // Just the cards: their own title, none of the drawn page.
    expect(screen.queryByText('HOW TO DO IT')).toBeNull();
    expect(screen.queryByTestId('exercise-guide-steps')).toBeNull();
    expect(screen.queryByTestId('exercise-guide-illustration')).toBeNull();
    expect(screen.queryByTestId('exercise-guide-page-2')).toBeNull();
    expect(screen.getByTestId('exercise-guide-page-dots').props.accessibilityLabel).toBe(
      'Page 1 of 2',
    );
    fireEvent.press(screen.getByTestId('exercise-guide-next'));
    expect(screen.getByTestId('exercise-guide-page-dots').props.accessibilityLabel).toBe(
      'Page 2 of 2',
    );
  });

  it('fit the page whole, by its width or, on a short page, its height', async () => {
    open();
    await screen.findByTestId('exercise-guide-card-page-0-zoom');
    const { aspect } = GUIDE_CARDS['bb-back-squat'][0];
    const size = () => screen.getByTestId('exercise-guide-card-page-0').props.style;
    // Its width, less the margins either side.
    measure('exercise-guide-card-page-0-zoom', 390, 640);
    expect(size()).toEqual({ width: 358, height: 358 / aspect });
    measure('exercise-guide-card-page-0-zoom', 390, 300);
    expect(size()).toEqual({ width: 300 * aspect, height: 300 });
  });

  it("say what's on them to VoiceOver, in the guide's own words", async () => {
    open();
    await screen.findByTestId('exercise-guide-card-page-0-zoom');
    measure('exercise-guide-card-page-0-zoom', 390, 640);
    measure('exercise-guide-card-page-1-zoom', 390, 640);
    const own = BUILTIN_GUIDES['bb-back-squat'];
    await waitFor(() =>
      expect(screen.getByTestId('exercise-guide-card-page-0').props.accessibilityLabel).toMatch(
        /Common mistakes: Letting the knees cave in\./,
      ),
    );
    const how = screen.getByTestId('exercise-guide-card-page-0').props.accessibilityLabel;
    expect(how).toMatch(/^How to do Barbell Back Squat\. 1, Setup: /);
    expect(how).toContain(own.rows[1]);
    expect(how).toContain(`Key tips: ${own.tips[0]}`);
    const technique = screen.getByTestId('exercise-guide-card-page-1').props.accessibilityLabel;
    expect(technique).toMatch(/^Barbell Back Squat, technique and setup\./);
    expect(technique).toContain(`${own.technique[0].title}: ${own.technique[0].text}`);
  });

  it('show without waiting on the guide, and even when it cannot be read', async () => {
    setBuiltinSources({
      extras: async () =>
        new Map([
          [
            'squat-id',
            {
              slug: 'bb-back-squat',
              secondaryMuscleGroups: [],
              searchAliases: [],
              movementPattern: 'squat',
              illustrationUrl: null,
            },
          ],
        ]),
      guide: async () => {
        throw new Error('offline');
      },
    });
    open();
    expect(await screen.findByTestId('exercise-guide-card-page-0-zoom')).toBeTruthy();
    expect(screen.queryByTestId('exercise-guide-error')).toBeNull();
  });

  it('are, for each exercise that has them, an active built-in with two whole pages', () => {
    const slugs = Object.keys(GUIDE_CARDS);
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) {
      expect(BUILTIN_GUIDES[slug]).toBeTruthy();
      expect(GUIDE_CARDS[slug]).toHaveLength(2);
      for (const page of GUIDE_CARDS[slug]) {
        expect(page.image).toBeTruthy();
        expect(page.aspect).toBeGreaterThan(0.4);
        expect(page.aspect).toBeLessThan(1.5);
      }
    }
  });
});
