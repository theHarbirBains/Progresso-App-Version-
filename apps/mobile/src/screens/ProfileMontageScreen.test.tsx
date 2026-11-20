import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth/AuthProvider';
import {
  addToMontage,
  fetchOwnMontage,
  removeFromMontage,
  reorderMontage,
  type OwnMontageItem,
} from '../profile/montage/montageQueries';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { ProfileMontageScreen } from './ProfileMontageScreen';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../profile/montage/montageQueries', () => ({
  ...jest.requireActual('../profile/montage/montageQueries'),
  fetchOwnMontage: jest.fn(),
  addToMontage: jest.fn(),
  reorderMontage: jest.fn(),
  removeFromMontage: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};

const item = (id: string, kind: 'photo' | 'video', extra: Partial<OwnMontageItem> = {}) => ({
  id,
  kind,
  url: `https://cdn.test/${id}`,
  width: 100,
  height: 100,
  durationSeconds: kind === 'video' ? 12 : null,
  path: `me/${id}`,
  ...extra,
});

function renderScreen() {
  return render(<ProfileMontageScreen navigation={navigation} route={{} as never} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'me' } });
  (fetchOwnMontage as jest.Mock).mockResolvedValue([item('a', 'photo'), item('b', 'video')]);
  (addToMontage as jest.Mock).mockResolvedValue(undefined);
  (reorderMontage as jest.Mock).mockResolvedValue(undefined);
  (removeFromMontage as jest.Mock).mockResolvedValue(undefined);
});

describe('ProfileMontageScreen', () => {
  it('shows your montage as your profile does, then each in its place', async () => {
    renderScreen();

    expect(await screen.findByTestId('profile-montage-preview')).toBeTruthy();
    expect(screen.getByTestId('profile-montage-item-0')).toHaveTextContent(/^1\. Photo/);
    expect(screen.getByTestId('profile-montage-item-1')).toHaveTextContent(/2\. Video0:12/);
    expect(screen.getByTestId('profile-montage-hint')).toHaveTextContent(/^2 of 4\./);
    expect(screen.getByTestId('profile-montage-add')).toHaveTextContent(/Add Photos or Videos$/);
    expectNoBareText();
  });

  it('opens a photo to adjust it within its panel; a video has nothing to adjust', async () => {
    renderScreen();

    fireEvent.press(await screen.findByTestId('profile-montage-item-0'));
    expect(screen.getByTestId('profile-montage-item-0')).toHaveTextContent(/Tap to adjust/);
    expect(navigation.navigate).toHaveBeenCalledWith('ProfileMontageFrame', {
      item: expect.objectContaining({ id: 'a', kind: 'photo' }),
    });
    navigation.navigate.mockClear();
    fireEvent.press(screen.getByTestId('profile-montage-item-1'));
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('plays your montage full screen from its preview', async () => {
    renderScreen();

    fireEvent.press(await screen.findByTestId('profile-montage-preview'));
    expect(await screen.findByTestId('profile-montage-viewer')).toBeTruthy();
    fireEvent.press(screen.getByTestId('profile-montage-viewer-close'));
    expect(screen.queryByTestId('profile-montage-viewer')).toBeNull();
  });

  it('adds what you pick -- no more than there is room for -- and reads it again', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [
        { uri: 'file:///1.jpg', type: 'image', width: 10, height: 10 },
        { uri: 'file:///2.mp4', type: 'video', width: 10, height: 10, duration: 5000 },
      ],
    });
    renderScreen();

    fireEvent.press(await screen.findByTestId('profile-montage-add'));

    await waitFor(() => expect(addToMontage).toHaveBeenCalledTimes(2));
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        selectionLimit: 2,
        videoExportPreset: 6,
      }),
    );
    expect(addToMontage).toHaveBeenCalledWith(
      'me',
      expect.objectContaining({ uri: 'file:///1.jpg' }),
    );
    await waitFor(() => expect(fetchOwnMontage).toHaveBeenCalledTimes(2));
  });

  it('says why a video too long to add was left out', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///long.mov', type: 'video', width: 10, height: 10, duration: 95_000 }],
    });
    renderScreen();

    fireEvent.press(await screen.findByTestId('profile-montage-add'));

    expect(await screen.findByTestId('profile-montage-notice')).toHaveTextContent(
      'Videos can be up to a minute long.',
    );
    expect(addToMontage).not.toHaveBeenCalled();
  });

  it('takes no more once it holds four', async () => {
    (fetchOwnMontage as jest.Mock).mockResolvedValue(
      ['a', 'b', 'c', 'd'].map((id) => item(id, 'photo')),
    );
    renderScreen();

    const add = await screen.findByTestId('profile-montage-add');
    expect(add).toHaveTextContent('Montage Full');
    fireEvent.press(add);
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('moves one later, saving the new order', async () => {
    renderScreen();

    fireEvent.press(await screen.findByTestId('profile-montage-later-0'));

    expect(reorderMontage).toHaveBeenCalledWith(['b', 'a']);
    expect(screen.getByTestId('profile-montage-item-0')).toHaveTextContent(/1\. Video/);
  });

  it('asks before removing one, then removes it', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    renderScreen();

    fireEvent.press(await screen.findByTestId('profile-montage-remove-1'));
    expect(alert).toHaveBeenCalledWith('Remove this video?', expect.any(String), expect.any(Array));
    const buttons = alert.mock.calls[0]![2]!;
    await act(async () => buttons.find((button) => button.text === 'Remove')!.onPress!());

    expect(removeFromMontage).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
    alert.mockRestore();
  });

  it('starts empty with a word on what it is', async () => {
    (fetchOwnMontage as jest.Mock).mockResolvedValue([]);
    renderScreen();

    expect(await screen.findByTestId('profile-montage-empty')).toBeTruthy();
    expect(screen.queryByTestId('profile-montage-preview')).toBeNull();
  });

  it('says so when it cannot be read', async () => {
    (fetchOwnMontage as jest.Mock).mockRejectedValue(new Error('offline'));
    renderScreen();

    expect(await screen.findByTestId('profile-montage-error')).toBeTruthy();
  });
});
