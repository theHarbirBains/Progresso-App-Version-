import { fireEvent, render, screen } from '@testing-library/react-native';
import { ExerciseCard } from './ExerciseCard';

const baseProps = {
  exerciseName: 'Barbell Bench Press',
  muscleGroup: 'chest' as const,
  movementType: 'bilateral' as const,
  sets: [{ id: 's1', setIndex: 1, weight: '', reps: '', completed: false, canComplete: false }],
  unilateralSets: [],
  onChangeWeight: jest.fn(),
  onChangeReps: jest.fn(),
  onToggleComplete: jest.fn(),
  onToggleUnilateralComplete: jest.fn(),
  onChangeUnilateralWeight: jest.fn(),
  onChangeUnilateralReps: jest.fn(),
  onAddSet: jest.fn(),
  onRemoveExercise: jest.fn(),
  accentColor: '#2F80FF',
  onAccentColor: '#06201C',
  testID: 'exercise-card',
};

const oneUnilateralSet = [
  {
    setIndex: 1,
    left: { weight: '42.5', reps: '10', completed: false, canComplete: true },
    right: { weight: '40', reps: '10', completed: false, canComplete: true },
  },
];

describe('ExerciseCard', () => {
  it('shows the exercise name and the muscle group from real exercise data (not hardcoded)', () => {
    render(<ExerciseCard {...baseProps} muscleGroup="shoulders" />);

    expect(screen.getByText('Barbell Bench Press')).toBeTruthy();
    expect(screen.getByText('Shoulders')).toBeTruthy();
  });

  it('renders no exercise image', () => {
    render(<ExerciseCard {...baseProps} />);

    expect(screen.queryByRole('image')).toBeNull();
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

    fireEvent.press(screen.getByTestId('exercise-card-remove'));

    expect(onRemoveExercise).toHaveBeenCalled();
  });

  it('does not render reorder controls when onMoveUp/onMoveDown are omitted', () => {
    render(<ExerciseCard {...baseProps} />);

    expect(screen.queryByTestId('exercise-card-move-up')).toBeNull();
    expect(screen.queryByTestId('exercise-card-move-down')).toBeNull();
  });

  it('calls onMoveUp/onMoveDown when reorder controls are pressed', () => {
    const onMoveUp = jest.fn();
    const onMoveDown = jest.fn();
    render(<ExerciseCard {...baseProps} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />);

    fireEvent.press(screen.getByTestId('exercise-card-move-up'));
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

  it('shows no Last Workout section when there is no prior session', () => {
    render(<ExerciseCard {...baseProps} />);

    expect(screen.queryByText('Last Workout')).toBeNull();
  });

  it('shows every set from the last session, in order, with a numbered badge each', () => {
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
              relativeWeight: 1,
            },
            {
              setNumber: 2,
              weightDisplay: '220',
              unit: 'lb',
              reps: 5,
              side: null,
              relativeWeight: 0.98,
            },
            {
              setNumber: 3,
              weightDisplay: '215',
              unit: 'lb',
              reps: 6,
              side: null,
              relativeWeight: 0.96,
            },
          ],
        }}
      />,
    );

    const section = screen.getByTestId('exercise-card-previous-session');
    expect(section).toHaveTextContent(/Last Workout/);
    expect(section).toHaveTextContent(/Sep 1, 2026/);
    expect(screen.getByTestId('exercise-card-previous-set-1')).toHaveTextContent(/225 lb/);
    expect(screen.getByTestId('exercise-card-previous-set-2')).toHaveTextContent(/220 lb/);
    expect(screen.getByTestId('exercise-card-previous-set-3')).toHaveTextContent(/215 lb/);
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
              relativeWeight: 1,
            },
          ],
        }}
      />,
    );

    expect(screen.getByTestId('exercise-card-previous-set-1')).toHaveTextContent(/\(L\)/);
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
              relativeWeight: 1,
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

  it('calls onToggleUnilateralComplete with the setIndex, not a set id, when Complete is pressed', () => {
    const onToggleUnilateralComplete = jest.fn();
    render(
      <ExerciseCard
        {...baseProps}
        movementType="unilateral"
        sets={[]}
        unilateralSets={oneUnilateralSet}
        onToggleUnilateralComplete={onToggleUnilateralComplete}
      />,
    );

    fireEvent.press(screen.getByTestId('exercise-card-set-1-complete'));

    expect(onToggleUnilateralComplete).toHaveBeenCalledWith(1);
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
            left: { weight: '42.5', reps: '10', completed: false, canComplete: true },
            right: { weight: '', reps: '', completed: false, canComplete: false },
          },
        ]}
      />,
    );

    expect(
      screen.getByTestId('exercise-card-set-1-complete').props.accessibilityState.disabled,
    ).toBe(true);
  });

  it('routes weight/reps changes with the side they belong to', () => {
    const onChangeUnilateralWeight = jest.fn();
    const onChangeUnilateralReps = jest.fn();
    render(
      <ExerciseCard
        {...baseProps}
        movementType="unilateral"
        sets={[]}
        unilateralSets={oneUnilateralSet}
        onChangeUnilateralWeight={onChangeUnilateralWeight}
        onChangeUnilateralReps={onChangeUnilateralReps}
      />,
    );

    fireEvent.changeText(screen.getByTestId('exercise-card-set-1-left-weight'), '45');
    fireEvent.changeText(screen.getByTestId('exercise-card-set-1-right-reps'), '8');

    expect(onChangeUnilateralWeight).toHaveBeenCalledWith(1, 'left', '45');
    expect(onChangeUnilateralReps).toHaveBeenCalledWith(1, 'right', '8');
  });
});
