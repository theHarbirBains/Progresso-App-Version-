import { fireEvent, render, screen } from '@testing-library/react-native';
import { UnilateralSetRow } from './UnilateralSetRow';

const baseProps = {
  setIndex: 1,
  left: { weight: '', reps: '' },
  right: { weight: '', reps: '' },
  completed: false,
  canComplete: false,
  onChangeWeight: jest.fn(),
  onChangeReps: jest.fn(),
  onToggleComplete: jest.fn(),
  accentColor: '#2F80FF',
  onAccentColor: '#06201C',
  testID: 'unilateral-set',
};

describe('UnilateralSetRow', () => {
  it("shows the set index and both sides' weight/reps", () => {
    render(
      <UnilateralSetRow
        {...baseProps}
        left={{ weight: '42.5', reps: '10' }}
        right={{ weight: '40', reps: '10' }}
      />,
    );

    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByTestId('unilateral-set-left-weight').props.value).toBe('42.5');
    expect(screen.getByTestId('unilateral-set-left-reps').props.value).toBe('10');
    expect(screen.getByTestId('unilateral-set-right-weight').props.value).toBe('40');
    expect(screen.getByTestId('unilateral-set-right-reps').props.value).toBe('10');
  });

  it("routes each input's changes with its own side", () => {
    const onChangeWeight = jest.fn();
    const onChangeReps = jest.fn();
    render(
      <UnilateralSetRow
        {...baseProps}
        onChangeWeight={onChangeWeight}
        onChangeReps={onChangeReps}
      />,
    );

    fireEvent.changeText(screen.getByTestId('unilateral-set-left-weight'), '42.5');
    fireEvent.changeText(screen.getByTestId('unilateral-set-right-weight'), '40');
    fireEvent.changeText(screen.getByTestId('unilateral-set-left-reps'), '10');
    fireEvent.changeText(screen.getByTestId('unilateral-set-right-reps'), '8');

    expect(onChangeWeight).toHaveBeenCalledWith('left', '42.5');
    expect(onChangeWeight).toHaveBeenCalledWith('right', '40');
    expect(onChangeReps).toHaveBeenCalledWith('left', '10');
    expect(onChangeReps).toHaveBeenCalledWith('right', '8');
  });

  it('disables Complete until canComplete is true', () => {
    render(<UnilateralSetRow {...baseProps} canComplete={false} />);

    expect(screen.getByTestId('unilateral-set-complete').props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it('enables Complete once canComplete is true, and calls onToggleComplete when pressed', () => {
    const onToggleComplete = jest.fn();
    render(<UnilateralSetRow {...baseProps} canComplete onToggleComplete={onToggleComplete} />);

    const button = screen.getByTestId('unilateral-set-complete');
    expect(button.props.accessibilityState.disabled).toBe(false);

    fireEvent.press(button);
    expect(onToggleComplete).toHaveBeenCalled();
  });

  it("locks both sides' inputs once completed, but still allows toggling back off", () => {
    render(<UnilateralSetRow {...baseProps} completed canComplete={false} />);

    expect(screen.getByTestId('unilateral-set-left-weight').props.editable).toBe(false);
    expect(screen.getByTestId('unilateral-set-right-weight').props.editable).toBe(false);
    expect(screen.getByTestId('unilateral-set-complete').props.accessibilityState.disabled).toBe(
      false,
    );
  });
});
