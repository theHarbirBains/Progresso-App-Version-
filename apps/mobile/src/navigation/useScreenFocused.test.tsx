import { NavigationContext } from '@react-navigation/native';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { useScreenFocused } from './useScreenFocused';

describe('useScreenFocused', () => {
  it('is true outside a navigator', () => {
    const { result } = renderHook(() => useScreenFocused());
    expect(result.current).toBe(true);
  });

  it("follows the screen's focus and blur", () => {
    const listeners: Record<string, () => void> = {};
    const navigation = {
      isFocused: () => true,
      addListener: (event: string, cb: () => void) => {
        listeners[event] = cb;
        return () => undefined;
      },
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NavigationContext.Provider value={navigation as never}>
        {children}
      </NavigationContext.Provider>
    );
    const { result } = renderHook(() => useScreenFocused(), { wrapper });
    expect(result.current).toBe(true);

    act(() => listeners.blur());
    expect(result.current).toBe(false);
    act(() => listeners.focus());
    expect(result.current).toBe(true);
  });
});
