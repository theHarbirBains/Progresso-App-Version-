import type { PropsWithChildren } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { useFoodLog } from '../nutrition/FoodLogProvider';
import { ProfileProvider } from '../profile/ProfileProvider';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { QuickFoodEntryScreen } from './QuickFoodEntryScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

// The profile isn't part of these tests; leave it loading.
jest.mock('../profile/profileQueries', () => ({
  fetchMyProfile: jest.fn(() => new Promise(() => {})),
}));

jest.mock('../nutrition/FoodLogProvider', () => ({
  useFoodLog: jest.fn(),
}));

function TestProviders({ children }: PropsWithChildren) {
  return <ProfileProvider>{children}</ProfileProvider>;
}

const mockUseAuth = useAuth as jest.Mock;
const mockUseFoodLog = useFoodLog as jest.Mock;
const mockLogQuickEntry = jest.fn();
const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack, navigate: jest.fn() };

function renderScreen(params?: { day?: string }) {
  return render(<QuickFoodEntryScreen navigation={navigation} route={{ params } as never} />, {
    wrapper: TestProviders,
  });
}

function type(field: string, text: string) {
  fireEvent.changeText(screen.getByTestId(`quick-entry-${field}`), text);
}

async function pressLog() {
  await act(async () => {
    fireEvent.press(screen.getByTestId('quick-entry-log'));
  });
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  mockLogQuickEntry.mockReset().mockResolvedValue({ id: 'log-quick' });
  mockUseFoodLog.mockReturnValue({ logQuickEntry: mockLogQuickEntry });
  mockGoBack.mockClear();
});

describe('QuickFoodEntryScreen', () => {
  it('logs a name and its figures as typed, then goes back', async () => {
    renderScreen();

    type('name', '  Team lunch ');
    type('calories', '650');
    type('proteinG', '30');
    type('carbsG', '70,5');
    type('fatG', '25');
    await pressLog();

    expect(mockLogQuickEntry).toHaveBeenCalledWith(
      { name: 'Team lunch', calories: 650, proteinG: 30, carbsG: 70.5, fatG: 25 },
      expect.any(String),
      { day: undefined, saveToLibrary: false },
    );
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('counts a blank macro as zero', async () => {
    renderScreen();

    type('name', 'Coffee');
    type('calories', '5');
    await pressLog();

    expect(mockLogQuickEntry).toHaveBeenCalledWith(
      { name: 'Coffee', calories: 5, proteinG: 0, carbsG: 0, fatG: 0 },
      expect.any(String),
      expect.anything(),
    );
  });

  it('needs a name and calories, and logs nothing without them', async () => {
    renderScreen();

    await pressLog();

    expect(screen.getByTestId('quick-entry-name-error')).toHaveTextContent('Give it a name');
    expect(screen.getByTestId('quick-entry-calories-error')).toHaveTextContent('Needed');
    expect(mockLogQuickEntry).not.toHaveBeenCalled();
  });

  it('turns down a figure that is not a number, or below zero', async () => {
    renderScreen();

    type('name', 'Snack');
    type('calories', 'lots');
    type('fatG', '-2');
    await pressLog();

    expect(screen.getByTestId('quick-entry-calories-error')).toHaveTextContent(
      'A number, 0 or more',
    );
    expect(screen.getByTestId('quick-entry-fatG-error')).toHaveTextContent('A number, 0 or more');
    expect(mockLogQuickEntry).not.toHaveBeenCalled();
  });

  it('keeps it in the Food Library only when they tick Save to Food Library', async () => {
    renderScreen();

    expect(screen.getByTestId('quick-entry-save').props.value).toBe(false);
    type('name', 'Team lunch');
    type('calories', '650');
    fireEvent(screen.getByTestId('quick-entry-save'), 'valueChange', true);
    await pressLog();

    expect(mockLogQuickEntry).toHaveBeenCalledWith(expect.anything(), expect.any(String), {
      day: undefined,
      saveToLibrary: true,
    });
  });

  it('logs to the past day it was opened for, and says which', async () => {
    renderScreen({ day: '2020-01-15' });

    expect(within(screen.getByTestId('quick-entry-header')).getByText(/^For /)).toBeTruthy();
    type('name', 'Dinner out');
    type('calories', '900');
    await pressLog();

    expect(mockLogQuickEntry).toHaveBeenCalledWith(expect.anything(), expect.any(String), {
      day: '2020-01-15',
      saveToLibrary: false,
    });
  });

  it('says these are their own figures', () => {
    renderScreen();

    expect(screen.getByTestId('quick-entry-note')).toHaveTextContent(/your own figures/);
  });

  it('shows why it was not logged, and stays open', async () => {
    mockLogQuickEntry.mockRejectedValue(new Error('network down'));
    renderScreen();

    type('name', 'Team lunch');
    type('calories', '650');
    await pressLog();

    expect(screen.getByTestId('quick-entry-error')).toHaveTextContent('network down');
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('renders no bare text outside <Text>', () => {
    renderScreen();

    expectNoBareText();
  });
});
