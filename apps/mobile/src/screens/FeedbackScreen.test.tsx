import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { fetchMyFeedback } from '../feedback/feedbackQueries';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { FeedbackScreen } from './FeedbackScreen';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../feedback/feedbackQueries', () => ({ fetchMyFeedback: jest.fn() }));

const mockFetch = fetchMyFeedback as jest.Mock;
const listeners: Record<string, () => void> = {};
const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  addListener: jest.fn((event: string, cb: () => void) => {
    listeners[event] = cb;
    return jest.fn();
  }),
};

const submission = {
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
};

function renderScreen() {
  return render(<FeedbackScreen navigation={navigation as never} route={{} as never} />);
}

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-1' } });
  mockFetch.mockReset();
  navigation.navigate.mockClear();
});

describe('FeedbackScreen', () => {
  it('lists what the person has sent, each with its status, opening its page', async () => {
    mockFetch.mockResolvedValue([submission]);
    renderScreen();

    const item = await screen.findByTestId('feedback-item-fb-1');
    expect(item).toHaveTextContent(/Swipe skips a day/);
    expect(item).toHaveTextContent(/Bug Report/);
    expect(item).toHaveTextContent(/Planned/);
    fireEvent.press(item);
    expect(navigation.navigate).toHaveBeenCalledWith('FeedbackDetail', { id: 'fb-1' });
    expectNoBareText();
  });

  it('says nothing has been sent yet, and still offers to send', async () => {
    mockFetch.mockResolvedValue([]);
    renderScreen();

    expect(await screen.findByTestId('feedback-empty')).toHaveTextContent(/Nothing sent yet/);
    fireEvent.press(screen.getByTestId('feedback-send'));
    expect(navigation.navigate).toHaveBeenCalledWith('FeedbackForm');
  });

  it('shows a read error with a retry that reads again', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([submission]);
    renderScreen();

    expect(await screen.findByTestId('feedback-error')).toHaveTextContent(/offline/);
    fireEvent.press(screen.getByTestId('feedback-error-retry'));
    expect(await screen.findByTestId('feedback-item-fb-1')).toBeTruthy();
  });

  it('reads again each time it is shown, so feedback just sent appears', async () => {
    mockFetch.mockResolvedValue([]);
    renderScreen();
    await screen.findByTestId('feedback-empty');

    mockFetch.mockResolvedValue([submission]);
    await act(async () => {
      listeners.focus?.();
    });

    expect(await screen.findByTestId('feedback-item-fb-1')).toBeTruthy();
  });
});
