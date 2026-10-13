import { fireEvent, render, screen } from '@testing-library/react-native';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { AccountSettingsScreen } from './AccountSettingsScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: mockNavigate, goBack: mockGoBack };

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
});

function renderScreen() {
  return render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
}

describe('AccountSettingsScreen', () => {
  it('shows the Settings header and tagline', () => {
    renderScreen();

    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Customize your experience.')).toBeTruthy();
  });

  it('goes back when the header back button is pressed', () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('app-header-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it.each([
    ['settings-category-personal-info', 'SettingsPersonalInfo'],
    ['settings-category-workout-preferences', 'SettingsWorkoutPreferences'],
    ['settings-category-nutrition', 'SettingsNutrition'],
    ['settings-category-notifications', 'SettingsNotifications'],
    ['settings-category-account-security', 'SettingsAccountSecurity'],
    ['settings-category-support', 'SettingsSupport'],
  ])('navigates to %s when its row is pressed', (testID, route) => {
    renderScreen();

    fireEvent.press(screen.getByTestId(testID));

    expect(mockNavigate).toHaveBeenCalledWith(route);
  });

  it('does not offer an "App" category -- every one of those destinations is already one tap away from the side menu', () => {
    renderScreen();

    expect(screen.queryByText(/^App$/)).toBeNull();
    expect(screen.queryByTestId('open-workouts')).toBeNull();
  });

  it('does not offer a Subscription category -- no purchase/subscription UI exists in the app yet', () => {
    renderScreen();

    expect(screen.queryByText(/Subscription/)).toBeNull();
  });

  it('renders no bare text outside <Text>', () => {
    renderScreen();
    expectNoBareText();
  });
});
