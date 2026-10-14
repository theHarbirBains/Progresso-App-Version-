import { createContext, useContext } from 'react';

/**
 * True for everything rendered inside a card (AppCard or Card). A card inside
 * a card is the "floating rectangles" look this design system avoids, so
 * components that would otherwise draw their own card -- a nested AppCard
 * warns, a Section stays a plain titled group -- check this first.
 */
export const InsideCardContext = createContext(false);

/** Whether this component is rendered inside a card. */
export function useInsideCard(): boolean {
  return useContext(InsideCardContext);
}
