import { Alert, StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth/AuthProvider';
import { createExercise, updateExercise } from '../lib/api';
import { invalidateExerciseCache } from '../exercises/exerciseQueries';
import { uploadEquipmentPhoto } from '../lib/equipmentPhotoUpload';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { ExerciseFormScreen } from './ExerciseFormScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  createExercise: jest.fn(),
  updateExercise: jest.fn(),
}));

jest.mock('../exercises/exerciseQueries', () => ({
  invalidateExerciseCache: jest.fn(),
}));

jest.mock('../lib/equipmentPhotoUpload', () => ({
  uploadEquipmentPhoto: jest.fn(),
}));

// expo-image-picker itself isn't mocked here beyond what the shared jest
// setup already provides -- these tests only exercise the "add a photo"
// entry point (an Alert with Take/Choose options), never a real picker
// launch, matching FoodFormScreen.test.tsx's own scope.

const mockUseAuth = useAuth as jest.Mock;
const mockCreateExercise = createExercise as jest.Mock;
const mockUpdateExercise = updateExercise as jest.Mock;
const mockInvalidateExerciseCache = invalidateExerciseCache as jest.Mock;
const mockUploadEquipmentPhoto = uploadEquipmentPhoto as jest.Mock;

const ownedExercise = {
  id: 'ex-mine',
  name: 'My Curl Variation',
  muscleGroup: 'biceps' as const,
  movementType: 'bilateral' as const,
  loggingStyle: null,
  photoUrl: null,
  isActive: true,
  createdBy: 'user-1',
};

function selectMuscleGroup(fieldTestId: string, group: string) {
  fireEvent.press(screen.getByTestId(fieldTestId));
  fireEvent.press(screen.getByTestId(`${fieldTestId}-option-${group}`));
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    session: { access_token: 'token-123' },
    user: { id: 'user-1' },
  });
  mockCreateExercise.mockReset().mockResolvedValue({ id: 'ex-new' });
  mockUpdateExercise.mockReset().mockResolvedValue({});
  mockInvalidateExerciseCache.mockClear();
  mockUploadEquipmentPhoto.mockReset().mockResolvedValue('https://example.com/uploaded.jpg');
});

describe('ExerciseFormScreen (create mode)', () => {
  it('disables Save until a name and muscle group are chosen', () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByTestId('exercise-form-save').props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Cable Preacher Curl');
    expect(screen.getByTestId('exercise-form-save').props.accessibilityState.disabled).toBe(true);

    selectMuscleGroup('exercise-form-muscle-group', 'biceps');
    expect(screen.getByTestId('exercise-form-save').props.accessibilityState.disabled).toBe(false);
  });

  it('shows the picked muscle group on the field and creates a bilateral exercise', async () => {
    const onDone = jest.fn();
    render(<ExerciseFormScreen mode="create" onDone={onDone} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), '  Cable Preacher Curl  ');
    selectMuscleGroup('exercise-form-muscle-group', 'biceps');
    expect(screen.getByTestId('exercise-form-muscle-group')).toHaveTextContent('Biceps', {
      exact: false,
    });

    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockCreateExercise).toHaveBeenCalledWith('token-123', {
        name: 'Cable Preacher Curl',
        muscleGroup: 'biceps',
        movementType: 'bilateral',
      }),
    );
    expect(mockInvalidateExerciseCache).toHaveBeenCalledWith('user-1');
    expect(onDone).toHaveBeenCalled();
  });

  it('creates a unilateral exercise with logging_style set automatically -- never asked as its own question', async () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Single-Arm Lat Pulldown');
    selectMuscleGroup('exercise-form-muscle-group', 'back');
    expect(screen.queryByText(/logging style/i)).toBeNull();

    fireEvent(screen.getByTestId('exercise-form-unilateral'), 'valueChange', true);
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockCreateExercise).toHaveBeenCalledWith('token-123', {
        name: 'Single-Arm Lat Pulldown',
        muscleGroup: 'back',
        movementType: 'unilateral',
        loggingStyle: 'single_side',
      }),
    );
  });

  it('flipping Unilateral back off before saving creates a plain bilateral exercise', async () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Row');
    selectMuscleGroup('exercise-form-muscle-group', 'back');
    fireEvent(screen.getByTestId('exercise-form-unilateral'), 'valueChange', true);
    fireEvent(screen.getByTestId('exercise-form-unilateral'), 'valueChange', false);
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockCreateExercise).toHaveBeenCalledWith(
        'token-123',
        expect.objectContaining({ movementType: 'bilateral' }),
      ),
    );
    expect(mockCreateExercise.mock.calls[0][1]).not.toHaveProperty('loggingStyle');
  });

  it('shows an error and does not call onDone when createExercise fails', async () => {
    mockCreateExercise.mockRejectedValue(
      new Error('You already have a custom exercise with that name'),
    );
    const onDone = jest.fn();
    render(<ExerciseFormScreen mode="create" onDone={onDone} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Dupe');
    selectMuscleGroup('exercise-form-muscle-group', 'chest');
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    expect(await screen.findByTestId('exercise-form-error')).toHaveTextContent(
      'You already have a custom exercise with that name',
    );
    expect(onDone).not.toHaveBeenCalled();
  });

  it('calls onCancel from the header', () => {
    const onCancel = jest.fn();
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={onCancel} />);

    fireEvent.press(screen.getByTestId('exercise-form-cancel'));

    expect(onCancel).toHaveBeenCalled();
  });

  it('never shows Delete in create mode', () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.queryByTestId('exercise-form-delete')).toBeNull();
  });

  it('adds a photo, uploads it on Save, and includes it in the create payload', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Choose from Library')?.onPress?.();
    });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file://new-photo.jpg' }],
    });
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Leg Press');
    selectMuscleGroup('exercise-form-muscle-group', 'quadriceps');

    fireEvent.press(screen.getByTestId('exercise-form-photo-add'));
    expect(await screen.findByTestId('exercise-form-photo-preview')).toBeTruthy();

    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockUploadEquipmentPhoto).toHaveBeenCalledWith('user-1', 'file://new-photo.jpg'),
    );
    await waitFor(() =>
      expect(mockCreateExercise).toHaveBeenCalledWith(
        'token-123',
        expect.objectContaining({ photoUrl: 'https://example.com/uploaded.jpg' }),
      ),
    );
  });
});

describe('ExerciseFormScreen (edit mode)', () => {
  it('prefills every field from the existing exercise', () => {
    render(
      <ExerciseFormScreen
        mode="edit"
        exercise={ownedExercise}
        onDone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByTestId('exercise-form-name')).toHaveProp('value', 'My Curl Variation');
    expect(screen.getByTestId('exercise-form-muscle-group')).toHaveTextContent('Biceps', {
      exact: false,
    });
    expect(screen.getByTestId('exercise-form-unilateral').props.value).toBe(false);
  });

  it('prefills Unilateral as on for an existing unilateral exercise', () => {
    render(
      <ExerciseFormScreen
        mode="edit"
        exercise={{ ...ownedExercise, movementType: 'unilateral', loggingStyle: 'alternating' }}
        onDone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByTestId('exercise-form-unilateral').props.value).toBe(true);
  });

  it('saves edited fields via updateExercise', async () => {
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

    await waitFor(() =>
      expect(mockUpdateExercise).toHaveBeenCalledWith('token-123', 'ex-mine', {
        name: 'Renamed Curl',
        muscleGroup: 'biceps',
        movementType: 'bilateral',
        isActive: true,
      }),
    );
    expect(mockInvalidateExerciseCache).toHaveBeenCalledWith('user-1');
    expect(onDone).toHaveBeenCalled();
  });

  it('deletes an active exercise once the person confirms, and leaves the library', async () => {
    const onDone = jest.fn();
    const alert = jest.spyOn(Alert, 'alert');
    alert.mockClear();
    render(
      <ExerciseFormScreen
        mode="edit"
        exercise={ownedExercise}
        onDone={onDone}
        onCancel={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('exercise-form-delete'));
    expect(mockUpdateExercise).not.toHaveBeenCalled();
    const buttons = (alert.mock.calls[0]?.[2] ?? []) as { text?: string; onPress?: () => void }[];
    buttons.find((button) => button.text === 'Delete')?.onPress?.();

    await waitFor(() =>
      expect(mockUpdateExercise).toHaveBeenCalledWith('token-123', 'ex-mine', { isActive: false }),
    );
    expect(mockInvalidateExerciseCache).toHaveBeenCalledWith('user-1');
    expect(onDone).toHaveBeenCalled();
    alert.mockRestore();
  });

  it('offers no Reactivate: a deleted exercise does not come back', () => {
    render(
      <ExerciseFormScreen
        mode="edit"
        exercise={{ ...ownedExercise, isActive: false }}
        onDone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('exercise-form-delete')).toBeNull();
    expect(screen.queryByText('Reactivate')).toBeNull();
  });

  it('shows an existing photo and lets it be replaced', async () => {
    render(
      <ExerciseFormScreen
        mode="edit"
        exercise={{ ...ownedExercise, photoUrl: 'https://example.com/existing.jpg' }}
        onDone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByTestId('exercise-form-photo-preview').props.source).toEqual({
      uri: 'https://example.com/existing.jpg',
    });
    expect(screen.getByTestId('exercise-form-photo-change')).toBeTruthy();

    fireEvent.press(screen.getByTestId('exercise-form-save'));

    // Nothing picked/removed -- the stored photo is left alone (no photoUrl key at all).
    await waitFor(() => expect(mockUpdateExercise).toHaveBeenCalled());
    expect(mockUpdateExercise.mock.calls[0][2]).not.toHaveProperty('photoUrl');
  });

  it('clears an existing photo via Remove Photo', async () => {
    render(
      <ExerciseFormScreen
        mode="edit"
        exercise={{ ...ownedExercise, photoUrl: 'https://example.com/existing.jpg' }}
        onDone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('exercise-form-photo-remove'));
    expect(screen.queryByTestId('exercise-form-photo-preview')).toBeNull();

    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockUpdateExercise).toHaveBeenCalledWith(
        'token-123',
        'ex-mine',
        expect.objectContaining({ photoUrl: null }),
      ),
    );
  });
});

describe('ExerciseFormScreen -- layout', () => {
  it('gives the screen real horizontal breathing room from the edges', () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    const scroll = screen.getByTestId('exercise-form-scroll');
    const contentStyle = StyleSheet.flatten(scroll.props.contentContainerStyle);
    expect(contentStyle.paddingHorizontal).toBeGreaterThan(0);
  });

  it('puts a named Cancel in the header', () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByTestId('exercise-form-cancel').props.accessibilityLabel).toBe('Cancel');
  });

  it('renders no bare text outside <Text>', () => {
    render(
      <ExerciseFormScreen
        mode="edit"
        exercise={{ ...ownedExercise, photoUrl: 'https://example.com/existing.jpg' }}
        onDone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expectNoBareText();
  });
});
