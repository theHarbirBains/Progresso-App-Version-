import { fireEvent, render, screen } from '@testing-library/react-native';
import { SetRow } from './SetRow';

const baseProps = {
  setIndex: 1,
  weight: '',
  reps: '',
  completed: false,
  canComplete: false,
  onChangeWeight: jest.fn(),
  onChangeReps: jest.fn(),
  onToggleComplete: jest.fn(),
  accentColor: '#2F80FF',
  onAccentColor: '#06201C',
  testID: 'set-row',
};

describe('SetRow', () => {
  it('shows the set index', () => {
    render(<SetRow {...baseProps} setIndex={3} />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('calls onChangeWeight/onChangeReps as the user types', () => {
    const onChangeWeight = jest.fn();
    const onChangeReps = jest.fn();
    render(<SetRow {...baseProps} onChangeWeight={onChangeWeight} onChangeReps={onChangeReps} />);

    fireEvent.changeText(screen.getByTestId('set-row-weight'), '100');
    fireEvent.changeText(screen.getByTestId('set-row-reps'), '8');

    expect(onChangeWeight).toHaveBeenCalledWith('100');
    expect(onChangeReps).toHaveBeenCalledWith('8');
  });

  it('disables the complete control until weight and reps are valid', () => {
    render(<SetRow {...baseProps} canComplete={false} />);

    expect(screen.getByTestId('set-row-complete').props.accessibilityState.disabled).toBe(true);
  });

  it('enables the complete control once weight and reps are valid', () => {
    const onToggleComplete = jest.fn();
    render(<SetRow {...baseProps} canComplete={true} onToggleComplete={onToggleComplete} />);

    const button = screen.getByTestId('set-row-complete');
    expect(button.props.accessibilityState.disabled).toBe(false);

    fireEvent.press(button);
    expect(onToggleComplete).toHaveBeenCalled();
  });

  it('visually indicates completion using the accent color', () => {
    render(<SetRow {...baseProps} completed={true} weight="100" reps="8" />);

    const button = screen.getByTestId('set-row-complete');
    const merged = Object.assign({}, ...[button.props.style].flat());
    expect(merged.backgroundColor).toBe('#2F80FF');
  });

  it('locks weight/reps inputs once the set is completed', () => {
    render(<SetRow {...baseProps} completed={true} weight="100" reps="8" />);

    expect(screen.getByTestId('set-row-weight').props.editable).toBe(false);
    expect(screen.getByTestId('set-row-reps').props.editable).toBe(false);
  });

  it('always allows un-completing a completed set', () => {
    render(<SetRow {...baseProps} completed={true} canComplete={false} />);

    expect(screen.getByTestId('set-row-complete').props.accessibilityState.disabled).toBe(false);
  });
});
