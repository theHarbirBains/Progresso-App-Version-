import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { deleteComment, getWorkoutSocial, likeWorkout, postComment } from '../lib/api';
import { likedByLine, WorkoutComments } from './WorkoutComments';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../lib/api', () => ({
  getWorkoutSocial: jest.fn(),
  likeWorkout: jest.fn(),
  unlikeWorkout: jest.fn(),
  postComment: jest.fn(),
  deleteComment: jest.fn(),
  reportUser: jest.fn(),
  blockUser: jest.fn(),
}));

const me = { id: 'me', username: 'harbir', displayName: 'Harbir', avatarUrl: null };
const sam = { id: 'sam', username: 'sam', displayName: 'Sam Lee', avatarUrl: null };
const jo = { id: 'jo', username: 'jo', displayName: 'Jo', avatarUrl: null };

const social = {
  likeCount: 2,
  likedByMe: false,
  likers: [sam, jo],
  comments: [
    {
      id: 'c1',
      workoutId: 'w1',
      user: sam,
      body: 'Strong!',
      createdAt: '2026-11-10T10:00:00Z',
      canDelete: false,
    },
    {
      id: 'c2',
      workoutId: 'w1',
      user: me,
      body: 'Thanks',
      createdAt: '2026-11-10T11:00:00Z',
      canDelete: true,
    },
  ],
};

const onOpenPerson = jest.fn();

function renderComments() {
  return render(
    <WorkoutComments
      workoutId="w1"
      accentColor="#D99A50"
      onAccentColor="#000000"
      onOpenPerson={onOpenPerson}
    />,
  );
}

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'me' }, session: { access_token: 't' } });
  (getWorkoutSocial as jest.Mock).mockReset().mockResolvedValue(social);
  onOpenPerson.mockClear();
});

describe('likedByLine', () => {
  it('names one or two people, then counts the rest', () => {
    expect(likedByLine([], 0)).toBeNull();
    expect(likedByLine([sam], 1)).toBe('Liked by Sam Lee');
    expect(likedByLine([sam, jo], 2)).toBe('Liked by Sam Lee and Jo');
    expect(likedByLine([sam, jo], 4)).toBe('Liked by Sam Lee and 3 others');
  });
});

describe('WorkoutComments', () => {
  it('shows who liked it and the comments, oldest first', async () => {
    renderComments();

    expect(await screen.findByTestId('workout-comments-liked-by')).toHaveTextContent(
      'Liked by Sam Lee and Jo',
    );
    expect(screen.getByTestId('workout-comments-comment-c1-body')).toHaveTextContent('Strong!');
    expect(screen.getByTestId('workout-comments-comment-c2-body')).toHaveTextContent('Thanks');
  });

  it('likes it at a tap, showing it at once', async () => {
    (likeWorkout as jest.Mock).mockResolvedValue(null);
    renderComments();
    await screen.findByTestId('workout-comments-like');

    await act(async () => {
      fireEvent.press(screen.getByTestId('workout-comments-like'));
    });

    expect(likeWorkout).toHaveBeenCalledWith('t', 'w1');
    expect(getWorkoutSocial).toHaveBeenCalledTimes(2);
  });

  it('posts a comment and reads the comments again', async () => {
    (postComment as jest.Mock).mockResolvedValue({});
    renderComments();
    await screen.findByTestId('workout-comments-input');

    fireEvent.changeText(screen.getByTestId('workout-comments-input'), '  Great set!  ');
    await act(async () => {
      fireEvent.press(screen.getByTestId('workout-comments-send'));
    });

    expect(postComment).toHaveBeenCalledWith('t', 'w1', 'Great set!');
    expect(screen.getByTestId('workout-comments-input').props.value).toBe('');
  });

  it('deletes your own comment, and reports someone else’s', async () => {
    (deleteComment as jest.Mock).mockResolvedValue(null);
    const alert = jest.spyOn(Alert, 'alert');
    renderComments();
    await screen.findByTestId('workout-comments-comment-c2-more');

    alert.mockImplementationOnce((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Delete')?.onPress?.();
    });
    fireEvent.press(screen.getByTestId('workout-comments-comment-c2-more'));
    await waitFor(() => expect(deleteComment).toHaveBeenCalledWith('t', 'c2'));

    alert.mockImplementationOnce((_t, _m, buttons) => {
      // Someone else's: no Delete, only Report.
      expect(buttons?.some((b) => b.text === 'Delete')).toBe(false);
      buttons?.find((b) => b.text === 'Report')?.onPress?.();
    });
    fireEvent.press(screen.getByTestId('workout-comments-comment-c1-more'));
    expect(await screen.findByTestId('person-actions-report')).toHaveTextContent(/Report Comment/);
    alert.mockRestore();
  });

  it('lists everyone who liked it, each opening their profile', async () => {
    renderComments();

    fireEvent.press(await screen.findByTestId('workout-comments-liked-by'));
    fireEvent.press(screen.getByTestId('workout-comments-liker-jo'));

    expect(onOpenPerson).toHaveBeenCalledWith('jo');
  });

  it('says why when they cannot be read', async () => {
    (getWorkoutSocial as jest.Mock).mockRejectedValue(new Error('Workout not found'));
    renderComments();

    expect(await screen.findByTestId('workout-comments-error')).toHaveTextContent(
      /Workout not found/,
    );
  });
});
