import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// Whether the page a component sits on has finished arriving. A pushed page
// is drawn before its slide-in starts, so drawing something heavy (a chart)
// in that first pass holds the slide back; drawing a same-size placeholder
// first and the real thing once the page has arrived lets the slide start the
// moment you tap. True everywhere outside a navigator (and in tests).
const ArrivedContext = createContext(true);

/** The longest a page waits for its slide-in to report it has finished. */
const FALLBACK_MS = 600;

interface TransitionEvents {
  addListener(event: 'transitionEnd', callback: () => void): () => void;
}

/**
 * Wraps every page (App.tsx's screenLayout): it has "arrived" once its
 * slide-in ends -- or straight away for a page that doesn't slide, which
 * still reports its end -- and stays arrived, so anything mounted later on
 * the page (a tab switched to, a chart that loads in) draws at once.
 */
export function PageArrival({
  navigation,
  children,
}: {
  navigation: TransitionEvents;
  children: ReactNode;
}) {
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    if (arrived) return undefined;
    const arrive = () => setArrived(true);
    const off = navigation.addListener('transitionEnd', arrive);
    const timer = setTimeout(arrive, FALLBACK_MS);
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [navigation, arrived]);

  return <ArrivedContext.Provider value={arrived}>{children}</ArrivedContext.Provider>;
}

/** Whether this component's page has finished arriving (see PageArrival). */
export function usePageArrived(): boolean {
  return useContext(ArrivedContext);
}
