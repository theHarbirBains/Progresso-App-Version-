import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth/AuthProvider';
import { colors } from '../design/theme';
import { createEquipmentProfile, createExercise, updateExercise } from '../lib/api';
import { uploadEquipmentPhoto } from '../lib/equipmentPhotoUpload';
import { ExerciseFormScreen } from './ExerciseFormScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  createExercise: jest.fn(),
  updateExercise: jest.fn(),
  createEquipmentProfile: jest.fn(),
}));

jest.mock('../lib/equipmentPhotoUpload', () => ({
  uploadEquipmentPhoto: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockCreateExercise = createExercise as jest.Mock;
const mockUpdateExercise = updateExercise as jest.Mock;
const mockCreateEquipmentProfile = createEquipmentProfile as jest.Mock;
const mockUploadEquipmentPhoto = uploadEquipmentPhoto as jest.Mock;

const ownedExercise = {
  id: 'ex-mine',
  name: 'My Curl Variation',
  muscleGroup: 'biceps' as const,
  movementType: 'bilateral' as const,
  loggingStyle: null,
  isActive: true,
  createdBy: 'user-1',
};

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    session: { access_token: 'token-123' },
    user: { id: 'user-1' },
  });
  mockCreateExercise.mockReset();
  mockUpdateExercise.mockReset();
  mockCreateEquipmentProfile.mockReset();
  mockUploadEquipmentPhoto.mockReset();
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
      movementType: 'bilateral',
    });
    expect(onDone).toHaveBeenCalled();
  });

  it('creates a unilateral exercise with its logging style', async () => {
    mockCreateExercise.mockResolvedValue({ id: 'new-id' });
    const onDone = jest.fn();
    render(<ExerciseFormScreen mode="create" onDone={onDone} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Single-Arm Lat Pulldown');
    fireEvent.press(screen.getByTestId('muscle-group-chip-back'));
    fireEvent.press(screen.getByTestId('exercise-form-movement-type-unilateral'));
    fireEvent.press(screen.getByTestId('exercise-form-logging-style-single_side'));
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await screen.findByTestId('exercise-form-name');
    expect(mockCreateExercise).toHaveBeenCalledWith('token-123', {
      name: 'Single-Arm Lat Pulldown',
      muscleGroup: 'back',
      movementType: 'unilateral',
      loggingStyle: 'single_side',
    });
    expect(onDone).toHaveBeenCalled();
  });

  it('selects Alternating as the logging style', async () => {
    mockCreateExercise.mockResolvedValue({ id: 'new-id' });
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Walking Lunge');
    fireEvent.press(screen.getByTestId('muscle-group-chip-quadriceps'));
    fireEvent.press(screen.getByTestId('exercise-form-movement-type-unilateral'));
    fireEvent.press(screen.getByTestId('exercise-form-logging-style-alternating'));
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockCreateExercise).toHaveBeenCalledWith(
        'token-123',
        expect.objectContaining({ movementType: 'unilateral', loggingStyle: 'alternating' }),
      ),
    );
  });

  it('keeps Save enabled after choosing Unilateral (Single Side is the default shown), without touching Logging Style', async () => {
    mockCreateExercise.mockResolvedValue({ id: 'new-id' });
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Single-Arm Row');
    fireEvent.press(screen.getByTestId('muscle-group-chip-back'));
    fireEvent.press(screen.getByTestId('exercise-form-movement-type-unilateral'));
    expect(screen.getByTestId('exercise-form-save').props.accessibilityState.disabled).toBe(false);

    fireEvent.press(screen.getByTestId('exercise-form-save'));
    await waitFor(() =>
      expect(mockCreateExercise).toHaveBeenCalledWith('token-123', {
        name: 'Single-Arm Row',
        muscleGroup: 'back',
        movementType: 'unilateral',
        loggingStyle: 'single_side',
      }),
    );
  });

  it('still saves as bilateral (no logging style) when switched back from Unilateral', async () => {
    mockCreateExercise.mockResolvedValue({ id: 'new-id' });
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Row');
    fireEvent.press(screen.getByTestId('muscle-group-chip-back'));
    fireEvent.press(screen.getByTestId('exercise-form-movement-type-unilateral'));
    fireEvent.press(screen.getByTestId('exercise-form-movement-type-bilateral'));
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockCreateExercise).toHaveBeenCalledWith('token-123', {
        name: 'Row',
        muscleGroup: 'back',
        movementType: 'bilateral',
      }),
    );
  });

  it('hides the Logging Style control for a bilateral exercise', () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.queryByTestId('exercise-form-logging-style')).toBeNull();

    fireEvent.press(screen.getByTestId('exercise-form-movement-type-unilateral'));
    expect(screen.getByTestId('exercise-form-logging-style')).toBeTruthy();
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
    // The biceps chip should render selected (accent background) since the
    // exercise being edited is a biceps exercise.
    expect(screen.getByTestId('muscle-group-chip-biceps')).toHaveStyle({
      backgroundColor: colors.accent,
    });
    expect(screen.getByTestId('muscle-group-chip-chest')).not.toHaveStyle({
      backgroundColor: colors.accent,
    });
  });

  it('prefills Exercise Type/Logging Style from an existing unilateral exercise, and can save it back unchanged', async () => {
    mockUpdateExercise.mockResolvedValue({ id: 'ex-mine' });
    const unilateralExercise = {
      ...ownedExercise,
      movementType: 'unilateral' as const,
      loggingStyle: 'alternating' as const,
    };
    render(
      <ExerciseFormScreen
        mode="edit"
        exercise={unilateralExercise}
        onDone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(
      screen.getByTestId('exercise-form-movement-type-unilateral').props.accessibilityState
        .selected,
    ).toBe(true);
    expect(
      screen.getByTestId('exercise-form-logging-style-alternating').props.accessibilityState
        .selected,
    ).toBe(true);

    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockUpdateExercise).toHaveBeenCalledWith(
        'token-123',
        'ex-mine',
        expect.objectContaining({ movementType: 'unilateral', loggingStyle: 'alternating' }),
      ),
    );
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
      movementType: 'bilateral',
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

describe('ExerciseFormScreen (New Exercise redesign)', () => {
  it('has no back arrow and centers the title, with Cancel available top-right', () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.queryByTestId('app-header-back')).toBeNull();
    expect(screen.getByText('New Exercise')).toBeTruthy();
    expect(
      screen.getByText('Add exercise details to track your progress accurately.'),
    ).toBeTruthy();
    expect(screen.getByTestId('exercise-form-cancel')).toBeTruthy();
  });

  it('does not show the create-only subtitle in edit mode', () => {
    render(
      <ExerciseFormScreen
        mode="edit"
        exercise={ownedExercise}
        onDone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(
      screen.queryByText('Add exercise details to track your progress accurately.'),
    ).toBeNull();
  });

  it('has no "Set as default for this exercise" toggle anywhere on the form', () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.queryByText(/set as default/i)).toBeNull();
  });

  it('shows the Machine/Equipment section only in create mode', () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText('Machine / Equipment')).toBeTruthy();
    expect(screen.getByText('Why add a machine photo?')).toBeTruthy();
    expect(screen.getByText(/pulley and the weight stack/)).toBeTruthy();
    expect(screen.getByTestId('exercise-form-machine-photo-add')).toBeTruthy();

    render(
      <ExerciseFormScreen
        mode="edit"
        exercise={ownedExercise}
        onDone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.queryByText('Machine / Equipment')).toBeNull();
  });

  it('saves a plain exercise (no machine details) without creating an equipment profile', async () => {
    mockCreateExercise.mockResolvedValue({ id: 'new-id' });
    const onDone = jest.fn();
    render(<ExerciseFormScreen mode="create" onDone={onDone} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Leg Press');
    fireEvent.press(screen.getByTestId('muscle-group-chip-quadriceps'));
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(mockCreateEquipmentProfile).not.toHaveBeenCalled();
  });

  it('requires Machine Name once a Gym is entered, and creates the equipment profile on save', async () => {
    mockCreateExercise.mockResolvedValue({ id: 'new-exercise-id' });
    mockCreateEquipmentProfile.mockResolvedValue({ id: 'profile-1' });
    const onDone = jest.fn();
    render(<ExerciseFormScreen mode="create" onDone={onDone} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Leg Press');
    fireEvent.press(screen.getByTestId('muscle-group-chip-quadriceps'));
    fireEvent.changeText(screen.getByTestId('exercise-form-gym'), 'Downtown Gym');

    expect(screen.getByTestId('exercise-form-save').props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('exercise-form-machine-name'), 'Leg Press A');
    expect(screen.getByTestId('exercise-form-save').props.accessibilityState.disabled).toBe(false);

    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockCreateEquipmentProfile).toHaveBeenCalledWith('token-123', {
        exerciseId: 'new-exercise-id',
        name: 'Leg Press A',
        gym: 'Downtown Gym',
      }),
    );
    expect(mockUploadEquipmentPhoto).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it('uploads the machine photo and includes its URL when creating the equipment profile', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Choose from Library')?.onPress?.();
    });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file://machine-photo.jpg' }],
    });
    mockUploadEquipmentPhoto.mockResolvedValue('https://example.com/machine-photo.jpg');
    mockCreateExercise.mockResolvedValue({ id: 'new-exercise-id' });
    mockCreateEquipmentProfile.mockResolvedValue({ id: 'profile-1' });
    const onDone = jest.fn();
    render(<ExerciseFormScreen mode="create" onDone={onDone} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Leg Press');
    fireEvent.press(screen.getByTestId('muscle-group-chip-quadriceps'));
    fireEvent.press(screen.getByTestId('exercise-form-machine-photo-add'));

    await screen.findByTestId('exercise-form-machine-photo-preview');
    fireEvent.changeText(screen.getByTestId('exercise-form-machine-name'), 'Leg Press A');
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockUploadEquipmentPhoto).toHaveBeenCalledWith('user-1', 'file://machine-photo.jpg'),
    );
    expect(mockCreateEquipmentProfile).toHaveBeenCalledWith('token-123', {
      exerciseId: 'new-exercise-id',
      name: 'Leg Press A',
      photoUrl: 'https://example.com/machine-photo.jpg',
    });
    expect(onDone).toHaveBeenCalled();
  });

  it('can remove a picked machine photo before saving', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Choose from Library')?.onPress?.();
    });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file://machine-photo.jpg' }],
    });
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.press(screen.getByTestId('exercise-form-machine-photo-add'));
    await screen.findByTestId('exercise-form-machine-photo-preview');

    fireEvent.press(screen.getByTestId('exercise-form-machine-photo-remove'));

    expect(screen.queryByTestId('exercise-form-machine-photo-preview')).toBeNull();
    expect(screen.getByTestId('exercise-form-machine-photo-add')).toBeTruthy();
  });

  it('still saves the exercise even if the equipment profile creation fails', async () => {
    mockCreateExercise.mockResolvedValue({ id: 'new-exercise-id' });
    mockCreateEquipmentProfile.mockRejectedValue(new Error('Failed to create equipment profile'));
    const onDone = jest.fn();
    render(<ExerciseFormScreen mode="create" onDone={onDone} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Leg Press');
    fireEvent.press(screen.getByTestId('muscle-group-chip-quadriceps'));
    fireEvent.changeText(screen.getByTestId('exercise-form-gym'), 'Downtown Gym');
    fireEvent.changeText(screen.getByTestId('exercise-form-machine-name'), 'Leg Press A');
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });
});

describe('ExerciseFormScreen (sheet presentation)', () => {
  it('renders the same fields and still saves correctly, for use inside a BottomSheet', async () => {
    mockCreateExercise.mockResolvedValue({ id: 'new-id' });
    const onDone = jest.fn();
    render(
      <ExerciseFormScreen
        mode="create"
        onDone={onDone}
        onCancel={jest.fn()}
        presentation="sheet"
        accentColor="#8B5CF6"
        onAccentColor="#0A0A0A"
      />,
    );

    expect(screen.getByText('Create Custom Exercise')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Cable Preacher Curl');
    fireEvent.press(screen.getByTestId('muscle-group-chip-biceps'));
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockCreateExercise).toHaveBeenCalledWith('token-123', {
        name: 'Cable Preacher Curl',
        muscleGroup: 'biceps',
        movementType: 'bilateral',
      }),
    );
    expect(onDone).toHaveBeenCalled();
  });

  it('creates a unilateral exercise from the sheet presentation', async () => {
    mockCreateExercise.mockResolvedValue({ id: 'new-id' });
    render(
      <ExerciseFormScreen
        mode="create"
        onDone={jest.fn()}
        onCancel={jest.fn()}
        presentation="sheet"
        accentColor="#8B5CF6"
        onAccentColor="#0A0A0A"
      />,
    );

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Single-Arm Cable Row');
    fireEvent.press(screen.getByTestId('muscle-group-chip-back'));
    fireEvent.press(screen.getByTestId('exercise-form-movement-type-unilateral'));
    fireEvent.press(screen.getByTestId('exercise-form-logging-style-single_side'));
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockCreateExercise).toHaveBeenCalledWith(
        'token-123',
        expect.objectContaining({ movementType: 'unilateral', loggingStyle: 'single_side' }),
      ),
    );
  });

  it('calls onCancel from the sheet presentation', () => {
    const onCancel = jest.fn();
    render(
      <ExerciseFormScreen
        mode="create"
        onDone={jest.fn()}
        onCancel={onCancel}
        presentation="sheet"
      />,
    );

    fireEvent.press(screen.getByTestId('exercise-form-cancel'));

    expect(onCancel).toHaveBeenCalled();
  });
});
