import { fireEvent, render, screen } from '@testing-library/react-native';
import { arePropsEqual, PastUnilateralSetRow } from './PastUnilateralSetRow';

const baseProps = {
  setIndex: 1,
  left: { weight: '42.5', reps: '10' },
  right: { weight: '40', reps: '10' },
  onChangeWeight: jest.fn(),
  onChangeReps: jest.fn(),
  onRemove: jest.fn(),
  testID: 'past-unilateral-set',
};

describe('PastUnilateralSetRow', () => {
  it("shows the set index and both sides' weight/reps", () => {
    render(<PastUnilateralSetRow {...baseProps} />);

    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByTestId('past-unilateral-set-left-weight').props.value).toBe('42.5');
    expect(screen.getByTestId('past-unilateral-set-left-reps').props.value).toBe('10');
    expect(screen.getByTestId('past-unilateral-set-right-weight').props.value).toBe('40');
    expect(screen.getByTestId('past-unilateral-set-right-reps').props.value).toBe('10');
  });

  it("routes each input's changes with its own side", () => {
    const onChangeWeight = jest.fn();
    const onChangeReps = jest.fn();
    render(
      <PastUnilateralSetRow
        {...baseProps}
        onChangeWeight={onChangeWeight}
        onChangeReps={onChangeReps}
      />,
    );

    fireEvent.changeText(screen.getByTestId('past-unilateral-set-left-weight'), '45');
    fireEvent.changeText(screen.getByTestId('past-unilateral-set-right-reps'), '8');

    expect(onChangeWeight).toHaveBeenCalledWith('left', '45');
    expect(onChangeReps).toHaveBeenCalledWith('right', '8');
  });

  it('calls onRemove (removing both sides together) when the remove control is pressed', () => {
    const onRemove = jest.fn();
    render(<PastUnilateralSetRow {...baseProps} onRemove={onRemove} />);

    fireEvent.press(screen.getByTestId('past-unilateral-set-remove'));

    expect(onRemove).toHaveBeenCalled();
  });
});

describe('PastUnilateralSetRow render behaviour', () => {
  it('is memoised, so unchanged rows can skip re-rendering while the user types into another row', () => {
    expect((PastUnilateralSetRow as unknown as { $$typeof: symbol }).$$typeof).toBe(
      Symbol.for('react.memo'),
    );
  });

  it('reports equal when only the callbacks differ, or left/right are new objects with the same values -- the caller rebuilds both fresh every render', () => {
    const prev = { ...baseProps, left: { weight: '42.5', reps: '10' } };
    const next = {
      ...baseProps,
      left: { weight: '42.5', reps: '10' }, // a new object, same values
      onChangeWeight: jest.fn(),
      onChangeReps: jest.fn(),
      onRemove: jest.fn(),
    };

    expect(arePropsEqual(prev, next)).toBe(true);
  });

  it('reports not equal when either side actually changes', () => {
    const prev = baseProps;
    const next = { ...baseProps, left: { weight: '50', reps: '10' } };

    expect(arePropsEqual(prev, next)).toBe(false);
  });

  it('reports not equal when setIndex or testID changes', () => {
    expect(arePropsEqual(baseProps, { ...baseProps, setIndex: 2 })).toBe(false);
    expect(arePropsEqual(baseProps, { ...baseProps, testID: 'other' })).toBe(false);
  });
});
