import { Alert, StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth/AuthProvider';
import { createExercise, updateExercise } from '../lib/api';
import {
  countLoggedWorkouts,
  fetchAllExercises,
  invalidateExerciseCache,
} from '../exercises/exerciseQueries';
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
  fetchAllExercises: jest.fn(),
  countLoggedWorkouts: jest.fn(),
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
const mockFetchAllExercises = fetchAllExercises as jest.Mock;
const mockCountLoggedWorkouts = countLoggedWorkouts as jest.Mock;

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
  mockFetchAllExercises.mockReset().mockResolvedValue([]);
  mockCountLoggedWorkouts.mockReset().mockResolvedValue(0);
});

const SETUP_FIELDS = [
  'exercise-form-gym',
  'exercise-form-grip',
  'exercise-form-attachment',
  'exercise-form-load-type',
  'exercise-form-pulley-position',
  'exercise-form-setup-details',
];

/** Which setup fields are on screen now. */
function shownSetupFields(): string[] {
  return SETUP_FIELDS.filter((id) => screen.queryByTestId(id) !== null);
}

function startExercise(name: string, group: string, equipment?: string) {
  fireEvent.changeText(screen.getByTestId('exercise-form-name'), name);
  selectMuscleGroup('exercise-form-muscle-group', group);
  if (equipment) fireEvent.press(screen.getByTestId(`exercise-form-equipment-${equipment}`));
}

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
        secondaryMuscleGroups: [],
        movementType: 'bilateral',
        measurementType: 'weight_reps',
      }),
    );
    expect(mockInvalidateExerciseCache).toHaveBeenCalledWith('user-1');
    expect(onDone).toHaveBeenCalled();
  });

  it('asks what else it works -- any of the other muscle groups, never its own', async () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Close-Grip Press');
    selectMuscleGroup('exercise-form-muscle-group', 'chest');
    // Its own group isn't offered; Full Body and Other never are.
    expect(screen.queryByTestId('exercise-form-secondary-muscles-chest')).toBeNull();
    expect(screen.queryByTestId('exercise-form-secondary-muscles-full_body')).toBeNull();
    expect(screen.queryByTestId('exercise-form-secondary-muscles-other')).toBeNull();

    fireEvent.press(screen.getByTestId('exercise-form-secondary-muscles-triceps'));
    fireEvent.press(screen.getByTestId('exercise-form-secondary-muscles-shoulders'));
    fireEvent.press(screen.getByTestId('exercise-form-secondary-muscles-forearms'));
    // Tapped again, left out.
    fireEvent.press(screen.getByTestId('exercise-form-secondary-muscles-forearms'));
    expect(
      screen.getByTestId('exercise-form-secondary-muscles-triceps').props.accessibilityState,
    ).toMatchObject({ selected: true });

    // A muscle chosen as the main one leaves the others.
    selectMuscleGroup('exercise-form-muscle-group', 'triceps');
    expect(screen.queryByTestId('exercise-form-secondary-muscles-triceps')).toBeNull();
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockCreateExercise).toHaveBeenCalledWith(
        'token-123',
        expect.objectContaining({ muscleGroup: 'triceps', secondaryMuscleGroups: ['shoulders'] }),
      ),
    );
  });

  it('keeps a dumbbell exercise quick: its photo, and the rest behind More Details', async () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);
    startExercise('Dumbbell Curl', 'biceps', 'dumbbell');

    expect(shownSetupFields()).toEqual([]);
    expect(screen.getByTestId('exercise-form-photo-add')).toBeTruthy();
    expect(screen.getByTestId('exercise-form-more-hint')).toHaveTextContent(
      'Add a gym, grip or setup notes, if it matters.',
    );

    fireEvent.press(screen.getByTestId('exercise-form-save'));
    await waitFor(() =>
      expect(mockCreateExercise).toHaveBeenCalledWith('token-123', {
        name: 'Dumbbell Curl',
        muscleGroup: 'biceps',
        secondaryMuscleGroups: [],
        movementType: 'bilateral',
        measurementType: 'weight_reps',
        equipment: 'dumbbell',
      }),
    );
  });

  it("opens a free-weight exercise's optional details only when asked -- never a machine's", () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);
    startExercise('Dumbbell Curl', 'biceps', 'dumbbell');

    fireEvent.press(screen.getByTestId('exercise-form-more'));

    expect(shownSetupFields()).toEqual([
      'exercise-form-gym',
      'exercise-form-grip',
      'exercise-form-setup-details',
    ]);
    expect(screen.queryByTestId('exercise-form-more')).toBeNull();
  });

  it('asks a barbell exercise for its grip, and nothing of a machine', async () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);
    startExercise('Bench Press', 'chest', 'barbell');

    expect(shownSetupFields()).toEqual(['exercise-form-grip']);
    fireEvent.press(screen.getByTestId('exercise-form-grip-choices-Wide grip'));
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockCreateExercise).toHaveBeenCalledWith(
        'token-123',
        expect.objectContaining({ equipment: 'barbell', grip: 'Wide grip' }),
      ),
    );
    expect(mockCreateExercise.mock.calls[0][1]).not.toHaveProperty('attachment');
  });

  it('documents a cable exercise with a rope: its gym, grip, attachment, weight type, pulley position and setup', async () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);
    startExercise('Triceps Pushdown', 'triceps', 'cable');

    expect(shownSetupFields()).toEqual(SETUP_FIELDS);
    expect(screen.queryByTestId('exercise-form-more')).toBeNull();

    fireEvent.changeText(screen.getByTestId('exercise-form-gym'), ' Downtown ');
    fireEvent.press(screen.getByTestId('exercise-form-grip-choices-Neutral grip'));
    fireEvent.press(screen.getByTestId('exercise-form-attachment-choices-Rope'));
    fireEvent.press(screen.getByTestId('exercise-form-load-type-single_stack'));
    fireEvent.press(screen.getByTestId('exercise-form-pulley-position-high'));
    fireEvent.changeText(screen.getByTestId('exercise-form-setup-details'), ' Pin at 12 ');
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockCreateExercise).toHaveBeenCalledWith('token-123', {
        name: 'Triceps Pushdown',
        muscleGroup: 'triceps',
        secondaryMuscleGroups: [],
        movementType: 'bilateral',
        measurementType: 'weight_reps',
        equipment: 'cable',
        gym: 'Downtown',
        grip: 'Neutral grip',
        attachment: 'Rope',
        loadType: 'single_stack',
        pulleyPosition: 'high',
        setupDetails: 'Pin at 12',
      }),
    );
  });

  it('documents a cable row with a V-handle, held close, from a low pulley', async () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);
    startExercise('Seated Cable Row', 'back', 'cable');

    fireEvent.press(screen.getByTestId('exercise-form-grip-choices-Close grip'));
    fireEvent.press(screen.getByTestId('exercise-form-attachment-choices-V-handle'));
    fireEvent.press(screen.getByTestId('exercise-form-pulley-position-low'));
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockCreateExercise).toHaveBeenCalledWith(
        'token-123',
        expect.objectContaining({
          grip: 'Close grip',
          attachment: 'V-handle',
          pulleyPosition: 'low',
        }),
      ),
    );
  });

  it('documents a machine: weight type and setup lines started with a tap, no pulley', async () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);
    startExercise('Chest Press', 'chest', 'machine');

    expect(shownSetupFields()).toEqual([
      'exercise-form-gym',
      'exercise-form-grip',
      'exercise-form-load-type',
      'exercise-form-setup-details',
    ]);
    // The handles are the machine's own: an attachment only when asked for.
    expect(screen.getByTestId('exercise-form-more-hint')).toHaveTextContent(
      'Add a attachment, if it matters.',
    );

    fireEvent.press(screen.getByTestId('exercise-form-load-type-plate_loaded'));
    fireEvent.press(screen.getByTestId('exercise-form-setup-prompts-Seat height'));
    expect(screen.getByTestId('exercise-form-setup-details').props.value).toBe('Seat height: ');
    fireEvent.changeText(screen.getByTestId('exercise-form-setup-details'), 'Seat height: 4');
    fireEvent.press(screen.getByTestId('exercise-form-setup-prompts-Backrest'));
    expect(screen.getByTestId('exercise-form-setup-details').props.value).toBe(
      'Seat height: 4\nBackrest: ',
    );
    // A line already there isn't started twice.
    fireEvent.press(screen.getByTestId('exercise-form-setup-prompts-Seat height'));
    fireEvent.changeText(
      screen.getByTestId('exercise-form-setup-details'),
      'Seat height: 4\nBackrest: 2',
    );
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockCreateExercise).toHaveBeenCalledWith(
        'token-123',
        expect.objectContaining({
          equipment: 'machine',
          loadType: 'plate_loaded',
          setupDetails: 'Seat height: 4\nBackrest: 2',
        }),
      ),
    );
    expect(mockCreateExercise.mock.calls[0][1]).not.toHaveProperty('pulleyPosition');
  });

  it('asks where the cable starts only on a cable exercise -- and never heavier or lighter', () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);
    startExercise('Fly', 'chest');

    for (const equipment of [
      'dumbbell',
      'barbell',
      'kettlebell',
      'machine',
      'bodyweight',
      'other',
    ]) {
      fireEvent.press(screen.getByTestId(`exercise-form-equipment-${equipment}`));
      if (screen.queryByTestId('exercise-form-more')) {
        fireEvent.press(screen.getByTestId('exercise-form-more'));
      }
      expect(screen.queryByTestId('exercise-form-pulley-position')).toBeNull();
    }
    fireEvent.press(screen.getByTestId('exercise-form-equipment-cable'));
    expect(screen.getByTestId('exercise-form-pulley-position')).toBeTruthy();
    expect(screen.getByText('Where the cable starts on the machine.')).toBeTruthy();
    for (const label of ['High', 'Mid', 'Low', 'Adjustable', 'Other / Unknown']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.queryByText('Heavier')).toBeNull();
    expect(screen.queryByText('Lighter')).toBeNull();
  });

  it('asks no weight type of an exercise with no weight', () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);
    startExercise('Plank Hold', 'core', 'machine');
    expect(screen.getByTestId('exercise-form-load-type')).toBeTruthy();

    fireEvent.press(screen.getByTestId('exercise-form-measurement-timed'));

    expect(screen.queryByTestId('exercise-form-load-type')).toBeNull();
  });

  it('keeps grip and attachment apart -- how it is held, and what is held', () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);
    startExercise('Lat Pulldown', 'back', 'cable');

    expect(screen.getByText('Grip')).toBeTruthy();
    expect(screen.getByText(/How your hands hold it/)).toBeTruthy();
    expect(screen.getByTestId('exercise-form-grip-glossary')).toHaveTextContent(
      /Neutral: palms face each other\. Overhand: palms down\. Underhand: palms up\. Mixed: one of each\./,
    );
    expect(screen.getByText('Attachment / Handle')).toBeTruthy();
    expect(
      screen.getByText(
        /What you hold -- the bar or handle clipped on\. Your grip is how you hold it\./,
      ),
    ).toBeTruthy();
    for (const grip of [
      'Wide grip',
      'Close grip',
      'Neutral grip',
      'Overhand',
      'Underhand',
      'Mixed grip',
    ]) {
      expect(screen.getByTestId(`exercise-form-grip-choices-${grip}`)).toBeTruthy();
    }
    for (const handle of [
      'Straight bar',
      'EZ bar',
      'Rope',
      'D-handle',
      'V-handle',
      'Lat pulldown bar',
    ]) {
      expect(screen.getByTestId(`exercise-form-attachment-choices-${handle}`)).toBeTruthy();
    }

    // A tapped choice is chosen; tapped again, it's cleared; typed, it shows as chosen too.
    fireEvent.press(screen.getByTestId('exercise-form-grip-choices-Neutral grip'));
    expect(screen.getByTestId('exercise-form-grip').props.value).toBe('Neutral grip');
    fireEvent.press(screen.getByTestId('exercise-form-grip-choices-Neutral grip'));
    expect(screen.getByTestId('exercise-form-grip').props.value).toBe('');
    fireEvent.changeText(screen.getByTestId('exercise-form-attachment'), 'v-handle');
    expect(
      screen.getByTestId('exercise-form-attachment-choices-V-handle').props.accessibilityState
        .selected,
    ).toBe(true);
    // Anything else can be typed.
    fireEvent.changeText(
      screen.getByTestId('exercise-form-attachment'),
      'Single handle with strap',
    );
    expect(screen.getByTestId('exercise-form-attachment').props.value).toBe(
      'Single handle with strap',
    );
  });

  it('asks where the feet go for a leg exercise, with its own choices', () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);
    startExercise('Leg Press', 'quadriceps', 'machine');

    expect(screen.getByText('Foot Position')).toBeTruthy();
    expect(screen.getByText(/feet high works your glutes and hamstrings more/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('exercise-form-grip-choices-Feet high'));
    expect(screen.getByTestId('exercise-form-grip').props.value).toBe('Feet high');
  });

  it('says why the setup matters, at the top of the setup', () => {
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);

    const note = screen.getByTestId('exercise-form-setup-note');
    expect(note).toHaveTextContent(/Keep your setup consistent/);
    expect(note).toHaveTextContent(
      /Your equipment and setup directly affect how an exercise feels and how much you can lift\./,
    );
    expect(note).toHaveTextContent(
      /If you switch to equipment or a configuration that meaningfully changes the exercise, create a separate entry\./,
    );
    expect(note).toHaveTextContent(
      /These fields are optional, but the more accurately you describe your setup, the more meaningful your progress tracking becomes\./,
    );
    expect(screen.getByText('Your Setup (Optional)')).toBeTruthy();
    expect(screen.getByText('Equipment (Optional)')).toBeTruthy();
    expect(screen.getByText('The only thing you have to fill in.')).toBeTruthy();
    expect(screen.queryByText(/How It Feels/)).toBeNull();
  });

  it('says so before saving the very same setup a second time', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    alert.mockClear();
    mockFetchAllExercises.mockResolvedValue([
      {
        ...ownedExercise,
        id: 'ex-pushdown',
        name: 'Triceps Pushdown',
        muscleGroup: 'triceps',
        equipment: 'cable',
        attachment: 'Rope',
      },
    ]);
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);
    startExercise('triceps pushdown ', 'triceps', 'cable');
    fireEvent.press(screen.getByTestId('exercise-form-attachment-choices-Rope'));

    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(alert.mock.calls[0][0]).toBe('You already have this exercise');
    expect(mockCreateExercise).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((button) => button.text === 'Save Another')?.onPress?.();
    await waitFor(() => expect(mockCreateExercise).toHaveBeenCalled());
  });

  it('saves without asking when the setup differs -- another attachment is another exercise', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    alert.mockClear();
    mockFetchAllExercises.mockResolvedValue([
      {
        ...ownedExercise,
        name: 'Triceps Pushdown',
        equipment: 'cable',
        attachment: 'Rope',
      },
    ]);
    render(<ExerciseFormScreen mode="create" onDone={jest.fn()} onCancel={jest.fn()} />);
    startExercise('Triceps Pushdown', 'triceps', 'cable');
    fireEvent.press(screen.getByTestId('exercise-form-attachment-choices-V-handle'));

    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() => expect(mockCreateExercise).toHaveBeenCalled());
    expect(alert).not.toHaveBeenCalled();
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
        secondaryMuscleGroups: [],
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

  it('prefills the muscles it also works, and saves a change to them', async () => {
    render(
      <ExerciseFormScreen
        mode="edit"
        exercise={{ ...ownedExercise, secondaryMuscleGroups: ['forearms'] }}
        onDone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(
      screen.getByTestId('exercise-form-secondary-muscles-forearms').props.accessibilityState,
    ).toMatchObject({ selected: true });

    fireEvent.press(screen.getByTestId('exercise-form-secondary-muscles-shoulders'));
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockUpdateExercise).toHaveBeenCalledWith(
        'token-123',
        ownedExercise.id,
        expect.objectContaining({ secondaryMuscleGroups: ['shoulders', 'forearms'] }),
      ),
    );
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
        secondaryMuscleGroups: [],
        movementType: 'bilateral',
        measurementType: 'weight_reps',
        isActive: true,
        equipment: null,
        gym: null,
        grip: null,
        attachment: null,
        loadType: null,
        pulleyPosition: null,
        setupDetails: null,
      }),
    );
    // A rename isn't a new setup: nothing asked.
    expect(mockCountLoggedWorkouts).not.toHaveBeenCalled();
    expect(mockInvalidateExerciseCache).toHaveBeenCalledWith('user-1');
    expect(onDone).toHaveBeenCalled();
  });

  const cableRow = {
    ...ownedExercise,
    name: 'Seated Cable Row',
    muscleGroup: 'back' as const,
    equipment: 'cable' as const,
    grip: 'Wide grip',
    attachment: 'Straight bar',
    pulleyPosition: 'low' as const,
    setupDetails: 'Seat: 3',
    pulley: 'heavier' as const,
  };

  it('shows every saved detail, whatever the equipment, and never sends an old pulley back', async () => {
    render(
      <ExerciseFormScreen
        mode="edit"
        exercise={{ ...cableRow, equipment: 'dumbbell' }}
        onDone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    // A dumbbell wouldn't ask these, but they have values: nothing saved is out of sight.
    expect(screen.getByTestId('exercise-form-attachment').props.value).toBe('Straight bar');
    expect(screen.getByTestId('exercise-form-pulley-position')).toBeTruthy();
    expect(screen.getByTestId('exercise-form-setup-details').props.value).toBe('Seat: 3');

    fireEvent.changeText(screen.getByTestId('exercise-form-setup-details'), 'Seat: 4');
    fireEvent.press(screen.getByTestId('exercise-form-save'));
    await waitFor(() => expect(mockUpdateExercise).toHaveBeenCalled());
    expect(mockUpdateExercise.mock.calls[0][2]).not.toHaveProperty('pulley');
  });

  it('changes setup notes without asking: a seat moved a notch is the same exercise', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    alert.mockClear();
    mockCountLoggedWorkouts.mockResolvedValue(12);
    render(
      <ExerciseFormScreen
        mode="edit"
        exercise={cableRow}
        onDone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    fireEvent.changeText(screen.getByTestId('exercise-form-setup-details'), 'Seat: 4');
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockUpdateExercise).toHaveBeenCalledWith(
        'token-123',
        'ex-mine',
        expect.objectContaining({ setupDetails: 'Seat: 4' }),
      ),
    );
    expect(alert).not.toHaveBeenCalled();
  });

  it('asks before changing the setup of an exercise with history -- and can save it as a new one instead', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    alert.mockClear();
    mockCountLoggedWorkouts.mockResolvedValue(12);
    const onDone = jest.fn();
    render(
      <ExerciseFormScreen
        mode="edit"
        exercise={{ ...cableRow, photoUrl: 'https://example.com/row.jpg' }}
        onDone={onDone}
        onCancel={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('exercise-form-attachment-choices-V-handle'));
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(mockCountLoggedWorkouts).toHaveBeenCalledWith('user-1', 'ex-mine');
    expect(alert.mock.calls[0][0]).toBe('Change the setup?');
    expect(alert.mock.calls[0][1]).toMatch(/Seated Cable Row has 12 logged workouts/);
    expect(mockUpdateExercise).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    expect(buttons.map((button) => button.text)).toEqual([
      'Cancel',
      'Change This One',
      'Save as New Exercise',
    ]);
    buttons.find((button) => button.text === 'Save as New Exercise')?.onPress?.();

    // The old one -- and its history -- stays as it was; the new setup is its own exercise.
    await waitFor(() =>
      expect(mockCreateExercise).toHaveBeenCalledWith(
        'token-123',
        expect.objectContaining({
          name: 'Seated Cable Row',
          attachment: 'V-handle',
          grip: 'Wide grip',
          // Same machine, another handle: it keeps the photo.
          photoUrl: 'https://example.com/row.jpg',
        }),
      ),
    );
    expect(mockUpdateExercise).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it('changes the setup of the same exercise when the person says so', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    alert.mockClear();
    mockCountLoggedWorkouts.mockResolvedValue(3);
    render(
      <ExerciseFormScreen
        mode="edit"
        exercise={cableRow}
        onDone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('exercise-form-pulley-position-high'));
    fireEvent.press(screen.getByTestId('exercise-form-save'));
    await waitFor(() => expect(alert).toHaveBeenCalled());
    (alert.mock.calls[0][2] as { text: string; onPress?: () => void }[])
      .find((button) => button.text === 'Change This One')
      ?.onPress?.();

    await waitFor(() =>
      expect(mockUpdateExercise).toHaveBeenCalledWith(
        'token-123',
        'ex-mine',
        expect.objectContaining({ pulleyPosition: 'high' }),
      ),
    );
    expect(mockCreateExercise).not.toHaveBeenCalled();
  });

  it('changes the setup of an exercise with no history without asking', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    alert.mockClear();
    render(
      <ExerciseFormScreen
        mode="edit"
        exercise={cableRow}
        onDone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('exercise-form-equipment-machine'));
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    await waitFor(() =>
      expect(mockUpdateExercise).toHaveBeenCalledWith(
        'token-123',
        'ex-mine',
        expect.objectContaining({ equipment: 'machine' }),
      ),
    );
    expect(alert).not.toHaveBeenCalled();
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
