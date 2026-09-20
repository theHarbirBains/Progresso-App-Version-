import { StyleSheet, View } from 'react-native';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { fonts } from '../design/theme';
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

describe('ExerciseCard -- a plain block, quiet controls, previous numbers beside the sets', () => {
  const previousSession = {
    dateDisplay: 'Sep 1, 2026',
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

  it('shows the muscle group as plain text, not a badge, and draws no card', () => {
    render(<ExerciseCard {...baseProps} />);

    const muscle = screen.getByTestId('exercise-card-muscle-group');
    expect(StyleSheet.flatten(muscle.props.style).backgroundColor).toBeUndefined();
    const root = StyleSheet.flatten(screen.getByTestId('exercise-card').props.style);
    expect(root.backgroundColor).toBeUndefined();
    expect(root.borderWidth).toBeUndefined();
  });

  it('draws a hairline above the block only when asked (every exercise but the first)', () => {
    const { rerender } = render(<ExerciseCard {...baseProps} />);
    expect(
      StyleSheet.flatten(screen.getByTestId('exercise-card').props.style).borderTopWidth,
    ).toBeUndefined();

    rerender(<ExerciseCard {...baseProps} divider />);
    expect(StyleSheet.flatten(screen.getByTestId('exercise-card').props.style).borderTopWidth).toBe(
      StyleSheet.hairlineWidth,
    );
  });

  it('gives reorder and remove a 44pt-tall target each, named for assistive tech', () => {
    render(<ExerciseCard {...baseProps} onMoveUp={jest.fn()} onMoveDown={jest.fn()} />);

    for (const [id, label] of [
      ['exercise-card-move-up', 'Move exercise up'],
      ['exercise-card-move-down', 'Move exercise down'],
      ['exercise-card-remove', 'Remove exercise'],
    ] as const) {
      const control = screen.getByTestId(id);
      expect(control.props.accessibilityLabel).toBe(label);
      expect(StyleSheet.flatten(control.props.style).height).toBeGreaterThanOrEqual(44);
    }
  });

  it('prints each previous set as "weight unit × reps", numbered, with the side for unilateral sets', () => {
    render(<ExerciseCard {...baseProps} previousSession={previousSession} />);

    const first = within(screen.getByTestId('exercise-card-previous-set-1'));
    expect(first.getByText('1')).toBeTruthy();
    expect(first.getByText('225 lb × 5')).toBeTruthy();
    expect(screen.getByTestId('exercise-card-previous-set-2')).toHaveTextContent(
      /^2\s*42\.5 lb × 10 \(R\)$/,
    );
  });

  it('lets the previous sets wrap onto more lines instead of scrolling sideways, in a mono readout', () => {
    render(<ExerciseCard {...baseProps} previousSession={previousSession} />);

    expect(
      screen
        .UNSAFE_getAllByType(View)
        .some((node) => StyleSheet.flatten(node.props.style)?.flexWrap === 'wrap'),
    ).toBe(true);
    const value = within(screen.getByTestId('exercise-card-previous-set-1')).getByText(
      '225 lb × 5',
    );
    expect(StyleSheet.flatten(value.props.style).fontFamily).toBe(fonts.monoBold);
  });

  it('shows no per-set proportion bars or cards for the previous session', () => {
    render(<ExerciseCard {...baseProps} previousSession={previousSession} />);

    const set = StyleSheet.flatten(screen.getByTestId('exercise-card-previous-set-1').props.style);
    expect(set.backgroundColor).toBeUndefined();
    expect(set.minWidth).toBeUndefined();
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
