import { NavigationContainer, NavigationIndependentTree } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useCallback, type ReactNode } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { AppBackgroundLayer, ScreenBackdrop } from '../design/AppBackgroundLayer';
import {
  getScreenTransitionOptions,
  useReduceMotionPreference,
} from '../navigation/navigationTransitions';
import type { RootStackParamList } from '../navigation/types';
import { ProgramHostProvider, type ProgramChoice } from './programHost';
import { PROGRAM_SCREENS } from './programScreens';

const Stack = createNativeStackNavigator<RootStackParamList>();

interface Props {
  visible: boolean;
  /** The one chosen already, to mark it. */
  chosen: ProgramChoice | null;
  /** Use Program: remembered for when the account's made. */
  onChoose: (choice: ProgramChoice) => void;
  /** Closed from the first page, without choosing. */
  onClose: () => void;
  /** Program Chosen's Continue: on to the next question. */
  onFinish: () => void;
}

/**
 * The workout programs in onboarding: the app's own program pages, in a sheet over Choose your
 * workout split with a navigator of their own (there's no account, so no app navigator, yet).
 * Use Program here only remembers the choice; the split is made with the account
 * (submitOnboardingDraft).
 */
export function OnboardingPrograms({ visible, chosen, onChoose, onClose, onFinish }: Props) {
  const reduceMotion = useReduceMotionPreference();
  const screenOptions = useCallback(
    ({ route }: { route: { name: string } }) => ({
      headerShown: false,
      contentStyle: { backgroundColor: 'transparent' },
      ...getScreenTransitionOptions(route.name, reduceMotion),
    }),
    [reduceMotion],
  );
  const screenLayout = useCallback(
    ({ children }: { children: ReactNode }) => <ScreenBackdrop>{children}</ScreenBackdrop>,
    [],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <ProgramHostProvider
        host={{
          mode: 'onboarding',
          chosen,
          use: async (choice) => {
            onChoose(choice);
            return null;
          },
          close: onClose,
          finish: onFinish,
        }}
      >
        <View testID="onboarding-programs" style={styles.fill}>
          <AppBackgroundLayer />
          <NavigationIndependentTree>
            <NavigationContainer>
              <Stack.Navigator
                initialRouteName="WorkoutPrograms"
                screenOptions={screenOptions}
                screenLayout={screenLayout}
              >
                {PROGRAM_SCREENS.map((screen) => (
                  <Stack.Screen key={screen.name} name={screen.name} component={screen.component} />
                ))}
              </Stack.Navigator>
            </NavigationContainer>
          </NavigationIndependentTree>
        </View>
      </ProgramHostProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
