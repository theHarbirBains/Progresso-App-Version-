import { fireEvent, render, screen } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { updateMyProfile } from '../lib/api';
import { removeAvatarFile, uploadAvatar } from '../lib/avatarUpload';
import { ProfileProvider } from '../profile/ProfileProvider';
import { SettingsPersonalInfoScreen } from './SettingsPersonalInfoScreen';
import { fetchMyProfile } from '../profile/profileQueries';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  updateMyProfile: jest.fn(),
}));

jest.mock('../profile/profileQueries', () => ({
  fetchMyProfile: jest.fn(),
}));

jest.mock('../lib/avatarUpload', () => ({
  uploadAvatar: jest.fn(),
  removeAvatarFile: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchMyProfile = fetchMyProfile as jest.Mock;
const mockUpdateMyProfile = updateMyProfile as jest.Mock;
const mockUploadAvatar = uploadAvatar as jest.Mock;
const mockRemoveAvatarFile = removeAvatarFile as jest.Mock;

const baseProfile = {
  id: 'user-1',
  email: 'athlete@example.com',
  role: 'user',
  displayName: 'Athlete',
  lastName: 'One',
  username: 'athlete1',
  country: 'CA',
  phoneNumber: '+16045551234',
  weightUnit: 'kg' as const,
  heightUnit: 'cm' as const,
  avatarUrl: null as string | null,
  workoutAccentColor: null as string | null,
  nutritionAccentColor: null as string | null,
};

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: mockNavigate, goBack: mockGoBack };

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1', email: 'athlete@example.com' },
    session: { access_token: 'token-123' },
  });
  mockFetchMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockUpdateMyProfile.mockReset();
  mockUploadAvatar.mockReset().mockResolvedValue('https://example.test/avatar.jpg');
  mockRemoveAvatarFile.mockReset().mockResolvedValue(undefined);
  mockNavigate.mockClear();
  mockGoBack.mockClear();
});

function renderScreen() {
  return render(
    <ProfileProvider>
      <SettingsPersonalInfoScreen navigation={navigation} route={{} as never} />
    </ProfileProvider>,
  );
}

describe('SettingsPersonalInfoScreen', () => {
  it('goes back when the header back button is pressed', async () => {
    renderScreen();
    await screen.findByTestId('account-display-name');

    fireEvent.press(screen.getByTestId('app-header-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('loads and displays the profile', async () => {
    renderScreen();

    expect(await screen.findByTestId('account-display-name')).toHaveProp('value', 'Athlete');
    expect(screen.getByTestId('account-username')).toHaveProp('value', 'athlete1');
  });

  it('lowercases username input as the user types', async () => {
    renderScreen();
    await screen.findByTestId('account-display-name');

    fireEvent.changeText(screen.getByTestId('account-username'), 'NewHandle');

    expect(screen.getByTestId('account-username')).toHaveProp('value', 'newhandle');
  });

  it('saves display name, username, and both measurement units together', async () => {
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, displayName: 'New Name' });
    renderScreen();
    await screen.findByTestId('account-display-name');

    fireEvent.changeText(screen.getByTestId('account-display-name'), 'New Name');
    fireEvent.press(screen.getByTestId('account-unit-lb'));
    fireEvent.press(screen.getByTestId('account-height-unit-ft_in'));
    fireEvent.press(screen.getByTestId('account-save'));

    expect(await screen.findByTestId('account-saved')).toBeTruthy();
    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      displayName: 'New Name',
      lastName: 'One',
      phoneNumber: '+16045551234',
      username: 'athlete1',
      bio: null,
      weightUnit: 'lb',
      heightUnit: 'ft_in',
    });
  });

  it('asks for First Name and Last Name, and saves a last name added later', async () => {
    mockFetchMyProfile.mockResolvedValue({ ...baseProfile, lastName: null });
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, lastName: 'Bains' });
    renderScreen();

    expect(await screen.findByTestId('account-display-name')).toHaveProp('value', 'Athlete');
    expect(screen.getByTestId('account-display-name').props.accessibilityLabel).toBe('First Name');
    expect(screen.getByTestId('account-last-name')).toHaveProp('value', '');

    // Both are needed, as at sign-up.
    fireEvent.press(screen.getByTestId('account-save'));
    expect(await screen.findByTestId('account-save-error')).toHaveTextContent(
      'Add your last name.',
    );
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('account-last-name'), '  Bains ');
    fireEvent.press(screen.getByTestId('account-save'));

    expect(await screen.findByTestId('account-saved')).toBeTruthy();
    expect(mockUpdateMyProfile).toHaveBeenCalledWith(
      'token-123',
      expect.objectContaining({ displayName: 'Athlete', lastName: 'Bains' }),
    );
    expect(screen.getByTestId('account-last-name')).toHaveProp('value', 'Bains');
  });

  it('shows their phone number as it reads at home, and needs a real one to save', async () => {
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, phoneNumber: '+16045559876' });
    renderScreen();

    expect(await screen.findByTestId('account-phone')).toHaveProp('value', '(604) 555-1234');

    fireEvent.changeText(screen.getByTestId('account-phone'), '555 12');
    fireEvent.press(screen.getByTestId('account-save'));
    expect(await screen.findByTestId('account-save-error')).toHaveTextContent(
      'Enter a valid phone number.',
    );
    fireEvent.changeText(screen.getByTestId('account-phone'), '');
    fireEvent.press(screen.getByTestId('account-save'));
    expect(await screen.findByTestId('account-save-error')).toHaveTextContent(
      'Add your phone number.',
    );
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('account-phone'), '604-555-9876');
    fireEvent.press(screen.getByTestId('account-save'));

    expect(await screen.findByTestId('account-saved')).toBeTruthy();
    expect(mockUpdateMyProfile).toHaveBeenCalledWith(
      'token-123',
      expect.objectContaining({ phoneNumber: '+16045559876' }),
    );
    expect(screen.getByTestId('account-phone')).toHaveProp('value', '(604) 555-9876');
  });

  it('saves a bio for their profile, trimmed, 80 characters at most', async () => {
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, bio: 'Chasing progress.' });
    renderScreen();
    await screen.findByTestId('account-display-name');

    expect(screen.getByTestId('account-bio')).toHaveProp('maxLength', 80);
    fireEvent.changeText(screen.getByTestId('account-bio'), '  Chasing progress.  ');
    fireEvent.press(screen.getByTestId('account-save'));

    expect(await screen.findByTestId('account-saved')).toBeTruthy();
    expect(mockUpdateMyProfile).toHaveBeenCalledWith(
      'token-123',
      expect.objectContaining({ bio: 'Chasing progress.' }),
    );
    expect(screen.getByTestId('account-bio')).toHaveProp('value', 'Chasing progress.');
  });

  it('shows a save error and does not show the saved confirmation on failure', async () => {
    mockUpdateMyProfile.mockRejectedValue(new Error('Username is already taken'));
    renderScreen();
    await screen.findByTestId('account-display-name');

    fireEvent.press(screen.getByTestId('account-save'));

    expect(await screen.findByTestId('account-save-error')).toHaveTextContent(
      'Username is already taken',
    );
    expect(screen.queryByTestId('account-saved')).toBeNull();
  });

  it('opens the "Choose Photo"/"Remove Photo" sheet when the avatar is tapped', async () => {
    renderScreen();
    await screen.findByTestId('account-display-name');

    fireEvent.press(screen.getByTestId('settings-personal-info-avatar'));

    expect(screen.getByTestId('settings-personal-info-choose-photo')).toBeTruthy();
    // No existing photo yet -- nothing to remove.
    expect(screen.queryByTestId('settings-personal-info-remove-photo')).toBeNull();
  });

  it('uploads and saves a newly chosen photo', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///chosen.jpg' }],
    });
    mockUpdateMyProfile.mockResolvedValue({
      ...baseProfile,
      avatarUrl: 'https://example.test/avatar.jpg',
    });
    renderScreen();
    await screen.findByTestId('account-display-name');

    fireEvent.press(screen.getByTestId('settings-personal-info-avatar'));
    fireEvent.press(screen.getByTestId('settings-personal-info-choose-photo'));

    await screen.findByTestId('account-display-name');
    expect(mockUploadAvatar).toHaveBeenCalledWith('user-1', 'file:///chosen.jpg');
    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      avatarUrl: 'https://example.test/avatar.jpg',
    });
  });

  it('offers Remove Photo, and removes it, once a photo already exists', async () => {
    mockFetchMyProfile.mockResolvedValue({
      ...baseProfile,
      avatarUrl: 'https://example.test/existing.jpg',
    });
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, avatarUrl: null });
    renderScreen();
    await screen.findByTestId('account-display-name');

    fireEvent.press(screen.getByTestId('settings-personal-info-avatar'));
    expect(screen.getByTestId('settings-personal-info-remove-photo')).toBeTruthy();

    fireEvent.press(screen.getByTestId('settings-personal-info-remove-photo'));

    await screen.findByTestId('account-display-name');
    expect(mockRemoveAvatarFile).toHaveBeenCalledWith('user-1');
    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', { avatarUrl: null });
  });

  it('navigates to CalorieEstimation for body measurements, not a second copy of that form', async () => {
    renderScreen();
    await screen.findByTestId('account-display-name');

    fireEvent.press(screen.getByTestId('open-body-measurements'));

    expect(mockNavigate).toHaveBeenCalledWith('CalorieEstimation');
  });

  it('renders no bare text outside <Text>', async () => {
    renderScreen();
    await screen.findByTestId('account-display-name');
    expectNoBareText();
  });
});
