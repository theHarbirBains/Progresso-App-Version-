import { fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { createExercise, updateExercise } from '../lib/api';
import { ExerciseFormScreen } from './ExerciseFormScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  createExercise: jest.fn(),
  updateExercise: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockCreateExercise = createExercise as jest.Mock;
const mockUpdateExercise = updateExercise as jest.Mock;

const ownedExercise = {
  id: 'ex-mine',
  name: 'My Curl Variation',
  muscleGroup: 'biceps' as const,
  isActive: true,
  createdBy: 'user-1',
};

beforeEach(() => {
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-123' } });
  mockCreateExercise.mockReset();
  mockUpdateExercise.mockReset();
});

describe('ExerciseFormScreen (create mode)', () => {
  it('disables Save until a name and muscle group are chosen', () => {
    const onDone = jest.fn();
    const onCancel = jest.fn();
    render(<ExerciseFormScreen mode="create" onDone={onDone} onCancel={onCancel} />);

    expect(screen.getByTestId('exercise-form-save').props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Cable Preacher Curl');
    expect(screen.getByTestId('exercise-form-save').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('muscle-group-chip-biceps'));
    expect(screen.getByTestId('exercise-form-save').props.accessibilityState.disabled).toBe(false);
  });

  it('creates the exercise and calls onDone on success', async () => {
    mockCreateExercise.mockResolvedValue({ id: 'new-id' });
    const onDone = jest.fn();
    render(<ExerciseFormScreen mode="create" onDone={onDone} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), '  Cable Preacher Curl  ');
    fireEvent.press(screen.getByTestId('muscle-group-chip-biceps'));
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await screen.findByTestId('exercise-form-name');
    expect(mockCreateExercise).toHaveBeenCalledWith('token-123', {
      name: 'Cable Preacher Curl',
      muscleGroup: 'biceps',
    });
    expect(onDone).toHaveBeenCalled();
  });

  it('shows an error and does not call onDone when creation fails', async () => {
    mockCreateExercise.mockRejectedValue(
      new Error('You already have a custom exercise with that name'),
    );
    const onDone = jest.fn();
    render(<ExerciseFormScreen mode="create" onDone={onDone} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Dupe');
    fireEvent.press(screen.getByTestId('muscle-group-chip-chest'));
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    expect(await screen.findByTestId('exercise-form-error')).toHaveTextContent(
      'You already have a custom exercise with that name',
    );
    expect(onDone).not.toHaveBeenCalled();
  });

  it('calls onCancel when Cancel is pressed', () => {
    const onCancel = jest.fn();
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={onCancel} />);

    fireEvent.press(screen.getByTestId('exercise-form-cancel'));

    expect(onCancel).toHaveBeenCalled();
  });

  it('has no deactivate/reactivate button in create mode', () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.queryByTestId('exercise-form-toggle-active')).toBeNull();
  });
});

describe('ExerciseFormScreen (edit mode)', () => {
  it('prefills the name and muscle group from the given exercise', () => {
    render(
      <ExerciseFormScreen
        mode="edit"
        exercise={ownedExercise}
        onDone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByTestId('exercise-form-name').props.value).toBe('My Curl Variation');
    // The biceps chip should render selected (white background) since the
    // exercise being edited is a biceps exercise.
    expect(screen.getByTestId('muscle-group-chip-biceps')).toHaveStyle({
      backgroundColor: '#FFFFFF',
    });
    expect(screen.getByTestId('muscle-group-chip-chest')).not.toHaveStyle({
      backgroundColor: '#FFFFFF',
    });
  });

  it('saves edits via updateExercise', async () => {
    mockUpdateExercise.mockResolvedValue({ id: 'ex-mine' });
    const onDone = jest.fn();
    render(
      <ExerciseFormScreen
        mode="edit"
        exercise={ownedExercise}
        onDone={onDone}
        onCancel={jest.fn()}
      />,
    );

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Renamed Curl');
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await screen.findByTestId('exercise-form-name');
    expect(mockUpdateExercise).toHaveBeenCalledWith('token-123', 'ex-mine', {
      name: 'Renamed Curl',
      muscleGroup: 'biceps',
      isActive: true,
    });
    expect(onDone).toHaveBeenCalled();
  });

  it('shows "Deactivate" for an active exercise and deactivates on press', async () => {
    mockUpdateExercise.mockResolvedValue({ id: 'ex-mine', isActive: false });
    const onDone = jest.fn();
    render(
      <ExerciseFormScreen
        mode="edit"
        exercise={ownedExercise}
        onDone={onDone}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByTestId('exercise-form-toggle-active')).toHaveTextContent('Deactivate');
    fireEvent.press(screen.getByTestId('exercise-form-toggle-active'));

    await screen.findByTestId('exercise-form-name');
    expect(mockUpdateExercise).toHaveBeenCalledWith('token-123', 'ex-mine', { isActive: false });
    expect(onDone).toHaveBeenCalled();
  });

  it('shows "Reactivate" for an inactive exercise and reactivates on press', async () => {
    mockUpdateExercise.mockResolvedValue({ id: 'ex-mine', isActive: true });
    render(
      <ExerciseFormScreen
        mode="edit"
        exercise={{ ...ownedExercise, isActive: false }}
        onDone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByTestId('exercise-form-toggle-active')).toHaveTextContent('Reactivate');
    fireEvent.press(screen.getByTestId('exercise-form-toggle-active'));

    await screen.findByTestId('exercise-form-name');
    expect(mockUpdateExercise).toHaveBeenCalledWith('token-123', 'ex-mine', { isActive: true });
  });
});
