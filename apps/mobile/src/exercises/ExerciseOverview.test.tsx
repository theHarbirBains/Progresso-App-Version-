import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { forgetBuiltinExtras, setBuiltinSources, type BuiltinExtras } from './builtinExtras';
import { ExerciseOverview } from './ExerciseOverview';
import type { ExerciseDetails } from './exerciseQueries';

jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));
// The video source as it will be once a provider's on: one exercise with a video.
let mockVideoSlug: string | null = null;
jest.mock('./videos/exerciseVideoSource', () => ({
  exerciseVideoFor: (slug: string | null) =>
    slug && slug === mockVideoSlug
      ? { video: 'https://cdn.example.com/v.mp4', poster: 'https://cdn.example.com/v.jpg' }
      : null,
}));

const rowDetails: ExerciseDetails = {
  muscleGroup: 'back',
  movementType: 'bilateral',
  photoUrl: null,
  gym: null,
  equipment: 'cable',
  grip: 'Neutral',
  attachment: 'V-Handle',
  loadType: null,
  pulleyPosition: 'low',
  pulley: null,
};

const extras = new Map<string, BuiltinExtras>([
  [
    'pulldown-id',
    {
      slug: 'cb-lat-pulldown-v-handle',
      secondaryMuscleGroups: ['biceps', 'shoulders'],
      searchAliases: [],
      movementPattern: 'vertical_pull',
      illustrationUrl: null,
    },
  ],
]);

beforeEach(async () => {
  forgetBuiltinExtras();
  setBuiltinSources({ extras: async () => extras, guide: async () => null });
});

afterAll(() => setBuiltinSources(null));

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('ExerciseOverview', () => {
  it("shows a built-in's movement large, its name and muscles under it, and how it's set up", async () => {
    const onOpenGuide = jest.fn();
    render(
      <ExerciseOverview
        details={rowDetails}
        exerciseId="pulldown-id"
        exerciseName="Lat Pulldown — V-Handle"
        accentColor="#D99A50"
        onOpenGuide={onOpenGuide}
      />,
    );
    await settle();
    expect(screen.getByTestId('exercise-overview-hero')).toBeTruthy();
    expect(screen.getByTestId('exercise-overview-name')).toHaveTextContent(/Lat Pulldown/);
    expect(screen.getByTestId('exercise-overview-muscles')).toHaveTextContent(/Primary: Back/);
    expect(screen.getByTestId('exercise-overview-secondary')).toHaveTextContent(
      /Secondary: Biceps, Shoulders/,
    );
    expect(screen.getByTestId('exercise-overview-fact-equipment')).toHaveTextContent(/Cable/);
    expect(screen.getByTestId('exercise-overview-fact-grip')).toHaveTextContent(/Neutral/);
    expect(screen.getByTestId('exercise-overview-fact-attachment')).toHaveTextContent(/V-Handle/);
    expect(screen.getByTestId('exercise-overview-fact-pulley')).toHaveTextContent(/Low pulley/);
    expect(screen.getByTestId('exercise-overview-fact-movement')).toHaveTextContent(
      /Vertical Pull · Pull/,
    );
    // The picture opens the guide.
    fireEvent.press(screen.getByTestId('exercise-overview-hero'));
    expect(onOpenGuide).toHaveBeenCalledTimes(1);
  });

  it("shows a person's own exercise without a photo plainly: its initial, muscle and setup", async () => {
    render(
      <ExerciseOverview
        details={{ ...rowDetails, gym: 'Kits Iron' }}
        exerciseId="mine-id"
        exerciseName="My Row"
        accentColor="#D99A50"
      />,
    );
    await settle();
    expect(screen.queryByTestId('exercise-overview-hero')).toBeNull();
    expect(screen.getByTestId('exercise-overview-muscles')).toHaveTextContent(/Primary: Back/);
    expect(screen.queryByTestId('exercise-overview-secondary')).toBeNull();
    expect(screen.getByTestId('exercise-overview-fact-gym')).toHaveTextContent(/Kits Iron/);
    expect(screen.queryByTestId('exercise-overview-fact-movement')).toBeNull();
    expect(screen.queryByTestId('exercise-overview-how-to')).toBeNull();
  });

  it("shows the muscles a person's own exercise also works, as they chose them", async () => {
    render(
      <ExerciseOverview
        details={{ ...rowDetails, secondaryMuscleGroups: ['biceps', 'forearms'] }}
        exerciseId="mine-id"
        exerciseName="My Row"
        accentColor="#D99A50"
      />,
    );
    await settle();
    expect(screen.getByTestId('exercise-overview-secondary')).toHaveTextContent(
      /Secondary: Biceps, Forearms/,
    );
  });

  it('shows nothing until the details are read', () => {
    render(
      <ExerciseOverview
        details={null}
        exerciseId="pulldown-id"
        exerciseName="Lat Pulldown"
        accentColor="#D99A50"
      />,
    );
    expect(screen.queryByTestId('exercise-overview')).toBeNull();
  });

  it('shows a demonstration video in place of the picture where the exercise has one', async () => {
    mockVideoSlug = 'cb-lat-pulldown-v-handle';
    try {
      render(
        <ExerciseOverview
          details={rowDetails}
          exerciseId="pulldown-id"
          exerciseName="Lat Pulldown — V-Handle"
          accentColor="#D99A50"
          onOpenGuide={jest.fn()}
        />,
      );
      await settle();
      expect(screen.getByTestId('exercise-overview-video')).toBeTruthy();
      expect(screen.queryByTestId('exercise-overview-hero')).toBeNull();
      // Its name and muscles stay under it, as ever.
      expect(screen.getByTestId('exercise-overview-name')).toHaveTextContent(/Lat Pulldown/);
    } finally {
      mockVideoSlug = null;
    }
  });
});
