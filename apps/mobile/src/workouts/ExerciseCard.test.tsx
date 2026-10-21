import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Card } from '../design/Card';
import { typeScale } from '../design/theme';
import { arePropsEqual, ExerciseCard } from './ExerciseCard';

/** Opens the exercise's menu, where reorder, its own range and remove are. */
function openMenu() {
  fireEvent.press(screen.getByTestId('exercise-card-menu'));
}

const baseProps = {
  exerciseName: 'Barbell Bench Press',
  muscleGroup: 'chest' as const,
  movementType: 'bilateral' as const,
  sets: [{ id: 's1', setIndex: 1, weight: '', reps: '', completed: false, canComplete: false }],
  unilateralSets: [],
  onChangeWeight: jest.fn(),
  onChangeReps: jest.fn(),
  onToggleComplete: jest.fn(),
  onAddSet: jest.fn(),
  onRemoveExercise: jest.fn(),
  accentColor: '#2F80FF',
  onAccentColor: '#06201C',
  testID: 'exercise-card',
};

const oneUnilateralSet = [
  {
    setIndex: 1,
    left: { id: 'l1', weight: '42.5', reps: '10', completed: false, canComplete: true },
    right: { id: 'r1', weight: '40', reps: '10', completed: false, canComplete: true },
  },
];

describe('ExerciseCard', () => {
  it('shows the exercise name and the muscle group from real exercise data (not hardcoded)', () => {
    render(<ExerciseCard {...baseProps} muscleGroup="shoulders" />);

    expect(screen.getByText('Barbell Bench Press')).toBeTruthy();
    expect(screen.getByText('Shoulders')).toBeTruthy();
  });

  it("shows the exercise's initial when it has no photo, with nothing to open", () => {
    render(<ExerciseCard {...baseProps} />);

    expect(screen.getByTestId('exercise-card-photo')).toHaveTextContent('B');
    expect(screen.queryByTestId('exercise-card-photo-zoom')).toBeNull();
  });

  it('shows its photo when it has one, opening full size on a tap', () => {
    render(<ExerciseCard {...baseProps} photoUrl="https://example.com/bench.jpg" />);

    expect(screen.queryByTestId('exercise-card-photo-lightbox')).toBeNull();
    fireEvent.press(screen.getByTestId('exercise-card-photo-zoom'));
    expect(screen.getByTestId('exercise-card-photo-lightbox')).toBeTruthy();
  });

  it('renders exactly one set row for a newly added exercise', () => {
    render(<ExerciseCard {...baseProps} />);

    expect(screen.getByTestId('exercise-card-set-s1')).toBeTruthy();
  });

  it('calls onAddSet when Add Set is pressed', () => {
    const onAddSet = jest.fn();
    render(<ExerciseCard {...baseProps} onAddSet={onAddSet} />);

    fireEvent.press(screen.getByTestId('exercise-card-add-set'));

    expect(onAddSet).toHaveBeenCalled();
  });

  it('calls onRemoveExercise when the remove control is pressed', () => {
    const onRemoveExercise = jest.fn();
    render(<ExerciseCard {...baseProps} onRemoveExercise={onRemoveExercise} />);

    expect(screen.queryByTestId('exercise-card-remove')).toBeNull();
    openMenu();
    fireEvent.press(screen.getByTestId('exercise-card-remove'));

    expect(onRemoveExercise).toHaveBeenCalled();
    // The menu closes once an action is taken.
    expect(screen.queryByTestId('exercise-card-actions')).toBeNull();
  });

  it('offers no remove control on a set row when onRemoveSet is omitted', () => {
    render(<ExerciseCard {...baseProps} />);

    expect(screen.queryByTestId('exercise-card-set-s1-remove')).toBeNull();
  });

  it('calls onRemoveSet, by set id, when a set row is removed', () => {
    const onRemoveSet = jest.fn();
    render(<ExerciseCard {...baseProps} onRemoveSet={onRemoveSet} />);

    fireEvent.press(screen.getByTestId('exercise-card-set-s1-remove'));

    expect(onRemoveSet).toHaveBeenCalledWith('s1');
  });

  it("calls onRemoveSet with the left side's id when a unilateral set row is removed", () => {
    const onRemoveSet = jest.fn();
    render(
      <ExerciseCard
        {...baseProps}
        movementType="unilateral"
        unilateralSets={oneUnilateralSet}
        onRemoveSet={onRemoveSet}
      />,
    );

    fireEvent.press(screen.getByTestId('exercise-card-set-1-remove'));

    expect(onRemoveSet).toHaveBeenCalledWith('l1');
  });

  it('does not render reorder controls when onMoveUp/onMoveDown are omitted', () => {
    render(<ExerciseCard {...baseProps} />);
    openMenu();

    expect(screen.queryByTestId('exercise-card-move-up')).toBeNull();
    expect(screen.queryByTestId('exercise-card-move-down')).toBeNull();
  });

  it('calls onMoveUp/onMoveDown when reorder controls are pressed', () => {
    const onMoveUp = jest.fn();
    const onMoveDown = jest.fn();
    render(<ExerciseCard {...baseProps} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />);

    openMenu();
    fireEvent.press(screen.getByTestId('exercise-card-move-up'));
    openMenu();
    fireEvent.press(screen.getByTestId('exercise-card-move-down'));

    expect(onMoveUp).toHaveBeenCalled();
    expect(onMoveDown).toHaveBeenCalled();
  });

  it('does not render RIR, RPE, or estimated calories anywhere', () => {
    render(<ExerciseCard {...baseProps} />);

    expect(screen.queryByText(/RIR/i)).toBeNull();
    expect(screen.queryByText(/RPE/i)).toBeNull();
    expect(screen.queryByText(/calor/i)).toBeNull();
  });

  it('shows no Last Time when there is no prior session', () => {
    render(<ExerciseCard {...baseProps} />);

    expect(screen.queryByTestId('exercise-card-last')).toBeNull();
    expect(screen.queryByTestId('exercise-card-previous-session')).toBeNull();
  });

  it('shows every set from the last session, in order, in a carousel, and its top set', () => {
    render(
      <ExerciseCard
        {...baseProps}
        previousSession={{
          dateDisplay: 'Sep 1, 2026',
          topSetDisplay: '225 lb × 5',
          topSetNumber: 1,
          sets: [
            {
              setNumber: 1,
              weightDisplay: '225',
              unit: 'lb',
              reps: 5,
              side: null,
            },
            {
              setNumber: 2,
              weightDisplay: '220',
              unit: 'lb',
              reps: 5,
              side: null,
            },
            {
              setNumber: 3,
              weightDisplay: '215',
              unit: 'lb',
              reps: 6,
              side: null,
            },
          ],
        }}
      />,
    );

    expect(screen.getByTestId('exercise-card-previous-session')).toHaveTextContent(
      /Last Time's Sets/,
    );
    expect(screen.getByTestId('exercise-card-last')).toHaveTextContent(
      /Last Time.*225 lb × 5.*Sep 1, 2026 · 3 sets/,
    );
    expect(screen.getByTestId('exercise-card-previous-set-1')).toHaveTextContent(
      /Set 1 of 3.*225 lb × 5.*Top Set/,
    );
    expect(screen.getByTestId('exercise-card-previous-set-2')).toHaveTextContent(/220 lb × 5/);
    expect(screen.getByTestId('exercise-card-previous-set-2')).not.toHaveTextContent(/Top Set/);
    expect(screen.getByTestId('exercise-card-previous-set-3')).toHaveTextContent(/215 lb × 6/);
    // One dot per set, the first showing.
    expect(screen.getByTestId('exercise-card-previous-dot-0').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(screen.getByTestId('exercise-card-previous-dot-2')).toBeTruthy();
  });

  it("shows a side tag for a unilateral exercise's previous sets", () => {
    render(
      <ExerciseCard
        {...baseProps}
        previousSession={{
          dateDisplay: 'Sep 1, 2026',
          sets: [
            {
              setNumber: 1,
              weightDisplay: '42.5',
              unit: 'lb',
              reps: 10,
              side: 'left',
            },
          ],
        }}
      />,
    );

    expect(screen.getByTestId('exercise-card-previous-set-1')).toHaveTextContent(
      /Set 1 of 1 · Left.*42\.5 lb × 10/,
    );
  });

  it('calls onViewHistory when View History is pressed', () => {
    const onViewHistory = jest.fn();
    render(
      <ExerciseCard
        {...baseProps}
        previousSession={{
          dateDisplay: 'Sep 1, 2026',
          sets: [
            {
              setNumber: 1,
              weightDisplay: '225',
              unit: 'lb',
              reps: 5,
              side: null,
            },
          ],
        }}
        onViewHistory={onViewHistory}
      />,
    );

    fireEvent.press(screen.getByTestId('exercise-card-view-history'));

    expect(onViewHistory).toHaveBeenCalled();
  });

  it('renders multiple sets in order when there are several', () => {
    render(
      <ExerciseCard
        {...baseProps}
        sets={[
          { id: 's1', setIndex: 1, weight: '100', reps: '8', completed: true, canComplete: true },
          { id: 's2', setIndex: 2, weight: '', reps: '', completed: false, canComplete: false },
        ]}
      />,
    );

    expect(screen.getByTestId('exercise-card-set-s1')).toBeTruthy();
    expect(screen.getByTestId('exercise-card-set-s2')).toBeTruthy();
  });
});

describe('ExerciseCard (unilateral exercise)', () => {
  it('renders Left/Right rows per logical set instead of a single weight/reps row', () => {
    render(
      <ExerciseCard
        {...baseProps}
        exerciseName="Bulgarian Split Squat"
        muscleGroup="quadriceps"
        movementType="unilateral"
        sets={[]}
        unilateralSets={oneUnilateralSet}
      />,
    );

    const row = screen.getByTestId('exercise-card-set-1');
    expect(row).toBeTruthy();
    expect(screen.getByTestId('exercise-card-set-1-left-weight').props.value).toBe('42.5');
    expect(screen.getByTestId('exercise-card-set-1-right-weight').props.value).toBe('40');
  });

  it('makes it explicit that weight is per side', () => {
    render(
      <ExerciseCard
        {...baseProps}
        movementType="unilateral"
        sets={[]}
        unilateralSets={oneUnilateralSet}
      />,
    );

    expect(screen.getByTestId('exercise-card-per-side-note')).toHaveTextContent(
      'Weight is per side',
    );
  });

  it('does not show the per-side note for a bilateral exercise', () => {
    render(<ExerciseCard {...baseProps} />);

    expect(screen.queryByTestId('exercise-card-per-side-note')).toBeNull();
  });

  it('reports the completed set by its id, so the screen can route it to the unilateral path', () => {
    const onToggleComplete = jest.fn();
    render(
      <ExerciseCard
        {...baseProps}
        movementType="unilateral"
        sets={[]}
        unilateralSets={oneUnilateralSet}
        onToggleComplete={onToggleComplete}
      />,
    );

    fireEvent.press(screen.getByTestId('exercise-card-set-1-complete'));

    expect(onToggleComplete).toHaveBeenCalledWith('l1');
  });

  it('requires BOTH sides to be valid before the set can be completed', () => {
    render(
      <ExerciseCard
        {...baseProps}
        movementType="unilateral"
        sets={[]}
        unilateralSets={[
          {
            setIndex: 1,
            left: { id: 'l1', weight: '42.5', reps: '10', completed: false, canComplete: true },
            right: { id: 'r1', weight: '', reps: '', completed: false, canComplete: false },
          },
        ]}
      />,
    );

    expect(
      screen.getByTestId('exercise-card-set-1-complete').props.accessibilityState.disabled,
    ).toBe(true);
  });

  it("routes weight and reps changes by the side's own set id", () => {
    const onChangeWeight = jest.fn();
    const onChangeReps = jest.fn();
    render(
      <ExerciseCard
        {...baseProps}
        movementType="unilateral"
        sets={[]}
        unilateralSets={oneUnilateralSet}
        onChangeWeight={onChangeWeight}
        onChangeReps={onChangeReps}
      />,
    );

    fireEvent.changeText(screen.getByTestId('exercise-card-set-1-left-weight'), '45');
    fireEvent.changeText(screen.getByTestId('exercise-card-set-1-right-reps'), '8');

    expect(onChangeWeight).toHaveBeenCalledWith('l1', '45');
    expect(onChangeReps).toHaveBeenCalledWith('r1', '8');
  });
});

describe('ExerciseCard -- a widget, with its records, last time and today', () => {
  const previousSession = {
    dateDisplay: 'Sep 1, 2026',
    topSetDisplay: '225 lb × 5',
    topSetNumber: 1,
    sets: [
      { setNumber: 1, weightDisplay: '225', unit: 'lb' as const, reps: 5, side: null },
      {
        setNumber: 2,
        weightDisplay: '42.5',
        unit: 'lb' as const,
        reps: 10,
        side: 'right' as const,
      },
    ],
  };

  it('is one widget, with the muscle group as plain text, not a badge', () => {
    render(<ExerciseCard {...baseProps} />);

    expect(screen.UNSAFE_queryAllByType(Card)).toHaveLength(1);
    const muscle = screen.getByTestId('exercise-card-muscle-group');
    expect(StyleSheet.flatten(muscle.props.style).backgroundColor).toBeUndefined();
  });

  it('opens and closes its menu from a named 44pt "more" glyph, each action named for assistive tech', () => {
    render(
      <ExerciseCard
        {...baseProps}
        onMoveUp={jest.fn()}
        onMoveDown={jest.fn()}
        onEditProgression={jest.fn()}
      />,
    );

    const more = screen.getByTestId('exercise-card-menu');
    expect(more.props.accessibilityLabel).toBe('Barbell Bench Press options');
    expect(more.props.accessibilityState).toEqual({ expanded: false });
    expect(StyleSheet.flatten(more.props.style).height).toBeGreaterThanOrEqual(44);

    openMenu();
    expect(screen.getByTestId('exercise-card-menu').props.accessibilityState).toEqual({
      expanded: true,
    });
    for (const [id, label] of [
      ['exercise-card-move-up', 'Move exercise up'],
      ['exercise-card-move-down', 'Move exercise down'],
      ['exercise-card-range', 'Change the rep range for Barbell Bench Press'],
      ['exercise-card-remove', 'Remove exercise'],
    ] as const) {
      const control = screen.getByTestId(id);
      expect(control.props.accessibilityLabel).toBe(label);
      expect(StyleSheet.flatten(control.props.style).minHeight).toBeGreaterThanOrEqual(44);
    }

    openMenu();
    expect(screen.queryByTestId('exercise-card-actions')).toBeNull();
  });

  it('opens its own rep range from the menu', () => {
    const onEditProgression = jest.fn();
    render(<ExerciseCard {...baseProps} onEditProgression={onEditProgression} />);

    openMenu();
    fireEvent.press(screen.getByTestId('exercise-card-range'));

    expect(onEditProgression).toHaveBeenCalled();
  });

  it('names a range only when the exercise has one of its own', () => {
    const { rerender } = render(<ExerciseCard {...baseProps} />);
    expect(screen.queryByTestId('exercise-card-own-range')).toBeNull();

    rerender(<ExerciseCard {...baseProps} ownRangeText="Own range 3–5" />);
    expect(screen.getByTestId('exercise-card-own-range')).toHaveTextContent('Own range 3–5');
  });

  it("reads each of last time's sets aloud as a whole sentence for assistive tech", () => {
    render(<ExerciseCard {...baseProps} previousSession={previousSession} />);

    expect(screen.getByTestId('exercise-card-previous-set-1').props.accessibilityLabel).toBe(
      'Set 1 of 2: 225 lb × 5, top set',
    );
    expect(screen.getByTestId('exercise-card-previous-set-2').props.accessibilityLabel).toBe(
      'Set 2 of 2 · Right: 42.5 lb × 10',
    );
  });

  it("shows each of last time's sets as a large mono readout", () => {
    render(<ExerciseCard {...baseProps} previousSession={previousSession} />);

    const value = within(screen.getByTestId('exercise-card-previous-set-1')).getByText(
      '225 lb × 5',
    );
    expect(StyleSheet.flatten(value.props.style).fontFamily).toBe(typeScale.statLarge.fontFamily);
  });

  it("puts today's sets under their own heading", () => {
    render(<ExerciseCard {...baseProps} previousSession={previousSession} />);

    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('gives Add Set a full-width 44pt secondary button', () => {
    render(<ExerciseCard {...baseProps} />);

    const add = screen.getByTestId('exercise-card-add-set');
    expect(add).toHaveTextContent('+ Add Set');
    expect(add.props.accessibilityLabel).toBe('Add Set');
    expect(StyleSheet.flatten(add.props.style).minHeight).toBeGreaterThanOrEqual(44);
  });

  it('labels each unilateral side L and R', () => {
    render(
      <ExerciseCard
        {...baseProps}
        movementType="unilateral"
        sets={[]}
        unilateralSets={oneUnilateralSet}
      />,
    );

    const set = within(screen.getByTestId('exercise-card-set-1'));
    expect(set.getByText('L')).toBeTruthy();
    expect(set.getByText('R')).toBeTruthy();
    expect(screen.getByTestId('exercise-card-set-1-left-weight').props.accessibilityLabel).toBe(
      'Set 1 left weight',
    );
  });
});

// Regression coverage for the reported bug: ActiveWorkoutScreen rebuilds
// every exercise's sets/unilateralSets/previousSession as fresh array/object
// literals on every render (they're derived from one flat setInputs map
// covering the whole workout), so typing into ONE exercise's set used to
// re-render every OTHER exercise's card too -- on the screen most core to
// the app's live-tracking use case. ExerciseCard is now memoized with a
// custom comparator (arePropsEqual, exported for exactly this) that checks
// those props by value instead of reference. Tested directly against the
// comparator rather than via a Profiler render-count harness -- a timing
// measurement is inherently noisy under parallel test-suite load (observed
// flaking here), where a deterministic equality check on the actual
// mechanism is not.
describe('ExerciseCard.arePropsEqual', () => {
  it('treats new-but-equal sets/unilateralSets/previousSession arrays as equal', () => {
    const previousSession = {
      dateDisplay: 'Jan 1, 2026',
      sets: [{ setNumber: 1, weightDisplay: '100', unit: 'kg' as const, reps: 5, side: null }],
    };
    const prev = { ...baseProps, previousSession, unilateralSets: oneUnilateralSet };
    const next = {
      ...baseProps,
      sets: [...baseProps.sets],
      unilateralSets: oneUnilateralSet.map((s) => ({ ...s })),
      previousSession: { ...previousSession, sets: [...previousSession.sets] },
    };

    expect(arePropsEqual(prev, next)).toBe(true);
  });

  it('detects a real change in one set among several', () => {
    const prev = { ...baseProps, sets: [...baseProps.sets, { ...baseProps.sets[0], id: 's2' }] };
    const next = {
      ...prev,
      sets: [{ ...prev.sets[0], weight: '100' }, prev.sets[1]],
    };

    expect(arePropsEqual(prev, next)).toBe(false);
  });

  it('detects a real change in a unilateral side', () => {
    const prev = { ...baseProps, unilateralSets: oneUnilateralSet };
    const next = {
      ...baseProps,
      unilateralSets: [
        { ...oneUnilateralSet[0], left: { ...oneUnilateralSet[0].left, weight: '50' } },
      ],
    };

    expect(arePropsEqual(prev, next)).toBe(false);
  });

  // Every set-mutation callback is deliberately ignored by the comparator
  // (see its own comment) -- a fresh closure reference every render must
  // never by itself force a re-render, or the whole fix is defeated.
  it('ignores identity changes in the set-mutation callbacks', () => {
    const prev = { ...baseProps };
    const next = {
      ...baseProps,
      onChangeWeight: jest.fn(),
      onChangeReps: jest.fn(),
      onToggleComplete: jest.fn(),
      onAddSet: jest.fn(),
      onRemoveExercise: jest.fn(),
    };

    expect(arePropsEqual(prev, next)).toBe(true);
  });

  // The one exception: onMoveUp/onMoveDown are position-based, so a stale
  // reference after a reorder would move the wrong exercise -- these ARE
  // compared by identity, which only works because ActiveWorkoutScreen
  // caches one stable handler per index/direction (see that file).
  it('treats a changed onMoveUp/onMoveDown reference as a real change', () => {
    const onMoveUp = () => {};
    const prev = { ...baseProps, onMoveUp };
    const next = { ...baseProps, onMoveUp: () => {} };

    expect(arePropsEqual(prev, next)).toBe(false);
    expect(arePropsEqual(prev, { ...baseProps, onMoveUp })).toBe(true);
  });
});

describe('ExerciseCard by what the exercise measures', () => {
  it('heads a timed exercise with one Time column, and its last session with times', () => {
    render(
      <ExerciseCard
        {...baseProps}
        exerciseName="Plank"
        measurementType="timed"
        sets={[
          {
            id: 's1',
            setIndex: 1,
            weight: '',
            reps: '',
            duration: '',
            completed: false,
            canComplete: false,
          },
        ]}
        previousSession={{
          dateDisplay: 'Oct 1, 2026',
          sets: [
            {
              setNumber: 1,
              weightDisplay: '',
              unit: 'kg',
              reps: 0,
              durationDisplay: '1:15',
              side: null,
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByText('Time').length).toBeGreaterThan(0);
    expect(screen.queryByText('Weight')).toBeNull();
    expect(screen.getByTestId('exercise-card-previous-set-1')).toHaveTextContent(/1:15/);
    expect(screen.getByLabelText('Set 1 of 1: 1:15')).toBeTruthy();
  });

  it("shows a bodyweight exercise's last session as reps", () => {
    render(
      <ExerciseCard
        {...baseProps}
        exerciseName="Push-Up"
        measurementType="bodyweight"
        previousSession={{
          dateDisplay: 'Oct 1, 2026',
          sets: [{ setNumber: 1, weightDisplay: '', unit: 'kg', reps: 20, side: null }],
        }}
      />,
    );

    expect(screen.getByTestId('exercise-card-previous-set-1')).toHaveTextContent(/20 reps/);
    expect(screen.queryByText('Weight')).toBeNull();
  });

  it('says reps are per side for a unilateral bodyweight exercise', () => {
    render(
      <ExerciseCard
        {...baseProps}
        movementType="unilateral"
        measurementType="bodyweight"
        sets={[]}
        unilateralSets={oneUnilateralSet}
      />,
    );

    expect(screen.getByText('Reps are per side')).toBeTruthy();
  });
});

describe('ExerciseCard progression', () => {
  const lastSession = {
    dateDisplay: 'Oct 1, 2026',
    sets: [{ setNumber: 1, weightDisplay: '50', unit: 'lb' as const, reps: 12, side: null }],
  };
  const cue = {
    headline: 'Your top set hit 12 at 50 lb. Increase the weight today.',
    options: [],
    detail: 'Pick a weight you can lift for about 8 reps, then build back up to 12.',
  };

  it('shows the all-time best with its date, and what to aim for under last time', () => {
    render(
      <ExerciseCard
        {...baseProps}
        previousSession={lastSession}
        allTimeBest={{
          measurementType: 'weight_reps',
          weightKg: 60 * 0.45359237,
          reps: 9,
          durationSeconds: null,
          achievedAt: '2026-09-02T12:00:00.000Z',
        }}
        progressionCue={cue}
      />,
    );

    // The rep range isn't named: the best is within it by default.
    expect(screen.getByTestId('exercise-card-best')).toHaveTextContent(
      /^All-Time Best60 lb × 9Sep 2, 2026$/,
    );
    expect(screen.getByTestId('exercise-card-cue')).toHaveTextContent(/Increase the weight today/);
    expect(screen.getByTestId('exercise-card-cue')).toHaveTextContent(/about 8 reps/);
    expect(
      screen.getByLabelText(
        'Your top set hit 12 at 50 lb. Increase the weight today. Pick a weight you can lift for about 8 reps, then build back up to 12.',
      ),
    ).toBeTruthy();
  });

  it('lists ways to make a bodyweight exercise harder', () => {
    render(
      <ExerciseCard
        {...baseProps}
        measurementType="bodyweight"
        previousSession={lastSession}
        progressionCue={{
          headline: 'Your best set hit 12 reps, the top of your range. Make it harder today:',
          options: ['Add reps: go for 13 or more', 'Add weight: try Weighted Pull-Up'],
          detail: null,
        }}
      />,
    );

    expect(screen.getByText('Add reps: go for 13 or more')).toBeTruthy();
    expect(screen.getByText('Add weight: try Weighted Pull-Up')).toBeTruthy();
  });

  it("says when today's top set reaches the top of the range", () => {
    render(
      <ExerciseCard
        {...baseProps}
        sessionCue="Top of your range. Increase the weight next time."
      />,
    );

    expect(screen.getByTestId('exercise-card-session-cue')).toHaveTextContent(
      /Top of your range\. Increase the weight next time\./,
    );
  });

  it("says Today, in the accent, once one of today's sets is the best", () => {
    render(
      <ExerciseCard
        {...baseProps}
        allTimeBest={{
          measurementType: 'bodyweight',
          weightKg: null,
          reps: 21,
          durationSeconds: null,
          achievedAt: null,
        }}
      />,
    );

    const best = screen.getByTestId('exercise-card-best');
    expect(best).toHaveTextContent(/21 reps.*Today/);
    expect(StyleSheet.flatten(within(best).getByText('21 reps').props.style).color).toBe(
      baseProps.accentColor,
    );
  });

  it('shows none of it when there is nothing to say', () => {
    render(<ExerciseCard {...baseProps} previousSession={lastSession} />);

    expect(screen.queryByTestId('exercise-card-best')).toBeNull();
    expect(screen.queryByTestId('exercise-card-cue')).toBeNull();
    expect(screen.queryByTestId('exercise-card-session-cue')).toBeNull();
  });

  it('re-renders when the cue, the all-time best or the session cue changes, and not otherwise', () => {
    const props = { ...baseProps, previousSession: lastSession, progressionCue: cue };
    expect(arePropsEqual(props, { ...props, progressionCue: { ...cue, options: [] } })).toBe(true);
    expect(
      arePropsEqual(props, { ...props, progressionCue: { ...cue, headline: 'Last time: 11' } }),
    ).toBe(false);
    const best = {
      measurementType: 'weight_reps' as const,
      weightKg: 27,
      reps: 9,
      durationSeconds: null,
      achievedAt: '2026-09-02T12:00:00.000Z',
    };
    expect(
      arePropsEqual({ ...props, allTimeBest: best }, { ...props, allTimeBest: { ...best } }),
    ).toBe(true);
    expect(arePropsEqual(props, { ...props, allTimeBest: best })).toBe(false);
    expect(arePropsEqual(props, { ...props, ownRangeText: 'Own range 3–5' })).toBe(false);
    expect(arePropsEqual(props, { ...props, sessionCue: 'Top of your range.' })).toBe(false);
  });
});
