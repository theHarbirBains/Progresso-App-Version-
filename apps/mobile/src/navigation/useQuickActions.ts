import { useState } from 'react';
import type { RootStackParamList, RootStackScreenProps } from './types';

/** Shared wiring for the bottom bar's "+" quick-action menu, reused across every screen that renders BottomNavBar. */
export function useQuickActions<T extends keyof RootStackParamList>(
  navigation: RootStackScreenProps<T>['navigation'],
) {
  const [visible, setVisible] = useState(false);

  function onStartWorkout() {
    setVisible(false);
    navigation.navigate('NewWorkout');
  }

  function onLogFood() {
    setVisible(false);
    navigation.navigate('Nutrition');
  }

  return {
    visible,
    open: () => setVisible(true),
    close: () => setVisible(false),
    onStartWorkout,
    onLogFood,
  };
}
