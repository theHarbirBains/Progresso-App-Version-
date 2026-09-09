import { fireEvent, render, screen } from '@testing-library/react-native';
import { HeightWheelPicker } from './HeightWheelPicker';

describe('HeightWheelPicker', () => {
  it('shows a single cm wheel and preview when unit is cm', () => {
    render(
      <HeightWheelPicker
        testID="height"
        unit="cm"
        heightCm={174}
        onChangeUnit={jest.fn()}
        onChangeHeightCm={jest.fn()}
      />,
    );

    expect(screen.getByTestId('height-wheel-cm')).toBeTruthy();
    expect(screen.getByTestId('height-preview')).toHaveTextContent('174 cm');
  });

  it('shows two wheels (ft/in) and a "5 ft 9 in" preview when unit is ft_in', () => {
    render(
      <HeightWheelPicker
        testID="height"
        unit="ft_in"
        heightCm={174}
        onChangeUnit={jest.fn()}
        onChangeHeightCm={jest.fn()}
      />,
    );

    expect(screen.getByTestId('height-wheel-ft')).toBeTruthy();
    expect(screen.getByTestId('height-wheel-in')).toBeTruthy();
    expect(screen.getByTestId('height-preview')).toHaveTextContent('5 ft 9 in');
  });

  it('pressing the ft_in unit toggle switches the displayed unit', () => {
    const onChangeUnit = jest.fn();
    render(
      <HeightWheelPicker
        testID="height"
        unit="cm"
        heightCm={174}
        onChangeUnit={onChangeUnit}
        onChangeHeightCm={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('height-unit-ft_in'));

    expect(onChangeUnit).toHaveBeenCalledWith('ft_in');
  });

  it('selecting a cm wheel value reports the raw cm value', () => {
    const onChangeHeightCm = jest.fn();
    render(
      <HeightWheelPicker
        testID="height"
        unit="cm"
        heightCm={174}
        onChangeUnit={jest.fn()}
        onChangeHeightCm={onChangeHeightCm}
      />,
    );

    fireEvent.press(screen.getByTestId('height-wheel-cm-item-180'));

    expect(onChangeHeightCm).toHaveBeenCalledWith(180);
  });

  it('selecting feet keeps the current inches and converts back to cm', () => {
    const onChangeHeightCm = jest.fn();
    render(
      <HeightWheelPicker
        testID="height"
        unit="ft_in"
        heightCm={174}
        onChangeUnit={jest.fn()}
        onChangeHeightCm={onChangeHeightCm}
      />,
    );

    fireEvent.press(screen.getByTestId('height-wheel-ft-item-6'));

    const reportedCm = onChangeHeightCm.mock.calls[0][0] as number;
    // 6 ft 9 in (keeping the existing 9 inches from 174cm)
    expect(Math.round(reportedCm)).toBe(206);
  });
});
