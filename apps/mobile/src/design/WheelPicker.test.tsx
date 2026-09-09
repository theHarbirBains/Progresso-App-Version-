import { fireEvent, render, screen } from '@testing-library/react-native';
import { FlatList } from 'react-native';
import { WheelPicker } from './WheelPicker';

describe('WheelPicker', () => {
  it('renders every value', () => {
    render(
      <WheelPicker
        testID="wheel"
        values={['a', 'b', 'c']}
        selectedValue="a"
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByTestId('wheel-item-a')).toBeTruthy();
    expect(screen.getByTestId('wheel-item-b')).toBeTruthy();
    expect(screen.getByTestId('wheel-item-c')).toBeTruthy();
  });

  it('calls onChange when an item is tapped directly', () => {
    const onChange = jest.fn();
    render(
      <WheelPicker testID="wheel" values={['a', 'b', 'c']} selectedValue="a" onChange={onChange} />,
    );

    fireEvent.press(screen.getByTestId('wheel-item-c'));

    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('does not call onChange when the already-selected item is tapped again', () => {
    const onChange = jest.fn();
    render(
      <WheelPicker testID="wheel" values={['a', 'b', 'c']} selectedValue="a" onChange={onChange} />,
    );

    fireEvent.press(screen.getByTestId('wheel-item-a'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('updates onMomentumScrollEnd based on the nearest snapped item', () => {
    const onChange = jest.fn();
    render(
      <WheelPicker testID="wheel" values={['a', 'b', 'c']} selectedValue="a" onChange={onChange} />,
    );

    fireEvent(screen.UNSAFE_getByType(FlatList), 'onMomentumScrollEnd', {
      nativeEvent: { contentOffset: { y: 88 } },
    });

    expect(onChange).toHaveBeenCalledWith('c');
  });
});
