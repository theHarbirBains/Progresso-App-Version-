import { routeToBottomNavTab } from './bottomNavRouting';

describe('routeToBottomNavTab', () => {
  it("maps each of the 5 tabs' own primary route to itself", () => {
    expect(routeToBottomNavTab('Feed')).toBe('feed');
    expect(routeToBottomNavTab('WorkoutHistory')).toBe('train');
    expect(routeToBottomNavTab('Nutrition')).toBe('nutrition');
    expect(routeToBottomNavTab('ProgressOverview')).toBe('progress');
    expect(routeToBottomNavTab('Profile')).toBe('you');
  });

  it("keeps a secondary/nested screen's parent section active", () => {
    expect(routeToBottomNavTab('ActiveWorkout')).toBe('train');
    expect(routeToBottomNavTab('WorkoutDetail')).toBe('train');
    expect(routeToBottomNavTab('ExerciseLibrary')).toBe('train');
    expect(routeToBottomNavTab('FoodLibrary')).toBe('nutrition');
    expect(routeToBottomNavTab('FoodSearch')).toBe('nutrition');
    expect(routeToBottomNavTab('BarcodeScanner')).toBe('nutrition');
    expect(routeToBottomNavTab('NutritionGoals')).toBe('nutrition');
    expect(routeToBottomNavTab('ProgressExerciseDetail')).toBe('progress');
    expect(routeToBottomNavTab('PRHistory')).toBe('progress');
    expect(routeToBottomNavTab('AccountSettings')).toBe('you');
    expect(routeToBottomNavTab('BackgroundThemeSettings')).toBe('you');
  });

  it('falls back to feed for an unmapped or undefined route', () => {
    expect(routeToBottomNavTab(undefined)).toBe('feed');
    expect(routeToBottomNavTab('SomeFutureScreen')).toBe('feed');
  });
});
