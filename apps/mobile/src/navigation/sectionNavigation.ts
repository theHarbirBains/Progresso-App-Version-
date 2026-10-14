import {
  CommonActions,
  StackActions,
  type NavigationAction,
  type NavigationState,
  type PartialState,
} from '@react-navigation/native';
import type { RootStackParamList } from './types';

type StackState = NavigationState | PartialState<NavigationState>;

/**
 * How to go to a section -- a bottom-nav tab or a side-menu section page (see
 * navigationTransitions.ts) -- without stacking another copy of it.
 *
 * React Navigation 7's `navigate` always pushes a new page for a route that
 * isn't the current one, so jumping between sections used to pile up a fresh
 * copy of each page on every tap, all of them kept alive underneath. A section
 * is a place, not a step, so instead:
 * - already in that section (it's the bottom of the history) -> back to its
 *   first page, like tapping the current tab on iPhone; nothing if already there.
 * - any other section -> the history becomes just that section.
 * Back from a deeper page still returns through the section as before; only
 * section-to-section history is dropped, as in any tab app.
 *
 * Returns null when there's nothing to do.
 */
export function sectionAction(
  state: StackState | undefined,
  route: keyof RootStackParamList,
): NavigationAction | null {
  const routes = state?.routes ?? [];
  if (routes[0]?.name === route) {
    return routes.length > 1 ? StackActions.popToTop() : null;
  }
  return CommonActions.reset({ index: 0, routes: [{ name: route }] });
}

/** A screen's (or the container's) navigation object, as much of it as going to a section needs. */
interface Navigator {
  getState(): StackState | undefined;
  dispatch(action: NavigationAction): void;
}

/** Goes to `route` as a section (see sectionAction). */
export function goToSection(navigation: Navigator, route: keyof RootStackParamList) {
  const action = sectionAction(navigation.getState(), route);
  if (action) navigation.dispatch(action);
}
