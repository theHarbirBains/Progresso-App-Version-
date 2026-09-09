import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccentColorPickerScreen } from './AccentColorPickerScreen';

describe('AccentColorPickerScreen', () => {
  it('renders the given title and subtitle', () => {
    render(
      <AccentColorPickerScreen
        title="Workout Mode Color"
        subtitle="Choose the accent color for your Workout experience."
        initialColor="#2F80FF"
        previewKind="workout"
        saving={false}
        saveError={null}
        onSave={jest.fn()}
        onBack={jest.fn()}
      />,
    );

    expect(screen.getByText('Workout Mode Color')).toBeTruthy();
    expect(screen.getByText('Choose the accent color for your Workout experience.')).toBeTruthy();
  });

  it('marks the initial color as selected among the presets', () => {
    render(
      <AccentColorPickerScreen
        title="Workout Mode Color"
        subtitle="..."
        initialColor="#2F80FF"
        previewKind="workout"
        saving={false}
        saveError={null}
        onSave={jest.fn()}
        onBack={jest.fn()}
      />,
    );

    expect(screen.getByTestId('preset-swatch-#2F80FF').props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.getByTestId('open-custom-color').props.accessibilityState.selected).toBe(false);
  });

  it('selects a different preset when tapped, deselecting the previous one', () => {
    render(
      <AccentColorPickerScreen
        title="Workout Mode Color"
        subtitle="..."
        initialColor="#2F80FF"
        previewKind="workout"
        saving={false}
        saveError={null}
        onSave={jest.fn()}
        onBack={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('preset-swatch-#EF4444'));

    expect(screen.getByTestId('preset-swatch-#EF4444').props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.getByTestId('preset-swatch-#2F80FF').props.accessibilityState.selected).toBe(
      false,
    );
  });

  it('opens the custom color editor and lets the user pick an arbitrary hex', () => {
    render(
      <AccentColorPickerScreen
        title="Workout Mode Color"
        subtitle="..."
        initialColor="#2F80FF"
        previewKind="workout"
        saving={false}
        saveError={null}
        onSave={jest.fn()}
        onBack={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('custom-color-hex-input')).toBeNull();

    fireEvent.press(screen.getByTestId('open-custom-color'));

    expect(screen.getByTestId('open-custom-color').props.accessibilityState.selected).toBe(true);
    fireEvent.changeText(screen.getByTestId('custom-color-hex-input'), '123ABC');

    fireEvent.press(screen.getByTestId('accent-color-save'));
  });

  it('starts in custom mode when the initial color is not a preset', () => {
    render(
      <AccentColorPickerScreen
        title="Workout Mode Color"
        subtitle="..."
        initialColor="#123456"
        previewKind="workout"
        saving={false}
        saveError={null}
        onSave={jest.fn()}
        onBack={jest.fn()}
      />,
    );

    expect(screen.getByTestId('custom-color-hex-input')).toBeTruthy();
  });

  it('calls onSave with the currently selected color', () => {
    const onSave = jest.fn();
    render(
      <AccentColorPickerScreen
        title="Workout Mode Color"
        subtitle="..."
        initialColor="#2F80FF"
        previewKind="workout"
        saving={false}
        saveError={null}
        onSave={onSave}
        onBack={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('preset-swatch-#EF4444'));
    fireEvent.press(screen.getByTestId('accent-color-save'));

    expect(onSave).toHaveBeenCalledWith('#EF4444');
  });

  it('calls onBack when the back button is pressed', () => {
    const onBack = jest.fn();
    render(
      <AccentColorPickerScreen
        title="Workout Mode Color"
        subtitle="..."
        initialColor="#2F80FF"
        previewKind="workout"
        saving={false}
        saveError={null}
        onSave={jest.fn()}
        onBack={onBack}
      />,
    );

    fireEvent.press(screen.getByTestId('accent-color-picker-back'));

    expect(onBack).toHaveBeenCalled();
  });

  it('shows the save error when given one', () => {
    render(
      <AccentColorPickerScreen
        title="Workout Mode Color"
        subtitle="..."
        initialColor="#2F80FF"
        previewKind="workout"
        saving={false}
        saveError="Failed to save"
        onSave={jest.fn()}
        onBack={jest.fn()}
      />,
    );

    expect(screen.getByTestId('accent-color-save-error')).toHaveTextContent('Failed to save');
  });

  it('disables the save button while saving', () => {
    render(
      <AccentColorPickerScreen
        title="Workout Mode Color"
        subtitle="..."
        initialColor="#2F80FF"
        previewKind="workout"
        saving={true}
        saveError={null}
        onSave={jest.fn()}
        onBack={jest.fn()}
      />,
    );

    expect(screen.getByTestId('accent-color-save').props.accessibilityState?.disabled).toBe(true);
  });

  it('renders nutrition-specific preview elements only in nutrition mode', () => {
    render(
      <AccentColorPickerScreen
        title="Nutrition Mode Color"
        subtitle="..."
        initialColor="#10B981"
        previewKind="nutrition"
        saving={false}
        saveError={null}
        onSave={jest.fn()}
        onBack={jest.fn()}
      />,
    );

    expect(screen.getByText('Macro progress')).toBeTruthy();
  });

  it('does not render nutrition-specific preview elements in workout mode', () => {
    render(
      <AccentColorPickerScreen
        title="Workout Mode Color"
        subtitle="..."
        initialColor="#2F80FF"
        previewKind="workout"
        saving={false}
        saveError={null}
        onSave={jest.fn()}
        onBack={jest.fn()}
      />,
    );

    expect(screen.queryByText('Macro progress')).toBeNull();
  });

  it('renders every preset group label', () => {
    render(
      <AccentColorPickerScreen
        title="Workout Mode Color"
        subtitle="..."
        initialColor="#2F80FF"
        previewKind="workout"
        saving={false}
        saveError={null}
        onSave={jest.fn()}
        onBack={jest.fn()}
      />,
    );

    for (const label of [
      'Blues',
      'Purple',
      'Green',
      'Red',
      'Orange',
      'Yellow / Gold',
      'Pink',
      'Cyan / Teal',
      'Earth / Luxury',
      'Monochrome',
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });
});
