import { fireEvent, render, screen } from '@testing-library/react-native';
import { arePropsEqual, PastSetRow } from './PastSetRow';

const baseProps = {
  setIndex: 1,
  weight: '100',
  reps: '8',
  onChangeWeight: jest.fn(),
  onChangeReps: jest.fn(),
  onRemove: jest.fn(),
  testID: 'past-set-row',
};

describe('PastSetRow', () => {
  it('shows the set index, weight, and reps', () => {
    render(<PastSetRow {...baseProps} />);

    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByTestId('past-set-row-weight').props.value).toBe('100');
    expect(screen.getByTestId('past-set-row-reps').props.value).toBe('8');
  });

  it('calls onChangeWeight/onChangeReps as the user types', () => {
    const onChangeWeight = jest.fn();
    const onChangeReps = jest.fn();
    render(
      <PastSetRow {...baseProps} onChangeWeight={onChangeWeight} onChangeReps={onChangeReps} />,
    );

    fireEvent.changeText(screen.getByTestId('past-set-row-weight'), '120');
    fireEvent.changeText(screen.getByTestId('past-set-row-reps'), '6');

    expect(onChangeWeight).toHaveBeenCalledWith('120');
    expect(onChangeReps).toHaveBeenCalledWith('6');
  });

  it('calls onRemove when the remove control is pressed', () => {
    const onRemove = jest.fn();
    render(<PastSetRow {...baseProps} onRemove={onRemove} />);

    fireEvent.press(screen.getByTestId('past-set-row-remove'));

    expect(onRemove).toHaveBeenCalled();
  });
});

describe('PastSetRow render behaviour', () => {
  it('is memoised, so unchanged rows can skip re-rendering while the user types into another row', () => {
    expect((PastSetRow as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for('react.memo'));
  });

  it('reports equal when only the callbacks differ -- EditWorkoutScreen/LogPastWorkoutScreen rebuild those fresh every render, so comparing them would defeat the memo entirely', () => {
    const prev = { ...baseProps };
    const next = {
      ...baseProps,
      onChangeWeight: jest.fn(),
      onChangeReps: jest.fn(),
      onRemove: jest.fn(),
    };

    expect(arePropsEqual(prev, next)).toBe(true);
  });

  it.each(['setIndex', 'weight', 'reps', 'testID'] as const)(
    'reports not equal when %s changes',
    (key) => {
      const prev = { ...baseProps };
      const next = { ...baseProps, [key]: key === 'setIndex' ? 2 : 'changed' };

      expect(arePropsEqual(prev, next)).toBe(false);
    },
  );
});
