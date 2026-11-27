import {
  commentPreview,
  notificationCopy,
  notificationName,
  notificationPath,
} from './social-notification-copy';

const copy = (type: Parameters<typeof notificationCopy>[0]['type'], extra = {}) =>
  notificationCopy({ type, actorName: 'Sam', actorCount: 1, ...extra });

describe('social notification copy', () => {
  it('says each of the five as written', () => {
    expect(copy('follow_request')).toEqual({
      title: 'New follow request',
      body: 'Sam wants to follow you. Check out their profile!',
    });
    expect(copy('follow_accepted')).toEqual({
      title: 'Follow request accepted',
      body: "Sam accepted your follow request. You're now connected!",
    });
    expect(copy('workout_invite')).toEqual({
      title: 'Workout invitation',
      body: 'Sam wants to train with you! Join their workout?',
    });
    expect(copy('workout_like')).toEqual({
      title: 'New workout like',
      body: 'Sam liked your workout. Keep up the great work!',
    });
    expect(copy('workout_comment', { preview: 'Great session!' })).toEqual({
      title: 'New workout comment',
      body: 'Sam commented on your workout: "Great session!"',
    });
  });

  it('groups likes by how many people', () => {
    expect(copy('workout_like', { actorCount: 2 }).body).toBe(
      'Sam and 1 other liked your workout. Keep up the great work!',
    );
    expect(copy('workout_like', { actorCount: 5 }).body).toBe(
      'Sam and 4 others liked your workout. Keep up the great work!',
    );
  });

  it('handles a missing name, and a long one', () => {
    expect(notificationName(null)).toBe('Someone');
    expect(notificationName('   ')).toBe('Someone');
    expect(notificationName('  Sam   Lee ')).toBe('Sam Lee');
    const long = notificationName('A'.repeat(60));
    expect(long.length).toBe(40);
    expect(long.endsWith('…')).toBe(true);
  });

  it('keeps a comment preview short, on one line', () => {
    expect(commentPreview('Great\n\nsession!')).toBe('Great session!');
    const long = commentPreview('Strong session! '.repeat(10));
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith('…')).toBe(true);
    expect(copy('workout_comment', { preview: '' }).body).toBe('Sam commented on your workout.');
  });

  it('never names the workout -- nothing private on a lock screen', () => {
    for (const type of ['workout_like', 'workout_comment'] as const) {
      expect(copy(type, { preview: 'Nice' }).body).not.toMatch(/Pull Day/);
    }
  });

  it('opens the right screen for each', () => {
    expect(notificationPath({ type: 'follow_request', actorId: 'u1' })).toBe('notifications');
    expect(notificationPath({ type: 'follow_accepted', actorId: 'u1' })).toBe('people/u1');
    expect(notificationPath({ type: 'workout_invite', actorId: 'u1', groupId: 'g1' })).toBe(
      'groups',
    );
    expect(notificationPath({ type: 'workout_like', actorId: 'u1', workoutId: 'w1' })).toBe(
      'workouts/w1',
    );
    expect(notificationPath({ type: 'workout_comment', actorId: 'u1', workoutId: 'w1' })).toBe(
      'workouts/w1?focusComments=true',
    );
  });
});
