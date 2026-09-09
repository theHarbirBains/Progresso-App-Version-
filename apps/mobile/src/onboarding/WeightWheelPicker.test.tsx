import { fireEvent, render, screen } from '@testing-library/react-native';
import { WeightWheelPicker } from './WeightWheelPicker';

describe('WeightWheelPicker', () => {
  it('shows the kg preview when unit is kg', () => {
    render(
      <WeightWheelPicker
        testID="weight"
        unit="kg"
        weightKg={79.2}
        onChangeUnit={jest.fn()}
        onChangeWeightKg={jest.fn()}
      />,
    );

    expect(screen.getByTestId('weight-preview')).toHaveTextContent('79.2 kg');
  });

  it('shows the converted lb preview when unit is lb, without losing precision', () => {
    render(
      <WeightWheelPicker
        testID="weight"
        unit="lb"
        weightKg={79.2}
        onChangeUnit={jest.fn()}
        onChangeWeightKg={jest.fn()}
      />,
    );

    expect(screen.getByTestId('weight-preview')).toHaveTextContent('174.6 lb');
  });

  it('pressing the lb unit toggle switches the displayed unit', () => {
    const onChangeUnit = jest.fn();
    render(
      <WeightWheelPicker
        testID="weight"
        unit="kg"
        weightKg={79.2}
        onChangeUnit={onChangeUnit}
        onChangeWeightKg={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('weight-unit-lb'));

    expect(onChangeUnit).toHaveBeenCalledWith('lb');
  });

  it('selecting a wheel value while in kg reports the raw kg value', () => {
    const onChangeWeightKg = jest.fn();
    render(
      <WeightWheelPicker
        testID="weight"
        unit="kg"
        weightKg={79.2}
        onChangeUnit={jest.fn()}
        onChangeWeightKg={onChangeWeightKg}
      />,
    );

    fireEvent.press(screen.getByTestId('weight-wheel-item-80.0'));

    expect(onChangeWeightKg).toHaveBeenCalledWith(80);
  });

  it('selecting a wheel value while in lb converts back to canonical kg', () => {
    const onChangeWeightKg = jest.fn();
    render(
      <WeightWheelPicker
        testID="weight"
        unit="lb"
        weightKg={79.2}
        onChangeUnit={jest.fn()}
        onChangeWeightKg={onChangeWeightKg}
      />,
    );

    fireEvent.press(screen.getByTestId('weight-wheel-item-175.0'));

    const reportedKg = onChangeWeightKg.mock.calls[0][0] as number;
    expect(reportedKg).toBeCloseTo(79.38, 1);
  });
});
