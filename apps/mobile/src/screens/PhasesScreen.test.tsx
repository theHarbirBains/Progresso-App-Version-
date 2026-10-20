import type { PropsWithChildren } from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppMenuContext } from '../navigation/AppMenuContext';
import { fetchNutritionGoals } from '../nutrition/nutritionGoalQueries';
import { NutritionGoalsProvider } from '../nutrition/NutritionGoalsProvider';
import { PhaseProvider } from '../phases/PhaseProvider';
import {
  createPhase,
  deletePhase,
  endPhase,
  fetchPhases,
  updatePhase,
  type TrainingPhase,
} from '../phases/phaseQueries';
import { dayBefore, dayKey } from '../phases/phaseRules';
import { fetchMyProfile } from '../profile/profileQueries';
import { ProfileProvider } from '../profile/ProfileProvider';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { PhaseFormScreen } from './PhaseFormScreen';
import { PhasesScreen } from './PhasesScreen';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../profile/profileQueries', () => ({ fetchMyProfile: jest.fn() }));
jest.mock('../nutrition/nutritionGoalQueries', () => ({
  fetchNutritionGoals: jest.fn(),
  saveNutritionGoals: jest.fn(),
}));
jest.mock('../nutrition/foodLogQueries', () => ({
  fetchIntakeForRange: jest.fn().mockResolvedValue([]),
}));
jest.mock('../progress/AllTimeStatsProvider', () => ({
  useAllTimeStats: () => ({ allWorkouts: [] }),
}));
jest.mock('../phases/phaseQueries', () => ({
  fetchPhases: jest.fn(),
  createPhase: jest.fn(),
  updatePhase: jest.fn(),
  endPhase: jest.fn(),
  deletePhase: jest.fn(),
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: mockNavigate, goBack: mockGoBack, addListener: jest.fn() };

const today = dayKey(new Date());

function phase(overrides: Partial<TrainingPhase> = {}): TrainingPhase {
  return {
    id: 'cut-1',
    kind: 'cut',
    name: null,
    startDate: '2026-10-01',
    endDate: null,
    startWeightKg: 90,
    targetWeightKg: 85,
    targets: { calories: 1900, proteinG: null, carbsG: null, fatG: null },
    notes: null,
    ...overrides,
  };
}

function Providers({ children }: PropsWithChildren) {
  return (
    <ProfileProvider>
      <NutritionGoalsProvider>
        <PhaseProvider>
          <AppMenuContext.Provider value={{ openMenu: jest.fn(), currentMode: 'nutrition' }}>
            {children}
          </AppMenuContext.Provider>
        </PhaseProvider>
      </NutritionGoalsProvider>
    </ProfileProvider>
  );
}

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 't' },
  });
  (fetchMyProfile as jest.Mock).mockResolvedValue({
    id: 'user-1',
    weightUnit: 'lb',
    weightValue: 90,
  });
  (fetchNutritionGoals as jest.Mock).mockResolvedValue({
    calories: 2400,
    proteinG: 160,
    carbsG: null,
    fatG: null,
  });
  (fetchPhases as jest.Mock).mockReset().mockResolvedValue([]);
  (createPhase as jest.Mock).mockReset();
  (updatePhase as jest.Mock).mockReset();
  (endPhase as jest.Mock).mockReset();
  (deletePhase as jest.Mock).mockReset();
  mockNavigate.mockClear();
  mockGoBack.mockClear();
});

describe('PhasesScreen', () => {
  it('offers to start a phase when none is going', async () => {
    render(<PhasesScreen navigation={navigation} route={{} as never} />, { wrapper: Providers });

    expect(await screen.findByTestId('phases-empty')).toHaveTextContent(/No phase going/);
    fireEvent.press(screen.getByTestId('phases-start-button'));
    expect(mockNavigate).toHaveBeenCalledWith('PhaseForm');
  });

  it('shows the phase going now with its own targets, and past phases', async () => {
    (fetchPhases as jest.Mock).mockResolvedValue([
      phase(),
      phase({ id: 'bulk-1', kind: 'bulk', startDate: '2026-05-01', endDate: '2026-08-31' }),
    ]);
    render(<PhasesScreen navigation={navigation} route={{} as never} />, { wrapper: Providers });

    expect(await screen.findByTestId('phases-active-name')).toHaveTextContent('Cut');
    expect(screen.getByTestId('phases-active-targets')).toHaveTextContent(
      /Its own targets: 1,900 cal. Any it leaves blank use your daily targets/,
    );
    expect(screen.getByTestId('phases-past-bulk-1')).toHaveTextContent(/Bulk/);
    expect(screen.getByTestId('phases-past-bulk-1')).toHaveTextContent(/123 days/);
    await waitFor(() =>
      expect(screen.getByTestId('phases-active-summary-weights')).toHaveTextContent(
        /Started at 198.4 lb, target 187.4 lb/,
      ),
    );
    expectNoBareText();
  });

  it('ends the phase today after asking', async () => {
    (fetchPhases as jest.Mock).mockResolvedValue([phase()]);
    (endPhase as jest.Mock).mockResolvedValue(phase({ endDate: today }));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'End Phase')?.onPress?.();
    });
    render(<PhasesScreen navigation={navigation} route={{} as never} />, { wrapper: Providers });

    const end = await screen.findByTestId('phases-end-active');
    await act(async () => {
      fireEvent.press(end);
    });

    expect(alert.mock.calls[0]![0]).toBe('End your Cut today?');
    expect(endPhase).toHaveBeenCalledWith('cut-1', today);
    expect(await screen.findByTestId('phases-empty')).toBeTruthy();
    alert.mockRestore();
  });
});

describe('PhaseFormScreen', () => {
  function renderForm(phaseId?: string) {
    render(
      <PhaseFormScreen
        navigation={navigation}
        route={{ params: phaseId ? { phaseId } : undefined } as never}
      />,
      { wrapper: Providers },
    );
  }

  it('starts a cut today with targets of its own, the rest left to the daily ones', async () => {
    (createPhase as jest.Mock).mockImplementation(async (_user: string, input: object) => ({
      id: 'new',
      ...input,
    }));
    renderForm();

    fireEvent.changeText(await screen.findByTestId('phase-targets-calories'), '1900');
    await act(async () => {
      fireEvent.press(screen.getByTestId('phase-form-save'));
    });

    expect(createPhase).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        kind: 'cut',
        startDate: today,
        endDate: null,
        targets: { calories: 1900, proteinG: null, carbsG: null, fatG: null },
      }),
    );
    expect(mockGoBack).toHaveBeenCalled();
  });

  it("asks a custom phase for its name before it's saved", async () => {
    renderForm();

    fireEvent.press(await screen.findByTestId('phase-form-kind-custom'));

    expect(screen.getByTestId('phase-form-rule-error')).toHaveTextContent(
      'Give your phase a name.',
    );
    expect(screen.getByTestId('phase-form-save').props.accessibilityState.disabled).toBe(true);
  });

  it('ends the phase going the day before a new one starts', async () => {
    (fetchPhases as jest.Mock).mockResolvedValue([phase({ startDate: '2026-01-01' })]);
    (endPhase as jest.Mock).mockResolvedValue(
      phase({ startDate: '2026-01-01', endDate: dayBefore(today) }),
    );
    (createPhase as jest.Mock).mockImplementation(async (_user: string, input: object) => ({
      id: 'new',
      ...input,
    }));
    renderForm();

    fireEvent.press(await screen.findByTestId('phase-form-kind-bulk'));
    expect(screen.getByTestId('phase-form-ends-active')).toHaveTextContent(
      /Starting this ends your Cut/,
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('phase-form-save'));
    });

    expect(endPhase).toHaveBeenCalledWith('cut-1', dayBefore(today));
    expect(createPhase).toHaveBeenCalledWith('user-1', expect.objectContaining({ kind: 'bulk' }));
  });

  it('reviews and edits a past phase', async () => {
    const past = phase({
      id: 'bulk-1',
      kind: 'bulk',
      startDate: '2026-05-01',
      endDate: '2026-08-31',
    });
    (fetchPhases as jest.Mock).mockResolvedValue([past]);
    (updatePhase as jest.Mock).mockImplementation(async (_id: string, input: object) => ({
      ...past,
      ...input,
    }));
    renderForm('bulk-1');

    expect(await screen.findByTestId('phase-form-summary')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('phase-form-name'), 'Winter Bulk');
    await act(async () => {
      fireEvent.press(screen.getByTestId('phase-form-save'));
    });
    expect(updatePhase).toHaveBeenCalledWith(
      'bulk-1',
      expect.objectContaining({ name: 'Winter Bulk', endDate: '2026-08-31' }),
    );
  });

  it('deletes a phase after asking, leaving everything else as it is', async () => {
    const past = phase({
      id: 'bulk-1',
      kind: 'bulk',
      startDate: '2026-05-01',
      endDate: '2026-08-31',
    });
    (fetchPhases as jest.Mock).mockResolvedValue([past]);
    (deletePhase as jest.Mock).mockResolvedValue(undefined);
    renderForm('bulk-1');
    const remove = await screen.findByTestId('phase-form-delete');

    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Delete Phase')?.onPress?.();
    });
    await act(async () => {
      fireEvent.press(remove);
    });
    expect(deletePhase).toHaveBeenCalledWith('bulk-1');
    (Alert.alert as jest.Mock).mockRestore();
  });
});
