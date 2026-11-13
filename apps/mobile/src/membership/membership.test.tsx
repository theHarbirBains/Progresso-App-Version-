import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { MembershipTier } from '../lib/api';
import { useProfile } from '../profile/ProfileProvider';
import { SettingsMembershipScreen } from '../screens/SettingsMembershipScreen';
import { includesNutrition, includesTrainerMode, MEMBERSHIP_OPTIONS } from './membershipTiers';
import { MembershipContext } from './useMembership';
import { withNutrition } from './withNutrition';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('../profile/ProfileProvider', () => ({ useProfile: jest.fn() }));
jest.mock('../navigation/AppMenuContext', () => ({ useAppMenu: () => ({ openMenu: jest.fn() }) }));

function withTier(tier: MembershipTier, element: React.ReactElement) {
  return <MembershipContext.Provider value={tier}>{element}</MembershipContext.Provider>;
}

describe('the memberships', () => {
  it('are three, each with a name, one plain line, and what it includes', () => {
    expect(MEMBERSHIP_OPTIONS.map((option) => option.name)).toEqual([
      'Workouts',
      'Workouts + Nutrition',
      'Everything',
    ]);
    for (const option of MEMBERSHIP_OPTIONS) {
      expect(option.summary.length).toBeGreaterThan(0);
      expect(option.includes.length).toBeGreaterThan(0);
    }
  });

  it('include Nutrition from the second up, and Trainer Mode only in Everything', () => {
    expect(includesNutrition('workouts')).toBe(false);
    expect(includesNutrition('workouts_nutrition')).toBe(true);
    expect(includesNutrition('everything')).toBe(true);
    expect(includesTrainerMode('workouts_nutrition')).toBe(false);
    expect(includesTrainerMode('everything')).toBe(true);
  });
});

describe('a Nutrition screen without Nutrition in the membership', () => {
  const Screen = withNutrition(() => <Text testID="nutrition-content">Today</Text>);

  it('shows as usual with Nutrition', () => {
    render(withTier('workouts_nutrition', <Screen />));
    expect(screen.getByTestId('nutrition-content')).toBeTruthy();
  });

  it("says what it's part of, with a way to change membership, without it", () => {
    render(withTier('workouts', <Screen />));

    expect(screen.queryByTestId('nutrition-content')).toBeNull();
    expect(screen.getByText("Nutrition isn't in your membership")).toBeTruthy();
    fireEvent.press(screen.getByTestId('nutrition-locked-change'));
    expect(mockNavigate).toHaveBeenCalledWith('SettingsMembership');
  });
});

describe('Settings > Membership', () => {
  const updateProfile = jest.fn();
  const navigation = { goBack: jest.fn() } as never;

  beforeEach(() => {
    updateProfile.mockReset().mockResolvedValue({});
    jest.mocked(useProfile).mockReturnValue({ updateProfile } as never);
  });

  it('shows the membership in use, and switches at a tap', async () => {
    render(
      withTier(
        'everything',
        <SettingsMembershipScreen navigation={navigation} route={{} as never} />,
      ),
    );

    expect(
      screen.getByTestId('settings-membership-everything').props.accessibilityState.selected,
    ).toBe(true);
    fireEvent.press(screen.getByTestId('settings-membership-workouts'));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ membershipTier: 'workouts' }));
  });

  it('says so when the switch fails', async () => {
    updateProfile.mockRejectedValue(new Error('Network request failed'));
    render(
      withTier(
        'everything',
        <SettingsMembershipScreen navigation={navigation} route={{} as never} />,
      ),
    );

    fireEvent.press(screen.getByTestId('settings-membership-workouts_nutrition'));

    expect(await screen.findByTestId('settings-membership-error')).toHaveTextContent(
      'Network request failed',
    );
  });
});
