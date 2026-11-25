import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { SECOND_PROGRAM, TEST_PROGRAM } from '../programs/__fixtures__/programs';
import { activateProgram } from '../programs/programActivation';
import { ProgramHostProvider, type ProgramHost } from '../programs/programHost';
import type { WorkoutProgram } from '../programs/programTypes';
import { NO_PREFERENCES, type ProgramPreferences } from '../programs/recommendations';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { ProgramAddedScreen } from './ProgramAddedScreen';
import { ProgramDayScreen } from './ProgramDayScreen';
import { ProgramDetailScreen } from './ProgramDetailScreen';
import { ProgramExerciseScreen } from './ProgramExerciseScreen';
import { ProgramGuidanceScreen } from './ProgramGuidanceScreen';
import { ProgramVariationsScreen } from './ProgramVariationsScreen';
import { WorkoutProgramsScreen } from './WorkoutProgramsScreen';

// The catalogue is empty until the programs are written; these tests stand in made-up ones.
let mockPrograms: WorkoutProgram[] = [];
jest.mock('../programs/programCatalog', () => ({
  get WORKOUT_PROGRAMS() {
    return mockPrograms;
  },
}));
jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
const mockUpdateProfile = jest.fn();
jest.mock('../profile/ProfileProvider', () => ({
  useProfile: () => ({ profile: null, updateProfile: mockUpdateProfile }),
  useProfileIfAny: () => null,
}));
jest.mock('../programs/programActivation', () => ({ activateProgram: jest.fn() }));

const navigation = {
  navigate: jest.fn(),
  push: jest.fn(),
  goBack: jest.fn(),
  popTo: jest.fn(),
  setParams: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};
const route = <T,>(params: T) => ({ key: 'k', name: 'x', params }) as never;
const props = <T,>(params: T) => ({ navigation: navigation as never, route: route(params) });

beforeEach(() => {
  mockPrograms = [TEST_PROGRAM, SECOND_PROGRAM];
  Object.values(navigation).forEach((fn) => fn.mockClear());
  jest.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as never);
  mockUpdateProfile.mockReset().mockResolvedValue({});
  jest.mocked(activateProgram).mockReset().mockResolvedValue({ id: 'split-9', name: 'x' });
});

// The browser on its own page (onboarding's sheet starts on it; in the app it's Workout Splits'
// Programs tab), with the host's preferences for Recommended for You.
function renderBrowser(preferences: ProgramPreferences = NO_PREFERENCES) {
  return render(
    <ProgramHostProvider host={{ mode: 'onboarding', chosen: null, preferences, use: jest.fn() }}>
      <WorkoutProgramsScreen {...props(undefined)} />
    </ProgramHostProvider>,
  );
}

describe('WorkoutProgramsScreen -- the programs browser', () => {
  it('lists every program by days a week, each on its variation there, and opens one', () => {
    renderBrowser();

    // Every frequency a program has, then All -- on All with nothing to go on.
    for (const days of ['3', '4', '6', 'all']) {
      expect(screen.getByTestId(`workout-programs-browser-days-${days}`)).toBeTruthy();
    }
    expect(screen.queryByTestId('workout-programs-browser-days-5')).toBeNull();
    expect(screen.getByTestId('workout-programs-browser-section-3')).toHaveTextContent(
      /3 Days Per Week.*Test Split.*Balanced.*3 days a week · Traditional.*Beginner to Advanced/,
    );
    expect(screen.getByTestId('workout-programs-browser-section-4')).toHaveTextContent(
      /4 Days Per Week.*Second Program.*4 days a week · Bodybuilding.*Beginner/,
    );
    expect(screen.getByTestId('workout-programs-browser-section-6')).toHaveTextContent(
      /6 Days Per Week.*Test Split/,
    );
    expect(screen.queryByTestId('workout-programs-browser-recommended')).toBeNull();

    fireEvent.press(screen.getByTestId('workout-programs-browser-card-6-test-split'));
    expect(navigation.navigate).toHaveBeenCalledWith('ProgramDetail', {
      programId: 'test-split',
      variationId: 'six',
    });
    expectNoBareText();
  });

  it('narrows to one frequency from the days across the top', () => {
    renderBrowser();
    fireEvent.press(screen.getByTestId('workout-programs-browser-days-4'));

    expect(screen.queryByTestId('workout-programs-browser-section-3')).toBeNull();
    expect(screen.getByTestId('workout-programs-browser-section-4')).toBeTruthy();
    expect(screen.getByTestId('workout-programs-browser-count')).toHaveTextContent(
      '1 of 2 programs',
    );
  });

  it('opens on their own days a week, with what is recommended for them and why', () => {
    renderBrowser({ ...NO_PREFERENCES, daysPerWeek: 3, goals: ['build_muscle'] });

    expect(screen.getByTestId('workout-programs-browser-section-3')).toBeTruthy();
    expect(screen.queryByTestId('workout-programs-browser-section-6')).toBeNull();
    expect(screen.getByTestId('workout-programs-browser-recommended-test-split')).toHaveTextContent(
      /Test Split.*Fits your 3 days a week.*Built for muscle/,
    );
    // Browsing another frequency leaves the recommendations out.
    fireEvent.press(screen.getByTestId('workout-programs-browser-days-all'));
    expect(screen.getByTestId('workout-programs-browser-recommended')).toBeTruthy();
    fireEvent.press(screen.getByTestId('workout-programs-browser-days-6'));
    expect(screen.queryByTestId('workout-programs-browser-recommended')).toBeNull();
  });

  it('applies the filters together, offering only choices some program has', () => {
    renderBrowser();

    fireEvent.press(screen.getByTestId('workout-programs-browser-filter-style'));
    expect(screen.getByTestId('workout-programs-browser-option-strength')).toBeTruthy();
    expect(screen.queryByTestId('workout-programs-browser-option-calisthenics')).toBeNull();
    fireEvent.press(screen.getByTestId('workout-programs-browser-option-strength'));
    expect(screen.getByTestId('workout-programs-browser-filter-style')).toHaveTextContent(
      /Strength/,
    );
    // The strength focus, on its 3-day schedule only.
    expect(screen.getByTestId('workout-programs-browser-section-3')).toHaveTextContent(
      /Strength Focus/,
    );
    expect(screen.queryByTestId('workout-programs-browser-section-6')).toBeNull();

    fireEvent.press(screen.getByTestId('workout-programs-browser-filter-equipment'));
    fireEvent.press(screen.getByTestId('workout-programs-browser-option-dumbbells'));
    expect(screen.getByTestId('workout-programs-browser-none')).toHaveTextContent(
      /No programs match/,
    );

    fireEvent.press(screen.getByTestId('workout-programs-browser-clear-all'));
    expect(screen.getByTestId('workout-programs-browser-section-3')).toBeTruthy();
    expect(screen.getByTestId('workout-programs-browser-section-4')).toBeTruthy();
  });

  it('filters by muscle focus and what a program leaves out, and clears them', () => {
    renderBrowser();
    fireEvent.press(screen.getByTestId('workout-programs-browser-filter-exclusion'));
    fireEvent.press(screen.getByTestId('workout-programs-browser-option-chest'));
    expect(screen.queryByTestId('workout-programs-browser-section-3')).toBeNull();
    expect(screen.getByTestId('workout-programs-browser-section-4')).toBeTruthy();

    fireEvent.press(screen.getByTestId('workout-programs-browser-clear'));
    fireEvent.press(screen.getByTestId('workout-programs-browser-filter-emphasis'));
    fireEvent.press(screen.getByTestId('workout-programs-browser-option-balanced'));
    expect(screen.getByTestId('workout-programs-browser-section-3')).toBeTruthy();
    expect(screen.queryByTestId('workout-programs-browser-section-4')).toBeNull();
  });

  it('says programs are on their way while there are none', () => {
    mockPrograms = [];
    renderBrowser();

    expect(screen.getByTestId('workout-programs-browser-empty')).toHaveTextContent(
      /Programs are on their way/,
    );
    expect(screen.queryByTestId('workout-programs-browser-days')).toBeNull();
  });

  it('closes the sheet from its first page in onboarding', () => {
    const close = jest.fn();
    render(
      <ProgramHostProvider
        host={{
          mode: 'onboarding',
          chosen: null,
          preferences: NO_PREFERENCES,
          use: jest.fn(),
          close,
        }}
      >
        <WorkoutProgramsScreen {...props(undefined)} />
      </ProgramHostProvider>,
    );

    fireEvent.press(screen.getByTestId('workout-programs-close'));
    expect(close).toHaveBeenCalled();
  });
});

describe('ProgramDetailScreen', () => {
  it('overviews the program: what it is, how often, who for, each day, and why', () => {
    render(<ProgramDetailScreen {...props({ programId: 'test-split' })} />);

    expect(screen.getByTestId('program-detail-hero')).toHaveTextContent(
      /Popular.*Test Split.*3-Day · Balanced · Traditional.*Tag One.*Tag Two.*Use Program/,
    );
    const page = screen.getByTestId('program-detail');
    expect(page).toHaveTextContent(/A program made up for the tests\./);
    expect(page).toHaveTextContent(/Frequency.*3 or 6 days per week/);
    expect(page).toHaveTextContent(/Experience.*Beginner to Advanced.*Equipment.*Full Gym/);
    expect(screen.queryByTestId('program-detail-focus')).toBeNull();
    expect(page).toHaveTextContent(/Push.*Chest, Shoulders, Triceps.*Pull.*Back, Biceps/);
    expect(page).toHaveTextContent(/Why Choose This Split\?.*Benefit one.*Benefit two/);
    expectNoBareText();
  });

  it('switches schedules, opens the variations and each day', () => {
    render(<ProgramDetailScreen {...props({ programId: 'test-split', tab: 'schedule' })} />);

    expect(screen.getByTestId('program-detail-day-0')).toHaveTextContent(
      /Day 1.*Push.*Chest, Shoulders, Triceps.*2 exercises/,
    );
    expect(screen.getByTestId('program-detail-note')).toHaveTextContent(
      /A note on the three-day schedule/,
    );
    fireEvent.press(screen.getByTestId('program-detail-schedule-6-Day'));
    expect(navigation.setParams).toHaveBeenCalledWith({ variationId: 'six' });

    fireEvent.press(screen.getByTestId('program-detail-variation'));
    expect(navigation.navigate).toHaveBeenCalledWith('ProgramVariations', {
      programId: 'test-split',
      variationId: 'three-balanced',
    });
    fireEvent.press(screen.getByTestId('program-detail-day-1'));
    expect(navigation.navigate).toHaveBeenCalledWith('ProgramDay', {
      programId: 'test-split',
      variationId: 'three-balanced',
      dayIndex: 1,
    });
  });

  it("shows each day's exercises, as planned, a day at a time", () => {
    render(<ProgramDetailScreen {...props({ programId: 'test-split', tab: 'workouts' })} />);

    expect(screen.getByText('Day 1 — Push')).toBeTruthy();
    expect(screen.getByTestId('program-detail-exercise-0')).toHaveTextContent(
      /Barbell Bench Press.*3 sets · 6–8 reps · Rest 2 min.*A note on this exercise/,
    );
    fireEvent.press(screen.getByTestId('program-detail-day-1'));
    expect(screen.getByTestId('program-detail-exercise-1')).toHaveTextContent(/2 sets · 30–45 s/);
    fireEvent.press(screen.getByTestId('program-detail-exercise-0'));
    expect(navigation.navigate).toHaveBeenCalledWith('ProgramExercise', {
      slug: 'db-bent-over-row',
      programId: 'test-split',
      variationId: 'three-balanced',
      dayIndex: 1,
      exerciseIndex: 0,
    });
  });

  it('lists the guidance topics and the variations', () => {
    render(<ProgramDetailScreen {...props({ programId: 'test-split', tab: 'guidance' })} />);

    fireEvent.press(screen.getByTestId('program-detail-guidance-recovery'));
    expect(navigation.navigate).toHaveBeenCalledWith('ProgramGuidance', {
      programId: 'test-split',
      topic: 'recovery',
    });
    expect(screen.getByTestId('program-detail-guidance-variations')).toBeTruthy();
  });

  it('uses the program, once confirmed, as a split of their own and their active one', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    render(<ProgramDetailScreen {...props({ programId: 'test-split', variationId: 'six' })} />);

    fireEvent.press(screen.getByTestId('program-detail-use'));
    expect(alert).toHaveBeenCalledWith(
      'Use Test Split?',
      expect.stringMatching(/your active split.*stay as they are/),
      expect.any(Array),
    );
    const buttons = alert.mock.calls[0]![2]!;
    await act(async () => {
      buttons.find((b) => b.text === 'Use Program')!.onPress!();
    });

    expect(activateProgram).toHaveBeenCalledWith(
      'user-1',
      TEST_PROGRAM,
      expect.objectContaining({ id: 'six' }),
    );
    expect(mockUpdateProfile).toHaveBeenCalledWith({ activeWorkoutSplitId: 'split-9' });
    expect(navigation.navigate).toHaveBeenCalledWith('ProgramAdded', {
      programId: 'test-split',
      variationId: 'six',
      splitId: 'split-9',
    });
    alert.mockRestore();
  });

  it('only remembers the choice in onboarding, without asking', async () => {
    const use = jest.fn().mockResolvedValue(null);
    render(
      <ProgramHostProvider
        host={{ mode: 'onboarding', chosen: null, preferences: NO_PREFERENCES, use }}
      >
        <ProgramDetailScreen {...props({ programId: 'test-split' })} />
      </ProgramHostProvider>,
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('program-detail-use'));
    });
    expect(use).toHaveBeenCalledWith({ programId: 'test-split', variationId: 'three-balanced' });
    expect(activateProgram).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith('ProgramAdded', {
      programId: 'test-split',
      variationId: 'three-balanced',
      splitId: null,
    });
  });
});

describe('ProgramDayScreen', () => {
  it('lists the day, what it trains, and its exercises to open', () => {
    render(
      <ProgramDayScreen
        {...props({ programId: 'test-split', variationId: 'three-balanced', dayIndex: 0 })}
      />,
    );

    const page = screen.getByTestId('program-day');
    expect(page).toHaveTextContent(/Day 1 — Push.*Chest, Shoulders, Triceps.*2 exercises · 6 sets/);
    expect(screen.getByTestId('program-day-exercise-1')).toHaveTextContent(
      /Dumbbell Lateral Raise.*3 sets · 12–15 reps/,
    );
    fireEvent.press(screen.getByTestId('program-day-exercise-1'));
    expect(navigation.navigate).toHaveBeenCalledWith(
      'ProgramExercise',
      expect.objectContaining({ slug: 'db-lateral-raise', dayIndex: 0, exerciseIndex: 1 }),
    );
  });
});

describe('ProgramExerciseScreen', () => {
  const planned = {
    slug: 'bb-bench-press',
    programId: 'test-split',
    variationId: 'three-balanced',
    dayIndex: 0,
    exerciseIndex: 0,
  };

  it('shows how to do it, and what the program plans for it', () => {
    render(<ProgramExerciseScreen {...props(planned)} />);

    expect(screen.getByTestId('program-exercise')).toHaveTextContent(/Barbell Bench Press/);
    expect(screen.getByTestId('program-exercise-plan')).toHaveTextContent(
      /3 sets · 6–8 reps.*2 min.*A note on this exercise/,
    );
    for (const i of [0, 1, 2]) {
      expect(screen.getByTestId(`program-exercise-step-${i}`)).toHaveTextContent(
        new RegExp(`${i + 1}`),
      );
    }
  });

  it("offers the program's alternatives, each opening its own page", () => {
    render(<ProgramExerciseScreen {...props(planned)} />);

    fireEvent.press(screen.getByTestId('program-exercise-tabs-alternatives'));
    fireEvent.press(screen.getByTestId('program-exercise-alternative-db-bench-press'));
    expect(navigation.push).toHaveBeenCalledWith('ProgramExercise', { slug: 'db-bench-press' });
  });

  it("gives the program's tips first, then the exercise's Key Tips", () => {
    render(<ProgramExerciseScreen {...props(planned)} />);

    fireEvent.press(screen.getByTestId('program-exercise-tabs-tips'));
    expect(screen.getByTestId('program-exercise-program-tips')).toHaveTextContent(
      /A tip from the program/,
    );
    expect(screen.getByTestId('program-exercise-key-tips')).toBeTruthy();
  });

  it('shows an alternative on its own, without a plan or alternatives', () => {
    render(<ProgramExerciseScreen {...props({ slug: 'db-bench-press' })} />);

    expect(screen.queryByTestId('program-exercise-plan')).toBeNull();
    expect(screen.queryByTestId('program-exercise-tabs-alternatives')).toBeNull();
    expect(screen.getByTestId('program-exercise')).toHaveTextContent(/Dumbbell Bench Press/);
  });
});

describe('ProgramGuidanceScreen', () => {
  it("gives the program's own words, then how Progresso helps", () => {
    render(<ProgramGuidanceScreen {...props({ programId: 'test-split', topic: 'progression' })} />);

    expect(screen.getByTestId('program-guidance-program')).toHaveTextContent(
      /The program says this about progression/,
    );
    expect(screen.getByTestId('program-guidance-app')).toHaveTextContent(/go up in weight/);
  });

  it('says only how Progresso helps where the program has said nothing', () => {
    render(<ProgramGuidanceScreen {...props({ programId: 'test-split', topic: 'recovery' })} />);

    expect(screen.queryByTestId('program-guidance-program')).toBeNull();
    expect(screen.getByTestId('program-guidance-app')).toHaveTextContent(/warm-up/);
  });
});

describe('ProgramVariationsScreen', () => {
  it("lists each schedule's variations, the one showing ticked, and goes back on one chosen", () => {
    render(
      <ProgramVariationsScreen
        {...props({ programId: 'test-split', variationId: 'three-balanced' })}
      />,
    );

    expect(screen.getByTestId('program-variation-three-balanced')).toHaveTextContent(
      /Balanced \(Default\).*3 days a week.*A note on the balanced focus/,
    );
    expect(screen.getByTestId('program-variation-three-balanced').props.accessibilityState).toEqual(
      { selected: true },
    );
    fireEvent.press(screen.getByTestId('program-variation-three-strength'));
    expect(navigation.popTo).toHaveBeenCalledWith(
      'ProgramDetail',
      { programId: 'test-split', variationId: 'three-strength' },
      { merge: true },
    );
  });
});

describe('ProgramAddedScreen', () => {
  it('says the program is added, with the split, a way to it and to more programs', () => {
    render(
      <ProgramAddedScreen
        {...props({ programId: 'test-split', variationId: 'three-balanced', splitId: 'split-9' })}
      />,
    );

    expect(screen.getByTestId('program-added')).toHaveTextContent(/Program Added!/);
    expect(screen.getByTestId('program-added-split')).toHaveTextContent(
      /Test Split \(3-Day, Balanced\).*3-Day Split · Push · Pull · Legs/,
    );
    fireEvent.press(screen.getByTestId('program-added-view-split'));
    expect(navigation.navigate).toHaveBeenCalledWith('WorkoutSplitView', { splitId: 'split-9' });
    // In the app the programs are Workout Splits' Programs tab.
    fireEvent.press(screen.getByTestId('program-added-explore'));
    expect(navigation.popTo).toHaveBeenCalledWith('WorkoutSplits', { tab: 'programs' });
  });

  it('goes on with onboarding once a program is chosen there', async () => {
    const finish = jest.fn();
    const host: ProgramHost = {
      mode: 'onboarding',
      chosen: null,
      preferences: NO_PREFERENCES,
      use: jest.fn(),
      finish,
    };
    render(
      <ProgramHostProvider host={host}>
        <ProgramAddedScreen
          {...props({ programId: 'test-split', variationId: 'three-balanced', splitId: null })}
        />
      </ProgramHostProvider>,
    );

    expect(screen.getByTestId('program-added')).toHaveTextContent(
      /Program Chosen!.*as soon as your account is made/,
    );
    expect(screen.queryByTestId('program-added-view-split')).toBeNull();
    fireEvent.press(screen.getByTestId('program-added-continue'));
    await waitFor(() => expect(finish).toHaveBeenCalled());
  });
});
