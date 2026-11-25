import { AppHeader } from '../design/AppHeader';
import { Screen } from '../design/Screen';
import type { RootStackScreenProps } from '../navigation/types';
import { ProgramBrowser } from '../programs/ProgramBrowser';
import { useProgramHost } from '../programs/programHost';

type Props = RootStackScreenProps<'WorkoutPrograms'>;

/**
 * The Split Library on a page of its own (programs/ProgramBrowser.tsx) -- days a week, filters,
 * Recommended for You and the library's sections. The first page of onboarding's programs sheet
 * (its `x` closes it); in the app the same browser is Workout Splits' Split Library tab, and this
 * page is only reached by a link.
 */
export function WorkoutProgramsScreen({ navigation }: Props) {
  const host = useProgramHost();

  return (
    <Screen
      testID="workout-programs"
      header={
        <AppHeader
          title="Split Library"
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
