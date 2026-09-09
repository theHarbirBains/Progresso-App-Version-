import { fireEvent, render, screen } from '@testing-library/react-native';
import { RgbSliderPicker } from './RgbSliderPicker';

describe('RgbSliderPicker', () => {
  it('displays the initial color as the swatch background and hex input value', () => {
    render(<RgbSliderPicker value="#2F80FF" onChange={jest.fn()} />);

    expect(screen.getByTestId('custom-color-hex-input').props.value).toBe('#2F80FF');
  });

  it('displays the parsed R/G/B channel values for the given hex', () => {
    render(<RgbSliderPicker value="#2F80FF" onChange={jest.fn()} />);

    expect(screen.getByTestId('channel-value-R')).toHaveTextContent('47');
    expect(screen.getByTestId('channel-value-G')).toHaveTextContent('128');
    expect(screen.getByTestId('channel-value-B')).toHaveTextContent('255');
  });

  it('calls onChange with a normalized hex when a valid hex is typed', () => {
    const onChange = jest.fn();
    render(<RgbSliderPicker value="#2F80FF" onChange={onChange} />);

    fireEvent.changeText(screen.getByTestId('custom-color-hex-input'), 'ef4444');

    expect(onChange).toHaveBeenCalledWith('#EF4444');
  });

  it('does not call onChange while the typed hex is incomplete/invalid', () => {
    const onChange = jest.fn();
    render(<RgbSliderPicker value="#2F80FF" onChange={onChange} />);

    fireEvent.changeText(screen.getByTestId('custom-color-hex-input'), '#EF44');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('positions each channel thumb proportionally to its current value once the track is measured', () => {
    render(<RgbSliderPicker value="#800000" onChange={jest.fn()} />);

    fireEvent(screen.getByTestId('channel-track-R'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 28 } },
    });

    const merged = Object.assign({}, ...[screen.getByTestId('channel-thumb-R').props.style].flat());
    // R = 128 (0x80) of 255 -> roughly the midpoint of a 200px track.
    expect(merged.left).toBeCloseTo((128 / 255) * 200, 0);
  });
});
