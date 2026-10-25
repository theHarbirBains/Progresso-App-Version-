import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { addFeedbackNote, fetchFeedbackReview, updateFeedbackStatus } from '../lib/feedbackApi';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { AdminFeedbackReviewScreen } from './AdminFeedbackReviewScreen';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../lib/feedbackApi', () => ({
  fetchFeedbackReview: jest.fn(),
  updateFeedbackStatus: jest.fn(),
  addFeedbackNote: jest.fn(),
}));

const mockFetch = fetchFeedbackReview as jest.Mock;
const mockUpdate = updateFeedbackStatus as jest.Mock;
const mockAddNote = addFeedbackNote as jest.Mock;
const navigation = { goBack: jest.fn(), addListener: jest.fn(() => jest.fn()) };
const route = { params: { id: 'fb-1' } };

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
const review = {
  ...item,
  screenshotUrl: 'https://signed/a.jpg',
  history: [
    { status: 'new' as const, at: '2026-10-25T12:00:00Z' },
    { status: 'planned' as const, at: '2026-10-25T13:00:00Z' },
  ],
  notes: [
    {
      id: 'note-1',
      body: 'Repro on 18.1',
      createdAt: '2026-10-25T13:05:00Z',
      author: { id: 'admin-1', displayName: 'Support' },
    },
  ],
};

function renderScreen() {
  return render(
    <AdminFeedbackReviewScreen navigation={navigation as never} route={route as never} />,
  );
}

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ session: { access_token: 'token-1' } });
  mockFetch.mockReset().mockResolvedValue(review);
  mockUpdate.mockReset();
  mockAddNote.mockReset();
});

describe('AdminFeedbackReviewScreen', () => {
  it('shows what was sent and by whom, its screenshot, history and internal notes', async () => {
    renderScreen();

    expect(await screen.findByTestId('admin-feedback-review-description')).toHaveTextContent(
      'Swiping left went two days ahead.',
    );
    expect(screen.getByTestId('admin-feedback-review-summary')).toHaveTextContent(/Harbir/);
    expect(screen.getByTestId('admin-feedback-review-screenshot').props.source).toEqual({
      uri: 'https://signed/a.jpg',
    });
    expect(screen.getByTestId('admin-feedback-review-sent-from')).toHaveTextContent(/iOS 18.1/);
    expect(screen.getByTestId('admin-feedback-history-0')).toHaveTextContent(/^Planned/);
    expect(screen.getByTestId('admin-feedback-note-note-1')).toHaveTextContent(
      /Support.*Repro on 18.1/,
    );
    expect(mockFetch).toHaveBeenCalledWith('token-1', 'fb-1');
    expectNoBareText();
  });

  it('changes the status from the sheet of six', async () => {
    mockUpdate.mockResolvedValue({ ...review, status: 'in_progress' });
    renderScreen();
    await screen.findByTestId('admin-feedback-review-description');

    fireEvent.press(screen.getByTestId('admin-feedback-change-status'));
    expect(screen.getByTestId('admin-feedback-status-planned').props.accessibilityLabel).toBe(
      'Planned, current',
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('admin-feedback-status-in_progress'));
    });

    expect(mockUpdate).toHaveBeenCalledWith('token-1', 'fb-1', 'in_progress');
    expect(screen.getByTestId('admin-feedback-review-status')).toHaveTextContent('In Progress');
  });

  it("doesn't send a status it already has", async () => {
    renderScreen();
    await screen.findByTestId('admin-feedback-review-description');

    fireEvent.press(screen.getByTestId('admin-feedback-change-status'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('admin-feedback-status-planned'));
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('adds an internal note, and clears the field', async () => {
    mockAddNote.mockResolvedValue({
      ...review,
      notes: [
        ...review.notes,
        {
          id: 'note-2',
          body: 'Asked for a video',
          createdAt: '2026-10-25T14:00:00Z',
          author: null,
        },
      ],
    });
    renderScreen();
    await screen.findByTestId('admin-feedback-review-description');

    expect(screen.getByTestId('admin-feedback-note-add').props.accessibilityState.disabled).toBe(
      true,
    );
    fireEvent.changeText(screen.getByTestId('admin-feedback-note-input'), '  Asked for a video ');
    await act(async () => {
      fireEvent.press(screen.getByTestId('admin-feedback-note-add'));
    });

    expect(mockAddNote).toHaveBeenCalledWith('token-1', 'fb-1', 'Asked for a video');
    expect(screen.getByTestId('admin-feedback-note-note-2')).toHaveTextContent(
      /An admin.*Asked for a video/,
    );
    expect(screen.getByTestId('admin-feedback-note-input')).toHaveProp('value', '');
  });

  it('says when a change could not be made, and keeps what was there', async () => {
    mockUpdate.mockRejectedValue(new Error('Failed to change the status'));
    renderScreen();
    await screen.findByTestId('admin-feedback-review-description');

    fireEvent.press(screen.getByTestId('admin-feedback-change-status'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('admin-feedback-status-completed'));
    });

    expect(screen.getByTestId('admin-feedback-review-action-error')).toHaveTextContent(
      /could not|Failed/,
    );
    expect(screen.getByTestId('admin-feedback-review-status')).toHaveTextContent('Planned');
  });

  it('shows a read error with a retry', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Feedback not found')).mockResolvedValue(review);
    renderScreen();

    expect(await screen.findByTestId('admin-feedback-review-error')).toHaveTextContent(/not found/);
    fireEvent.press(screen.getByTestId('admin-feedback-review-error-retry'));
    expect(await screen.findByTestId('admin-feedback-review-description')).toBeTruthy();
  });
});
