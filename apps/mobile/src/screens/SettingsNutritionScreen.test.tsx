import { fireEvent, render, screen } from '@testing-library/react-native';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { SettingsNutritionScreen } from './SettingsNutritionScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: mockNavigate, goBack: mockGoBack };

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
});

function renderScreen() {
  return render(<SettingsNutritionScreen navigation={navigation} route={{} as never} />);
}

describe('SettingsNutritionScreen', () => {
  it('goes back when the header back button is pressed', () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('app-header-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('links to the existing Nutrition Goals screen, rather than a second copy of it', () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('open-nutrition-goals'));

    expect(mockNavigate).toHaveBeenCalledWith('NutritionGoals');
  });

  it('renders no bare text outside <Text>', () => {
    renderScreen();
    expectNoBareText();
  });
});
