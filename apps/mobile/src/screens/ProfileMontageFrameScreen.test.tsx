import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { MontageItem } from '../lib/api';
import { framedRect, PICTURE_BOX_ASPECT } from '../profile/montage/montageFrame';
import { saveMontageFrame } from '../profile/montage/montageQueries';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { ProfileMontageFrameScreen } from './ProfileMontageFrameScreen';

jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../profile/montage/montageQueries', () => ({
  ...jest.requireActual('../profile/montage/montageQueries'),
  saveMontageFrame: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: jest.fn(), goBack: jest.fn() };

const photo = (extra: Partial<MontageItem> = {}): MontageItem => ({
  id: 'p1',
  kind: 'photo',
  url: 'https://cdn.test/p1.jpg?token=x',
  width: 1200,
  height: 1600,
  durationSeconds: null,
  ...extra,
});

function renderScreen(item: MontageItem) {
  render(
    <ProfileMontageFrameScreen navigation={navigation} route={{ params: { item } } as never} />,
  );
}

/** Lays the stage out `width` across, as the page would. */
function layOut(width = 360) {
  fireEvent(screen.getByTestId('profile-montage-frame-stage'), 'layout', {
    nativeEvent: { layout: { width, height: 0, x: 0, y: 0 } },
  });
}

const box = (width = 360) => ({ width: width * 0.72, height: (width * 0.72) / PICTURE_BOX_ASPECT });
const zoomIn = () =>
  fireEvent(screen.getByTestId('profile-montage-frame-stage'), 'accessibilityAction', {
    nativeEvent: { actionName: 'increment' },
  });

beforeEach(() => {
  jest.clearAllMocks();
  (saveMontageFrame as jest.Mock).mockResolvedValue(undefined);
});

describe('ProfileMontageFrameScreen', () => {
  it('shows the photo in its panel, large, where it was placed', () => {
    const frame = { x: 0.4, y: 0.3, zoom: 1.5 };
    renderScreen(photo({ frame }));
    layOut();

    expect(screen.getByTestId('profile-montage-frame-photo').props.style).toEqual(
      expect.objectContaining(framedRect(box(), { width: 1200, height: 1600 }, frame)),
    );
    expect(screen.getByTestId('profile-montage-frame-stage')).toHaveProp(
      'accessibilityRole',
      'adjustable',
    );
    expectNoBareText();
  });

  it('saves where it was moved and zoomed to, and goes back', async () => {
    renderScreen(photo());
    layOut();
    zoomIn();
    fireEvent(screen.getByTestId('profile-montage-frame-stage'), 'accessibilityAction', {
      nativeEvent: { actionName: 'moveLeft' },
    });

    fireEvent.press(screen.getByTestId('profile-montage-frame-save'));
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    const [id, saved] = (saveMontageFrame as jest.Mock).mock.calls[0];
    expect(id).toBe('p1');
    expect(saved.zoom).toBe(1.25);
    // Moved left, the photo's middle is further right than it started.
    expect(saved.x).toBeGreaterThan(0.5);
  });

  it('goes back to the automatic framing with Use Automatic', async () => {
    renderScreen(photo({ frame: { x: 0.1, y: 0.1, zoom: 3 } }));
    layOut();

    fireEvent.press(screen.getByTestId('profile-montage-frame-reset'));
    expect(screen.queryByTestId('profile-montage-frame-reset')).toBeNull();
    fireEvent.press(screen.getByTestId('profile-montage-frame-save'));
    await waitFor(() => expect(saveMontageFrame).toHaveBeenCalledWith('p1', null));
  });

  it('says so when it does not save, and stays', async () => {
    (saveMontageFrame as jest.Mock).mockRejectedValue(new Error('Network down'));
    renderScreen(photo());
    layOut();
    zoomIn();

    await act(async () => {
      fireEvent.press(screen.getByTestId('profile-montage-frame-save'));
    });
    expect(screen.getByTestId('profile-montage-frame-error')).toHaveTextContent('Network down');
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it("can't adjust a photo whose size isn't known", () => {
    renderScreen(photo({ width: null, height: null }));
    expect(screen.getByTestId('profile-montage-frame-unknown')).toBeTruthy();
    expect(screen.queryByTestId('profile-montage-frame-save')).toBeNull();
  });
});
