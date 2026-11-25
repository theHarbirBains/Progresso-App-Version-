import { AppHeader } from '../design/AppHeader';
import { Screen } from '../design/Screen';
import type { RootStackScreenProps } from '../navigation/types';
import { ProgramBrowser } from '../programs/ProgramBrowser';
import { useProgramHost } from '../programs/programHost';

type Props = RootStackScreenProps<'WorkoutPrograms'>;

/**
 * Workout Programs on a page of their own: the programs browser (programs/ProgramBrowser.tsx) --
 * days a week, filters, Recommended for You and every program by days a week. The first page of
 * onboarding's programs sheet (its `x` closes it); in the app the same browser is Workout Splits'
 * Programs tab, and this page is only reached by a link.
 */
export function WorkoutProgramsScreen({ navigation }: Props) {
  const host = useProgramHost();

  return (
    <Screen
      testID="workout-programs"
      header={
        <AppHeader
          title="Workout Programs"
          onBack={host.mode === 'app' ? () => navigation.goBack() : undefined}
          leftAction={
            host.mode === 'onboarding' && host.close
              ? {
                  icon: 'x',
                  onPress: host.close,
                  accessibilityLabel: 'Close',
                  testID: 'workout-programs-close',
                }
              : undefined
          }
        />
      }
    >
      <ProgramBrowser
        testID="workout-programs-browser"
        preferences={host.preferences}
        chosen={host.chosen}
        onOpen={(choice) => navigation.navigate('ProgramDetail', choice)}
      />
    </Screen>
  );
}
