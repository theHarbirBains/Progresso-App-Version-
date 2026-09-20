import { routeToBottomNavTab } from './bottomNavRouting';

describe('routeToBottomNavTab', () => {
  it('maps each of the 4 tabs\' own primary route to itself', () => {
    expect(routeToBottomNavTab('WorkoutHistory')).toBe('workouts');
    expect(routeToBottomNavTab('ProgressOverview')).toBe('progress');
    expect(routeToBottomNavTab('Profile')).toBe('profile');
  });

  it('keeps a secondary/nested screen\'s parent section active', () => {
    expect(routeToBottomNavTab('ActiveWorkout')).toBe('workouts');
    expect(routeToBottomNavTab('WorkoutDetail')).toBe('workouts');
    expect(routeToBottomNavTab('ExerciseLibrary')).toBe('workouts');
    expect(routeToBottomNavTab('ProgressExerciseDetail')).toBe('progress');
    expect(routeToBottomNavTab('PRHistory')).toBe('progress');
    expect(routeToBottomNavTab('AccountSettings')).toBe('profile');
    expect(routeToBottomNavTab('BackgroundThemeSettings')).toBe('profile');
  });

  it('falls back to home for an unmapped or undefined route', () => {
    expect(routeToBottomNavTab(undefined)).toBe('home');
    expect(routeToBottomNavTab('SomeFutureScreen')).toBe('home');
  });
});
