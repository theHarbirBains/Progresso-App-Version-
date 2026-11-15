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
  measurementType: 'weight_reps' as const,
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
        measurementType: 'weight_reps',
      }),
    );
    expect(mockInvalidateExerciseCache).toHaveBeenCalledWith('user-1');
    expect(onDone).toHaveBeenCalled();
  });

  it("saves what sets the machine apart -- only what's filled in, trimmed", async () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Seated Row');
    selectMuscleGroup('exercise-form-muscle-group', 'back');
    fireEvent.changeText(screen.getByTestId('exercise-form-gym'), ' Downtown ');
    fireEvent.changeText(screen.getByTestId('exercise-form-attachment'), ' Wide grip ');
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockCreateExercise).toHaveBeenCalledWith('token-123', {
        name: 'Seated Row',
        muscleGroup: 'back',
        movementType: 'bilateral',
        measurementType: 'weight_reps',
        gym: 'Downtown',
        attachment: 'Wide grip',
      }),
    );
  });

  it('saves how it is loaded and its pulley -- a pulley only on a weight stack', async () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Cable Crossover');
    selectMuscleGroup('exercise-form-muscle-group', 'chest');
    fireEvent.press(screen.getByTestId('exercise-form-load-type-double_stack'));
    fireEvent.press(screen.getByTestId('exercise-form-pulley-lighter'));
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockCreateExercise).toHaveBeenCalledWith(
        'token-123',
        expect.objectContaining({ loadType: 'double_stack', pulley: 'lighter' }),
      ),
    );
  });

  it('asks nothing about a pulley on a plate-loaded machine, and clears a choice tapped again', async () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Chest Press');
    selectMuscleGroup('exercise-form-muscle-group', 'chest');
    fireEvent.press(screen.getByTestId('exercise-form-load-type-single_stack'));
    fireEvent.press(screen.getByTestId('exercise-form-pulley-heavier'));
    fireEvent.press(screen.getByTestId('exercise-form-load-type-plate_loaded'));
    expect(screen.queryByTestId('exercise-form-pulley')).toBeNull();
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() => expect(mockCreateExercise).toHaveBeenCalled());
    const sent = mockCreateExercise.mock.calls[0][1];
    expect(sent.loadType).toBe('plate_loaded');
    expect(sent).not.toHaveProperty('pulley');

    // Tapped again, it's cleared.
    fireEvent.press(screen.getByTestId('exercise-form-load-type-plate_loaded'));
    expect(screen.getByTestId('exercise-form-pulley')).toBeTruthy();
  });

  it('explains each box plainly, and only the name is required -- with no note on how it feels', () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByText('The only thing you have to fill in.')).toBeTruthy();
    expect(screen.getByText('Tell This Machine Apart (Optional)')).toBeTruthy();
    expect(
      screen.getByText(/Two machines can do the same thing but feel heavier or lighter/),
    ).toBeTruthy();
    expect(screen.getByText(/The easiest way to tell it apart/)).toBeTruthy();
    expect(screen.getByTestId('exercise-form-attachment')).toBeTruthy();
    expect(screen.queryByTestId('exercise-form-feel')).toBeNull();
    expect(screen.queryByText(/How It Feels/)).toBeNull();
  });

  it('offers common grips to tap -- and says why a grip matters, and what neutral means', () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);
    selectMuscleGroup('exercise-form-muscle-group', 'back');

    expect(screen.getByText('Grip or Handle')).toBeTruthy();
    expect(screen.getByText(/a wide grip works your upper back more/)).toBeTruthy();
    expect(screen.getByTestId('exercise-form-grip-glossary')).toHaveTextContent(
      /Neutral: palms face each other/,
    );

    fireEvent.press(screen.getByTestId('exercise-form-grip-choices-Neutral grip'));
    expect(screen.getByTestId('exercise-form-attachment').props.value).toBe('Neutral grip');
    expect(
      screen.getByTestId('exercise-form-grip-choices-Neutral grip').props.accessibilityState
        .selected,
    ).toBe(true);

    // Tapping it again clears it.
    fireEvent.press(screen.getByTestId('exercise-form-grip-choices-Neutral grip'));
    expect(screen.getByTestId('exercise-form-attachment').props.value).toBe('');
  });

  it('asks where the feet go for a leg machine, with its own choices', () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);
    selectMuscleGroup('exercise-form-muscle-group', 'quadriceps');

    expect(screen.getByText('Foot Position')).toBeTruthy();
    expect(screen.getByText(/feet high works your glutes and hamstrings more/)).toBeTruthy();
    expect(screen.queryByTestId('exercise-form-grip-glossary')).toBeNull();
    fireEvent.press(screen.getByTestId('exercise-form-grip-choices-Feet high'));
    expect(screen.getByTestId('exercise-form-attachment').props.value).toBe('Feet high');
  });

  it('shows a typed grip that is one of the choices as chosen', () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('exercise-form-attachment'), 'v-handle');

    expect(
      screen.getByTestId('exercise-form-grip-choices-V-handle').props.accessibilityState.selected,
    ).toBe(true);
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
        measurementType: 'weight_reps',
        loggingStyle: 'single_side',
      }),
    );
  });

  it('starts on weight and reps, and creates a bodyweight or timed exercise when picked', async () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    expect(
      screen.getByTestId('exercise-form-measurement-weight_reps').props.accessibilityState.selected,
    ).toBe(true);
    expect(screen.getByTestId('exercise-form-measurement-hint')).toHaveTextContent(
      'A weight and reps for each set.',
    );

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Ring Dip');
    selectMuscleGroup('exercise-form-muscle-group', 'chest');
    fireEvent.press(screen.getByTestId('exercise-form-measurement-bodyweight'));
    expect(screen.getByTestId('exercise-form-measurement-hint')).toHaveTextContent(
      'For added weight, make a weighted version.',
      { exact: false },
    );
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockCreateExercise).toHaveBeenCalledWith(
        'token-123',
        expect.objectContaining({ name: 'Ring Dip', measurementType: 'bodyweight' }),
      ),
    );
  });

  it('creates a timed exercise', async () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Wall Sit');
    selectMuscleGroup('exercise-form-muscle-group', 'quadriceps');
    fireEvent.press(screen.getByTestId('exercise-form-measurement-timed'));
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockCreateExercise).toHaveBeenCalledWith(
        'token-123',
        expect.objectContaining({ name: 'Wall Sit', measurementType: 'timed' }),
      ),
    );
  });

  it('reads each choice out in full', () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByLabelText('Weight and reps')).toBeTruthy();
    expect(screen.getByLabelText('Reps only')).toBeTruthy();
    expect(screen.getByLabelText('Time')).toBeTruthy();
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

  it('prefills what an existing exercise is measured by, and saves a change to it', async () => {
    render(
      <ExerciseFormScreen
        mode="edit"
        exercise={{ ...ownedExercise, measurementType: 'timed' }}
        onDone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(
      screen.getByTestId('exercise-form-measurement-timed').props.accessibilityState.selected,
    ).toBe(true);

    fireEvent.press(screen.getByTestId('exercise-form-measurement-bodyweight'));
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockUpdateExercise).toHaveBeenCalledWith(
        'token-123',
        'ex-mine',
        expect.objectContaining({ measurementType: 'bodyweight' }),
      ),
    );
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
        measurementType: 'weight_reps',
        isActive: true,
        gym: null,
        attachment: null,
        loadType: null,
        pulley: null,
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
