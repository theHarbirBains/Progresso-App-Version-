import { fireEvent, render, screen } from '@testing-library/react-native';
import { fetchMyFeedbackDetail } from '../feedback/feedbackQueries';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { FeedbackDetailScreen } from './FeedbackDetailScreen';

jest.mock('../feedback/feedbackQueries', () => ({ fetchMyFeedbackDetail: jest.fn() }));

const mockFetch = fetchMyFeedbackDetail as jest.Mock;
const navigation = { goBack: jest.fn(), addListener: jest.fn(() => jest.fn()) };
const route = { params: { id: 'fb-1' } };

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
  return render(<FeedbackDetailScreen navigation={navigation as never} route={route as never} />);
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('FeedbackDetailScreen', () => {
  it('shows what was sent, its screenshot, its status and its history -- newest first, from Sent', async () => {
    mockFetch.mockResolvedValue({
      submission,
      screenshotUrl: 'https://signed/a.jpg',
      history: [
        { status: 'new', at: '2026-10-25T12:00:00Z' },
        { status: 'reviewing', at: '2026-10-25T12:30:00Z' },
        { status: 'planned', at: '2026-10-25T13:00:00Z' },
      ],
    });
    renderScreen();

    expect(await screen.findByTestId('feedback-detail-description')).toHaveTextContent(
      'Swiping left went two days ahead.',
    );
    expect(screen.getByTestId('feedback-detail-status')).toHaveTextContent('Planned');
    expect(screen.getByTestId('feedback-detail-screenshot').props.source).toEqual({
      uri: 'https://signed/a.jpg',
    });
    expect(screen.getByTestId('feedback-history-0')).toHaveTextContent(/^Planned/);
    expect(screen.getByTestId('feedback-history-2')).toHaveTextContent(/^Sent/);
    expect(screen.getByTestId('feedback-detail-sent-from')).toHaveTextContent(
      'Sent with Progresso 1.4.0 (31) · iOS 18.1.',
    );
    // Admins' notes are never part of it.
    expect(screen.queryByText(/Internal Notes/)).toBeNull();
    expectNoBareText();
  });

  it('shows a read error with a retry', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('This feedback could not be found'))
      .mockResolvedValue({ submission, screenshotUrl: null, history: [] });
    renderScreen();

    expect(await screen.findByTestId('feedback-detail-error')).toHaveTextContent(
      /could not be found/,
    );
    fireEvent.press(screen.getByTestId('feedback-detail-error-retry'));
    expect(await screen.findByTestId('feedback-detail-description')).toBeTruthy();
    expect(screen.queryByTestId('feedback-detail-screenshot')).toBeNull();
  });
});
