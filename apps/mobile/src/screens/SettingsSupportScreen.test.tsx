import { fireEvent, render, screen } from '@testing-library/react-native';
import Constants from 'expo-constants';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { SettingsSupportScreen } from './SettingsSupportScreen';

// The mock object is created entirely inside the factory (not referencing an
// outer variable) so it's fully initialized the moment anything requires
// 'expo-constants' -- including SettingsSupportScreen's own import, which
// resolves before this file's own top-level statements run. Importing
// `Constants` here gives the SAME object back, so tests can mutate it
// in-place to simulate build metadata being unavailable (e.g. Expo Go).
// Overrides jest.setup.js's global expo-constants mock, which carries no
// version/build fields at all.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.2.3' }, nativeBuildVersion: '45' },
}));

const mockedConstants = Constants as unknown as {
  expoConfig: { version?: string };
  nativeBuildVersion?: string;
};

const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: jest.fn(), goBack: mockGoBack };

beforeEach(() => {
  mockGoBack.mockClear();
  mockedConstants.expoConfig.version = '1.2.3';
  mockedConstants.nativeBuildVersion = '45';
});

function renderScreen() {
  return render(<SettingsSupportScreen navigation={navigation} route={{} as never} />);
}

describe('SettingsSupportScreen', () => {
  it('goes back when the header back button is pressed', () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('app-header-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows the help rows not built yet as Coming Soon rather than a fabricated link', () => {
    renderScreen();

    for (const testID of ['help-faq', 'help-contact-support']) {
      expect(screen.getByTestId(testID)).toHaveTextContent(/Coming Soon/);
    }
    // Report a Problem is Feedback & Suggestions now.
    expect(screen.queryByTestId('help-report-problem')).toBeNull();
  });

  it('opens Feedback & Suggestions', () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('help-feedback'));

    expect(navigation.navigate).toHaveBeenCalledWith('Feedback');
  });

  it("shows the app's real version and build from build metadata, not fabricated numbers", () => {
    renderScreen();

    expect(screen.getByTestId('about-progresso')).toHaveTextContent(/Version 1\.2\.3/);
    expect(screen.getByTestId('about-progresso')).toHaveTextContent(/Build 45/);
  });

  it('shows no version/build line at all when neither is available, rather than "undefined"', () => {
    mockedConstants.expoConfig.version = undefined;
    mockedConstants.nativeBuildVersion = undefined;

    renderScreen();

    const row = screen.getByTestId('about-progresso');
    expect(row).not.toHaveTextContent(/undefined/);
    expect(row).not.toHaveTextContent(/Version/);
    expect(row).not.toHaveTextContent(/Build/);
  });

  it('renders no bare text outside <Text>', () => {
    renderScreen();
    expectNoBareText();
  });
});
