import type { ComponentType } from 'react';
import { AppHeader } from '../design/AppHeader';
import { Screen } from '../design/Screen';
import { useAppMenu } from '../navigation/AppMenuContext';
import { MembershipLocked } from './MembershipLocked';
import { useMembership } from './useMembership';

/** The page a Nutrition screen shows in its place when the person's membership leaves it out. */
function NutritionLockedScreen() {
  const { openMenu } = useAppMenu();
  return (
    <Screen
      testID="nutrition-locked-screen"
      header={
        <AppHeader
          testID="nutrition-locked-header"
          title="Nutrition"
          leftAction={{
            icon: 'menu',
            onPress: () => openMenu(),
            accessibilityLabel: 'Open menu',
            testID: 'nutrition-locked-open-menu',
          }}
        />
      }
    >
      <MembershipLocked
        testID="nutrition-locked"
        part="Nutrition"
        includedIn="Workouts + Nutrition and Everything"
      />
    </Screen>
  );
}

/**
 * A Nutrition screen, shown only with a membership that includes Nutrition; otherwise what it's
 * part of and a way to change membership. Wraps each Nutrition route once, where the navigator
 * registers it (App.tsx), so a deep link or a widget tap can't open one around the lock either.
 */
export function withNutrition<P extends object>(Screen: ComponentType<P>): ComponentType<P> {
  function NutritionOnly(props: P) {
    const { nutrition } = useMembership();
    return nutrition ? <Screen {...props} /> : <NutritionLockedScreen />;
  }
  NutritionOnly.displayName = `withNutrition(${Screen.displayName ?? Screen.name ?? 'Screen'})`;
  return NutritionOnly;
}
