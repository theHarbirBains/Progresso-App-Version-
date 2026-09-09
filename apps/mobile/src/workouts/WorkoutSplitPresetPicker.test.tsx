import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { DEFAULT_WORKOUT_THEME } from '../theme/accentColor';
import { materializeWorkoutSplitPreset } from './workoutSplitQueries';
import { WorkoutSplitPresetPicker } from './WorkoutSplitPresetPicker';

jest.mock('./workoutSplitQueries', () => ({
  materializeWorkoutSplitPreset: jest.fn(),
}));

const mockMaterialize = materializeWorkoutSplitPreset as jest.Mock;

beforeEach(() => {
  mockMaterialize.mockReset().mockResolvedValue({ id: 'split-new', name: 'Push / Pull / Legs' });
});

describe('WorkoutSplitPresetPicker', () => {
  it('lists every preset', () => {
    render(
      <WorkoutSplitPresetPicker
        testID="picker"
        userId="user-1"
        theme={DEFAULT_WORKOUT_THEME}
        onPresetActivated={jest.fn()}
        onCreateOwn={jest.fn()}
      />,
    );

    expect(screen.getByTestId('picker-preset-ppl')).toBeTruthy();
    expect(screen.getByTestId('picker-preset-upper-lower')).toBeTruthy();
    expect(screen.getByTestId('picker-preset-full-body')).toBeTruthy();
    expect(screen.getByTestId('picker-preset-bro-split')).toBeTruthy();
    expect(screen.getByTestId('picker-preset-ppl-upper-lower')).toBeTruthy();
  });

  it('materializes the pressed preset and reports its new split id', async () => {
    const onPresetActivated = jest.fn();
    render(
      <WorkoutSplitPresetPicker
        testID="picker"
        userId="user-1"
        theme={DEFAULT_WORKOUT_THEME}
        onPresetActivated={onPresetActivated}
        onCreateOwn={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('picker-preset-ppl'));

    await waitFor(() =>
      expect(mockMaterialize).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ id: 'ppl' }),
      ),
    );
    expect(onPresetActivated).toHaveBeenCalledWith('split-new');
  });

  it('shows an error without calling onPresetActivated when materializing fails', async () => {
    mockMaterialize.mockRejectedValue(new Error('network error'));
    const onPresetActivated = jest.fn();
    render(
      <WorkoutSplitPresetPicker
        testID="picker"
        userId="user-1"
        theme={DEFAULT_WORKOUT_THEME}
        onPresetActivated={onPresetActivated}
        onCreateOwn={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('picker-preset-ppl'));

    expect(await screen.findByTestId('picker-error')).toHaveTextContent('network error');
    expect(onPresetActivated).not.toHaveBeenCalled();
  });

  it('calls onCreateOwn when Create Custom Split is pressed', () => {
    const onCreateOwn = jest.fn();
    render(
      <WorkoutSplitPresetPicker
        testID="picker"
        userId="user-1"
        theme={DEFAULT_WORKOUT_THEME}
        onPresetActivated={jest.fn()}
        onCreateOwn={onCreateOwn}
      />,
    );

    fireEvent.press(screen.getByTestId('picker-create-own'));

    expect(onCreateOwn).toHaveBeenCalled();
  });

  it('shows a concise day-name chip per day instead of the full structured muscle-group list', () => {
    render(
      <WorkoutSplitPresetPicker
        testID="picker"
        userId="user-1"
        theme={DEFAULT_WORKOUT_THEME}
        onPresetActivated={jest.fn()}
        onCreateOwn={jest.fn()}
      />,
    );

    const pplCard = screen.getByTestId('picker-preset-ppl');
    expect(within(pplCard).getByText('Push')).toBeTruthy();
    expect(within(pplCard).getByText('Pull')).toBeTruthy();
    expect(within(pplCard).getByText('Legs')).toBeTruthy();
    expect(within(pplCard).queryByText(/Shoulders/)).toBeNull();
    expect(within(pplCard).queryByText(/Triceps/)).toBeNull();
  });

  it('shows a short description for each preset', () => {
    render(
      <WorkoutSplitPresetPicker
        testID="picker"
        userId="user-1"
        theme={DEFAULT_WORKOUT_THEME}
        onPresetActivated={jest.fn()}
        onCreateOwn={jest.fn()}
      />,
    );

    expect(
      screen.getByText('A balanced and popular split for strength and muscle growth.'),
    ).toBeTruthy();
  });

  it('shows the pressed preset as selected (checkmark) while it materializes', async () => {
    let resolveMaterialize: (value: { id: string; name: string }) => void = () => {};
    const onPresetActivated = jest.fn();
    mockMaterialize.mockReturnValue(
      new Promise((resolve) => {
        resolveMaterialize = resolve;
      }),
    );
    render(
      <WorkoutSplitPresetPicker
        testID="picker"
        userId="user-1"
        theme={DEFAULT_WORKOUT_THEME}
        onPresetActivated={onPresetActivated}
        onCreateOwn={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('picker-preset-ppl'));

    expect(await screen.findByTestId('picker-preset-ppl-selected')).toBeTruthy();
    resolveMaterialize({ id: 'split-new', name: 'Push / Pull / Legs' });
    await waitFor(() => expect(onPresetActivated).toHaveBeenCalledWith('split-new'));
  });
});
