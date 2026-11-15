import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { MembershipTier } from '../lib/api';
import { useProfile } from '../profile/ProfileProvider';
import { SettingsMembershipScreen } from '../screens/SettingsMembershipScreen';
import {
  includesNutrition,
  includesTrainerMode,
  MEMBERSHIP_AREAS,
  MEMBERSHIP_OPTIONS,
} from './membershipTiers';
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

  it('list everything in each part they include, Workouts in all of them', () => {
    expect(MEMBERSHIP_OPTIONS.map((option) => option.areas)).toEqual([
      ['workouts'],
      ['workouts', 'nutrition'],
      ['workouts', 'nutrition', 'trainer'],
    ]);
    for (const area of MEMBERSHIP_AREAS) expect(area.features.length).toBeGreaterThan(3);
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

  it('shows each membership on its own card, every feature listed, the one in use marked', async () => {
    render(
      withTier(
        'everything',
        <SettingsMembershipScreen navigation={navigation} route={{} as never} />,
      ),
    );

    // One card each, side by side to swipe through.
    expect(screen.getByTestId('settings-membership-pager').props.horizontal).toBe(true);
    expect(screen.getByTestId('settings-membership-pager').props.pagingEnabled).toBe(true);
    for (const option of MEMBERSHIP_OPTIONS) {
      expect(screen.getByTestId(`settings-membership-card-${option.tier}`)).toBeTruthy();
    }
    // Workouts lists everything in Workouts, and says Nutrition and Trainer Mode aren't in it.
    expect(screen.getByTestId('settings-membership-workouts-workouts')).toHaveTextContent(
      /Live workout tracking/,
    );
    expect(screen.getByTestId('settings-membership-workouts-nutrition')).toHaveTextContent(
      /Not included/,
    );
    expect(screen.getByTestId('settings-membership-everything-trainer')).toHaveTextContent(
      /Trainer Workspace/,
    );
    // The one in use.
    expect(screen.getByTestId('settings-membership-chosen-everything')).toBeTruthy();
    expect(screen.getByTestId('settings-membership-everything')).toHaveTextContent(
      /Your Membership/,
    );
  });

  it('switches at a tap on a card', async () => {
    render(
      withTier(
        'everything',
        <SettingsMembershipScreen navigation={navigation} route={{} as never} />,
      ),
    );

    expect(screen.getByTestId('settings-membership-workouts')).toHaveTextContent(/Choose Workouts/);
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
