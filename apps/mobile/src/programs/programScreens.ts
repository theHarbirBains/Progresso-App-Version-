import type { ComponentType } from 'react';
import type { RootStackParamList } from '../navigation/types';
import { ProgramAddedScreen } from '../screens/ProgramAddedScreen';
import { ProgramDayScreen } from '../screens/ProgramDayScreen';
import { ProgramDetailScreen } from '../screens/ProgramDetailScreen';
import { ProgramExerciseScreen } from '../screens/ProgramExerciseScreen';
import { ProgramGuidanceScreen } from '../screens/ProgramGuidanceScreen';
import { ProgramVariationsScreen } from '../screens/ProgramVariationsScreen';
import { WorkoutProgramsScreen } from '../screens/WorkoutProgramsScreen';

/** The program pages, registered with the app's navigator (App.tsx) and onboarding's own
 * (OnboardingPrograms) alike. */
export const PROGRAM_SCREENS: readonly {
  name: keyof RootStackParamList;
  // Each is a screen of RootStackParamList; the navigator checks its own route's props.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
}[] = [
  { name: 'WorkoutPrograms', component: WorkoutProgramsScreen },
  { name: 'ProgramDetail', component: ProgramDetailScreen },
  { name: 'ProgramDay', component: ProgramDayScreen },
  { name: 'ProgramExercise', component: ProgramExerciseScreen },
  { name: 'ProgramGuidance', component: ProgramGuidanceScreen },
  { name: 'ProgramVariations', component: ProgramVariationsScreen },
  { name: 'ProgramAdded', component: ProgramAddedScreen },
];
