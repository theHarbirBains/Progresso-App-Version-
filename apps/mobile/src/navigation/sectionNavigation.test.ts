import { CommonActions, StackActions } from '@react-navigation/native';
import { goToSection, sectionAction } from './sectionNavigation';

const stack = (...names: string[]) => ({ routes: names.map((name) => ({ name })) }) as never;

describe('sectionAction', () => {
  it('replaces the history with just the section when switching sections, so copies never pile up', () => {
    expect(sectionAction(stack('Feed', 'WorkoutDetail'), 'Nutrition')).toEqual(
      CommonActions.reset({ index: 0, routes: [{ name: 'Nutrition' }] }),
    );
  });

  it("goes back to the section's first page when already in it, like tapping the current tab", () => {
    expect(sectionAction(stack('WorkoutHistory', 'WorkoutDetail'), 'WorkoutHistory')).toEqual(
      StackActions.popToTop(),
    );
  });

  it('does nothing when already on the section page itself', () => {
    expect(sectionAction(stack('Feed'), 'Feed')).toBeNull();
  });

  it('starts the section fresh when there is no history yet', () => {
    expect(sectionAction(undefined, 'Profile')).toEqual(
      CommonActions.reset({ index: 0, routes: [{ name: 'Profile' }] }),
    );
  });
});

describe('goToSection', () => {
  it('dispatches the action for the current history, and nothing when there is nothing to do', () => {
    const dispatch = jest.fn();
    goToSection({ getState: () => stack('Feed'), dispatch }, 'Feed');
    expect(dispatch).not.toHaveBeenCalled();

    goToSection({ getState: () => stack('Feed'), dispatch }, 'ProgressOverview');
    expect(dispatch).toHaveBeenCalledWith(
      CommonActions.reset({ index: 0, routes: [{ name: 'ProgressOverview' }] }),
    );
  });
});
