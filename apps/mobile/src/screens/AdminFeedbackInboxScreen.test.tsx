import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { fetchFeedbackInbox } from '../lib/feedbackApi';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { AdminFeedbackInboxScreen } from './AdminFeedbackInboxScreen';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../lib/feedbackApi', () => ({ fetchFeedbackInbox: jest.fn() }));

const mockFetch = fetchFeedbackInbox as jest.Mock;
const listeners: Record<string, () => void> = {};
const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  addListener: jest.fn((event: string, cb: () => void) => {
    listeners[event] = cb;
    return jest.fn();
  }),
};

const item = {
  ...{
    id: 'fb-1',
    userId: 'user-1',
    category: 'bug' as const,
    title: 'Swipe skips a day',
    description: 'Swiping left went two days ahead.',
    screenshotPath: null,
    appVersion: '1.4.0',
    buildNumber: '31',
    platform: 'ios',
    osVersion: '18.1',
    status: 'planned' as const,
    statusChangedAt: '2026-10-25T13:00:00Z',
    createdAt: '2026-10-25T12:00:00Z',
  },
  sender: { id: 'user-1', displayName: 'Harbir', username: 'harbir' },
};
const counts = { new: 4, reviewing: 1, planned: 2, in_progress: 0, completed: 3, declined: 1 };

function renderScreen() {
  return render(<AdminFeedbackInboxScreen navigation={navigation as never} route={{} as never} />);
}

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ session: { access_token: 'token-1' } });
  mockFetch.mockReset().mockResolvedValue({ items: [item], counts, nextBefore: null });
  navigation.navigate.mockClear();
});

describe('AdminFeedbackInboxScreen', () => {
  it('lists everything sent -- who, what kind, its status -- with each status counted', async () => {
    renderScreen();

    const row = await screen.findByTestId('admin-feedback-item-fb-1');
    expect(row).toHaveTextContent(/Swipe skips a day/);
    expect(row).toHaveTextContent(/Bug · Harbir · /);
    expect(row).toHaveTextContent(/Planned/);
    expect(screen.getByTestId('admin-feedback-status-all')).toHaveTextContent('All · 11');
    expect(screen.getByTestId('admin-feedback-status-new')).toHaveTextContent('New · 4');
    expect(mockFetch).toHaveBeenCalledWith('token-1', {});
    fireEvent.press(row);
    expect(navigation.navigate).toHaveBeenCalledWith('AdminFeedbackReview', { id: 'fb-1' });
    expectNoBareText();
  });

  it('filters by status and kind, and searches the words', async () => {
    renderScreen();
    await screen.findByTestId('admin-feedback-item-fb-1');

    fireEvent.press(screen.getByTestId('admin-feedback-status-new'));
    await waitFor(() => expect(mockFetch).toHaveBeenLastCalledWith('token-1', { status: 'new' }));
    fireEvent.press(screen.getByTestId('admin-feedback-category-feature'));
    await waitFor(() =>
      expect(mockFetch).toHaveBeenLastCalledWith('token-1', { status: 'new', category: 'feature' }),
    );
    fireEvent.changeText(screen.getByTestId('admin-feedback-search'), '  swipe ');
    await waitFor(() =>
      expect(mockFetch).toHaveBeenLastCalledWith('token-1', {
        status: 'new',
        category: 'feature',
        q: 'swipe',
      }),
    );
  });

  it('reads further back with Load More', async () => {
    mockFetch
      .mockResolvedValueOnce({ items: [item], counts, nextBefore: '2026-10-25T12:00:00Z' })
      .mockResolvedValueOnce({
        items: [{ ...item, id: 'fb-2', title: 'Older one' }],
        counts,
        nextBefore: null,
      });
    renderScreen();
    await screen.findByTestId('admin-feedback-item-fb-1');

    await act(async () => {
      fireEvent.press(screen.getByTestId('admin-feedback-more'));
    });

    expect(mockFetch).toHaveBeenLastCalledWith('token-1', { before: '2026-10-25T12:00:00Z' });
    expect(screen.getByTestId('admin-feedback-item-fb-1')).toBeTruthy();
    expect(screen.getByTestId('admin-feedback-item-fb-2')).toBeTruthy();
    expect(screen.queryByTestId('admin-feedback-more')).toBeNull();
  });

  it('says why when it is refused or fails, with a retry', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Insufficient permissions'));
    renderScreen();

    expect(await screen.findByTestId('admin-feedback-error')).toHaveTextContent(
      /Insufficient permissions/,
    );
    fireEvent.press(screen.getByTestId('admin-feedback-error-retry'));
    expect(await screen.findByTestId('admin-feedback-item-fb-1')).toBeTruthy();
  });

  it('says when nothing matches', async () => {
    mockFetch.mockResolvedValue({ items: [], counts, nextBefore: null });
    renderScreen();

    expect(await screen.findByTestId('admin-feedback-empty')).toHaveTextContent('No feedback yet');
  });

  it('reads again when shown, so a status just changed shows', async () => {
    renderScreen();
    await screen.findByTestId('admin-feedback-item-fb-1');
    const calls = mockFetch.mock.calls.length;

    await act(async () => {
      listeners.focus?.();
    });

    expect(mockFetch.mock.calls.length).toBe(calls + 1);
  });
});
